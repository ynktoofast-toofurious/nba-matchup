// ============================================================
// Power BI Embed — MSAL Auth + Power BI JS SDK
// Authenticates via Azure AD, embeds with powerbi-client SDK,
// applies filters programmatically, RLS works automatically.
// Falls back to Publish to Web if auth isn't configured.
// ============================================================

var pbiReport = null; // global reference to the embedded report
var publicEmbedLoaded = false; // prevent double-embed

document.addEventListener("DOMContentLoaded", function () {
  var user = requireAuth();
  if (!user) return;

  var userNameEl = document.getElementById("userName");
  if (userNameEl) userNameEl.textContent = user.name;

  populateFilterGuide();

  // Restore filters from localStorage if sessionStorage lost them (MSAL redirect)
  if (!sessionStorage.getItem("selectedFilters") && localStorage.getItem("selectedFilters")) {
    sessionStorage.setItem("selectedFilters", localStorage.getItem("selectedFilters"));
  }

  // Check if Azure AD is configured and MSAL is available
  if (CONFIG.auth.clientId && CONFIG.auth.clientId !== "YOUR_CLIENT_ID" && typeof msal !== "undefined") {
    authenticateAndEmbed();
  } else {
    embedPublicReport();
  }
});

// ============================================================
// MSAL Authentication
// ============================================================

function getMsalInstance() {
  var msalConfig = {
    auth: {
      clientId: CONFIG.auth.clientId,
      authority: CONFIG.auth.authority,
      redirectUri: CONFIG.auth.redirectUri
    },
    cache: {
      cacheLocation: "sessionStorage",
      storeAuthStateInCookie: false
    }
  };
  return new msal.PublicClientApplication(msalConfig);
}

function authenticateAndEmbed() {
  var msalInstance;
  try {
    msalInstance = getMsalInstance();
  } catch (e) {
    console.error("MSAL init failed:", e);
    embedPublicReport();
    return;
  }

  var loginRequest = {
    scopes: CONFIG.auth.scopes,
    loginHint: CONFIG.tenant.loginHint || undefined
  };

  // First: check if we're returning from a redirect
  msalInstance.handleRedirectPromise().then(function (response) {
    if (response) {
      // Returning from Microsoft login — we have a token
      console.log("MSAL redirect success — embedding with SDK");
      embedWithToken(response.accessToken);
      return;
    }

    // Check if user has an existing session
    var accounts = msalInstance.getAllAccounts();
    if (accounts.length > 0) {
      // Already signed in — try silent token
      var silentRequest = { scopes: CONFIG.auth.scopes, account: accounts[0] };
      msalInstance.acquireTokenSilent(silentRequest).then(function (tokenResponse) {
        console.log("MSAL silent token acquired — embedding with SDK");
        embedWithToken(tokenResponse.accessToken);
      }).catch(function () {
        // Silent failed — show sign-in prompt or fallback
        showSignInPrompt(msalInstance, loginRequest);
      });
    } else {
      // No session — check if we have filters that need auth
      var saved = sessionStorage.getItem("selectedFilters");
      var hasFilters = false;
      if (saved) {
        var f = JSON.parse(saved);
        hasFilters = (f.team && f.team !== "All") || (f.division && f.division !== "All") || f.player;
      }

      if (hasFilters) {
        // Filters selected — need auth for them to work, redirect to Microsoft login
        console.log("Filters detected, redirecting to Microsoft login...");
        msalInstance.acquireTokenRedirect(loginRequest);
      } else {
        // No filters — just show the public embed
        embedPublicReport();
      }
    }
  }).catch(function (error) {
    console.error("MSAL error:", error);
    embedPublicReport();
  });
}

function showSignInPrompt(msalInstance, loginRequest) {
  var loadingEl = document.getElementById("reportLoading");
  if (loadingEl) {
    loadingEl.innerHTML =
      '<div style="text-align:center;padding:2rem">' +
      '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#00d4aa" stroke-width="2" style="margin-bottom:1rem">' +
      '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>' +
      '<p style="color:#e6edf3;font-size:1rem;margin-bottom:.5rem"><strong>Sign in to apply filters</strong></p>' +
      '<p style="color:#8b949e;font-size:.875rem;margin-bottom:1.5rem">Sign in with your Microsoft account to filter the report by team, division, or player.</p>' +
      '<button class="btn btn-primary" id="msalSignInBtn" style="margin-right:.5rem">' +
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle;margin-right:4px"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M13.8 12H3"/></svg>' +
      'Sign in with Microsoft</button>' +
      '<button class="btn btn-secondary" id="skipSignInBtn">View without filters</button>' +
      '</div>';

    document.getElementById("msalSignInBtn").addEventListener("click", function () {
      loadingEl.innerHTML = '<div class="loading-spinner"></div><p>Redirecting to Microsoft login...</p>';
      msalInstance.acquireTokenRedirect(loginRequest);
    });

    document.getElementById("skipSignInBtn").addEventListener("click", function () {
      loadingEl.innerHTML = '<div class="loading-spinner"></div><p>Loading Power BI Report...</p>';
      embedPublicReport();
    });
  }
}

