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
// Filter Guide Panel — generates step-by-step instructions
// from the user's saved filter selections
// ============================================================

function populateFilterGuide() {
  var saved = sessionStorage.getItem("selectedFilters") || localStorage.getItem("selectedFilters");
  var container = document.getElementById("guideSteps");
  if (!container) return;

  if (!saved) {
    container.innerHTML =
      '<div class="guide-empty">' +
      '<p>No filters selected.</p>' +
      '<p class="text-muted">Go back and use the AI prompt to set filters, then return here.</p>' +
      '</div>';
    return;
  }

  var filters = JSON.parse(saved);
  var steps = [];
  var stepNum = 1;

  // Division step
  if (filters.division && filters.division !== "All") {
    steps.push({
      num: stepNum++,
      icon: "&#x1F3C0;",
      label: "Division",
      instruction: 'In the <strong>Division</strong> slicer, select <strong>' + escapeHtml(filters.division) + '</strong>'
    });
  }

  // Team step
  if (filters.team && filters.team !== "All") {
    steps.push({
      num: stepNum++,
      icon: "&#x1F455;",
      label: "Team",
      instruction: 'In the <strong>Team</strong> slicer, select <strong>' + escapeHtml(filters.team) + '</strong>'
    });
  }

  // Player step
  if (filters.player) {
    steps.push({
      num: stepNum++,
      icon: "&#x1F3C3;",
      label: "Player",
      instruction: 'In the <strong>Player</strong> slicer, search for <strong>' + escapeHtml(filters.player) + '</strong>'
    });
  }

  // Date range step
  if (filters.dateStart && filters.dateEnd) {
    steps.push({
      num: stepNum++,
      icon: "&#x1F4C5;",
      label: "Date Range",
      instruction: 'Set the <strong>Date</strong> slicer from <strong>' + escapeHtml(filters.dateStart) + '</strong> to <strong>' + escapeHtml(filters.dateEnd) + '</strong>'
    });
  }

  if (steps.length === 0) {
    container.innerHTML =
      '<div class="guide-empty">' +
      '<p>No specific filters — showing all data.</p>' +
      '<p class="text-muted">Use the slicers in the report to filter as needed.</p>' +
      '</div>';
    return;
  }

  var html = steps.map(function (s) {
    return '<div class="guide-step">' +
      '<div class="step-number">' + s.num + '</div>' +
      '<div class="step-content">' +
      '<div class="step-label">' + s.icon + ' ' + s.label + '</div>' +
      '<p>' + s.instruction + '</p>' +
      '</div>' +
      '</div>';
  }).join("");

  // Add a final "done" step
  html += '<div class="guide-step guide-step-done">' +
    '<div class="step-number">&#x2713;</div>' +
    '<div class="step-content">' +
    '<p>The report will update automatically as you apply each filter.</p>' +
    '</div>' +
    '</div>';

  container.innerHTML = html;
}

function escapeHtml(str) {
  var div = document.createElement("div");
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
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