// ============================================================
// Power BI JS SDK Embed (Authenticated)
// ============================================================

function embedWithToken(accessToken) {
  var models = window["powerbi-client"].models;
  var embedContainer = document.getElementById("reportContainer");
  var loadingEl = document.getElementById("reportLoading");

  var embedUrl = "https://app.powerbi.com/reportEmbed?reportId=" +
    CONFIG.powerbi.reportId + "&groupId=" + CONFIG.powerbi.groupId;

  var config = {
    type: "report",
    tokenType: models.TokenType.Aad,
    accessToken: accessToken,
    embedUrl: embedUrl,
    id: CONFIG.powerbi.reportId,
    permissions: models.Permissions.Read,
    settings: {
      panes: {
        filters: { visible: false, expanded: false },
        pageNavigation: { visible: true }
      },
      bars: {
        statusBar: { visible: true }
      },
      background: models.BackgroundType.Transparent
    }
  };

  // Embed the report
  pbiReport = powerbi.embed(embedContainer, config);

  pbiReport.off("loaded");
  pbiReport.on("loaded", function () {
    if (loadingEl) loadingEl.style.display = "none";
    console.log("Report loaded");
  });

  pbiReport.off("error");
  pbiReport.on("error", function (event) {
    console.error("Power BI embed error:", event.detail);
    showEmbedError("Report failed to load: " + (event.detail.message || "Unknown error"));
  });

  pbiReport.off("rendered");
  pbiReport.on("rendered", function () {
    console.log("Report rendered");
  });
}

// ============================================================
// Filter Guide Panel — shows AI answer + step-by-step filter
// instructions from the user's saved selections
// ============================================================

function populateFilterGuide() {
  var container = document.getElementById("guideSteps");
  if (!container) return;

  // Show AI response if available
  var aiData = sessionStorage.getItem("aiResponse") || localStorage.getItem("aiResponse");
  var saved = sessionStorage.getItem("selectedFilters") || localStorage.getItem("selectedFilters");

  var html = "";

  // AI Analysis section
  if (aiData) {
    try {
      var ai = JSON.parse(aiData);
      var srcClass = ai.source === "gemini" ? "gemini" : "offline";
      var srcLabel = ai.source === "gemini" ? "Gemini" : "Offline AI";
      html += '<div class="guide-ai-answer">';
      html += '<div class="guide-section-title"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00d4aa" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg> AI Analysis <span class="ai-source-label ' + srcClass + '">' + srcLabel + '</span></div>';
      html += '<div class="guide-ai-body">' + ai.answer + '</div>';
      if (ai.insight) {
        html += '<div class="guide-ai-insight"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#f0c000" stroke-width="2"><path d="M12 2a4 4 0 0 1 4 4c0 2-2 3-2 5h-4c0-2-2-3-2-5a4 4 0 0 1 4-4z"/><line x1="10" y1="17" x2="14" y2="17"/></svg> ' + ai.insight + '</div>';
      }
      if (ai.suggestedVisuals && ai.suggestedVisuals.length > 0) {
        html += '<div class="guide-visuals"><span class="guide-visuals-label">Look at:</span> ';
        html += ai.suggestedVisuals.map(function(v) { return '<span class="guide-visual-tag">' + v + '</span>'; }).join(' ');
        html += '</div>';
      }
      html += '</div>';
    } catch (e) { /* invalid JSON */ }
  }

  // Filter steps section
  if (saved) {
    var filters = JSON.parse(saved);
    var steps = [];
    var stepNum = 1;

    if (filters.division && filters.division !== "All") {
      steps.push({ num: stepNum++, icon: "&#x1F3C0;", label: "Division", instruction: 'In the <strong>Division</strong> slicer, select <strong>' + escapeHtml(filters.division) + '</strong>' });
    }
    if (filters.team && filters.team !== "All") {
      steps.push({ num: stepNum++, icon: "&#x1F455;", label: "Team", instruction: 'In the <strong>Team</strong> slicer, select <strong>' + escapeHtml(filters.team) + '</strong>' });
    }
    if (filters.player) {
      steps.push({ num: stepNum++, icon: "&#x1F3C3;", label: "Player", instruction: 'In the <strong>Player</strong> slicer, search for <strong>' + escapeHtml(filters.player) + '</strong>' });
    }
    if (filters.dateStart && filters.dateEnd) {
      steps.push({ num: stepNum++, icon: "&#x1F4C5;", label: "Date Range", instruction: 'Set the <strong>Date</strong> slicer from <strong>' + escapeHtml(filters.dateStart) + '</strong> to <strong>' + escapeHtml(filters.dateEnd) + '</strong>' });
    }

    if (steps.length > 0) {
      html += '<div class="guide-section-title" style="margin-top:.75rem"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#388bfd" stroke-width="2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg> Apply These Filters</div>';
      html += steps.map(function(s) {
        return '<div class="guide-step">' +
          '<div class="step-number">' + s.num + '</div>' +
          '<div class="step-content">' +
          '<div class="step-label">' + s.icon + ' ' + s.label + '</div>' +
          '<p>' + s.instruction + '</p>' +
          '</div></div>';
      }).join("");
      html += '<div class="guide-step guide-step-done"><div class="step-number">&#x2713;</div><div class="step-content"><p>The report updates automatically as you apply each filter.</p></div></div>';
    }
  }

  if (!html) {
    html = '<div class="guide-empty">' +
      '<p>No query yet.</p>' +
      '<p class="text-muted">Use the AI prompt below to ask a question, or go back to set filters.</p>' +
      '</div>';
  }

  container.innerHTML = html;
}

function escapeHtml(str) {
  var div = document.createElement("div");
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

// Handle report-page AI prompt
function processReportPrompt() {
  var input = document.getElementById("reportPromptInput").value.trim();
  if (!input) return;

  var container = document.getElementById("guideSteps");
  if (!container) return;

  var parsed = parsePrompt(input);

  function storeAndRender(response) {
    try {
      var aiData = JSON.stringify({
        answer: response.answer,
        insight: response.insight,
        suggestedVisuals: response.suggestedVisuals || [],
        measures: response.measures,
        filterLogic: response.filterLogic,
        source: response.source || "offline"
      });
      sessionStorage.setItem("aiResponse", aiData);
      localStorage.setItem("aiResponse", aiData);
    } catch (e) { /* storage full */ }

    if (parsed.matched.length > 0) {
      var filters = {
        dateStart: parsed.dateRange ? parsed.dateRange.start : "2025-10-21",
        dateEnd: parsed.dateRange ? parsed.dateRange.end : "2026-04-12",
        division: parsed.division || "All",
        team: parsed.team || "All",
        player: parsed.player || ""
      };
      sessionStorage.setItem("selectedFilters", JSON.stringify(filters));
      localStorage.setItem("selectedFilters", JSON.stringify(filters));
    }
    populateFilterGuide();
  }

  // Use Gemini if available, else offline engine
  if (typeof GeminiAI !== "undefined" && GeminiAI.isAvailable()) {
    container.innerHTML = '<div class="guide-loading"><div class="loading-spinner" style="width:24px;height:24px;border-width:2px"></div><p class="text-muted" style="font-size:.8125rem;margin-top:.5rem"><span class="gemini-thinking">Gemini is thinking...</span></p></div>';
    GeminiAI.queryStructured(input, parsed).then(function(response) {
      storeAndRender(response);
    }).catch(function(err) {
      console.warn("Gemini error, falling back to offline:", err.message);
      var response = semanticQuery(input, parsed);
      storeAndRender(response);
    });
  } else {
    container.innerHTML = '<div class="guide-loading"><div class="loading-spinner" style="width:24px;height:24px;border-width:2px"></div><p class="text-muted" style="font-size:.8125rem;margin-top:.5rem">Analyzing...</p></div>';
    setTimeout(function() {
      try {
        var response = semanticQuery(input, parsed);
        storeAndRender(response);
      } catch (err) {
        container.innerHTML = '<div class="guide-empty"><p style="color:var(--accent-red)">Could not understand that query.</p><p class="text-muted">Try asking about a team, player, division, or measure.</p></div>';
      }
    }, 400);
  }
}

// ============================================================
// Fallback: Publish to Web (no auth, no filters, no RLS)
// ============================================================

function embedPublicReport() {
  if (publicEmbedLoaded) return; // prevent double-embed
  publicEmbedLoaded = true;

  var embedContainer = document.getElementById("reportContainer");
  var loadingEl = document.getElementById("reportLoading");

  var iframe = document.createElement("iframe");
  iframe.src = CONFIG.powerbi.publicEmbedUrl;
  iframe.frameBorder = "0";
  iframe.allowFullscreen = true;
  iframe.style.width = "100%";
  iframe.style.height = "100%";
  iframe.style.border = "none";
  iframe.setAttribute("allow", "fullscreen");
  iframe.setAttribute("sandbox", "allow-scripts allow-same-origin allow-popups allow-forms allow-popups-to-escape-sandbox");
  iframe.setAttribute("loading", "lazy");
  iframe.setAttribute("referrerpolicy", "no-referrer-when-downgrade");

  iframe.onload = function () {
    if (loadingEl) loadingEl.style.display = "none";
  };

  embedContainer.innerHTML = "";
  embedContainer.appendChild(iframe);

  setTimeout(function () {
    if (loadingEl) loadingEl.style.display = "none";
  }, 5000);
}

function showEmbedError(message) {
  var loadingEl = document.getElementById("reportLoading");
  if (loadingEl) {
    loadingEl.innerHTML =
      '<div class="embed-error">' +
      '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#f85149" stroke-width="2">' +
      '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>' +
      '</svg>' +
      '<p>' + message + '</p>' +
      '<a href="dashboard.html" class="btn btn-secondary">Back to Dashboard</a>' +
      '</div>';
  }
}