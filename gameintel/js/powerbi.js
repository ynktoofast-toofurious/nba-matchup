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

  displayActiveFilters();

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
        filters: { visible: true, expanded: false },
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
  var filtersApplied = false;
  pbiReport.on("rendered", function () {
    if (filtersApplied) return; // only apply once
    filtersApplied = true;
    console.log("Report rendered — applying filters now");
    applySavedFilters();
  });
}

// ============================================================
// Programmatic Filter Application (SDK)
// ============================================================

function applySavedFilters() {
  if (!pbiReport) return;

  // Try sessionStorage first, fall back to localStorage (survives MSAL redirect)
  var saved = sessionStorage.getItem("selectedFilters") || localStorage.getItem("selectedFilters");
  if (!saved) {
    console.log("No saved filters found");
    return;
  }

  var filters = JSON.parse(saved);
  var pbiFilters = buildPbiFilters(filters);
  console.log("Applying filters:", JSON.stringify(pbiFilters));

  if (pbiFilters.length > 0) {
    // Use page-level filters (matches "Filters on this page" in PBI filter pane)
    pbiReport.getPages().then(function (pages) {
      var activePage = pages.filter(function (p) { return p.isActive; })[0];
      if (activePage) {
        console.log("Setting filters on page: " + activePage.displayName);
        return activePage.setFilters(pbiFilters);
      } else {
        console.log("No active page found, setting report-level filters");
        return pbiReport.setFilters(pbiFilters);
      }
    }).then(function () {
      console.log("Filters applied successfully");
    }).catch(function (err) {
      console.error("Page filter failed, trying report-level:", err);
      pbiReport.setFilters(pbiFilters).catch(function (err2) {
        console.error("Report-level filter also failed:", err2);
      });
    });
  }
}

function buildPbiFilters(filters) {
  var models = window["powerbi-client"].models;
  var result = [];

  // Date range filter
  if (filters.dateStart && filters.dateEnd) {
    result.push({
      $schema: "http://powerbi.com/product/schema#advanced",
      target: {
        table: CONFIG.filters.dateRange.table,
        column: CONFIG.filters.dateRange.column
      },
      filterType: models.FilterType.Advanced,
      logicalOperator: "And",
      conditions: [
        { operator: "GreaterThanOrEqual", value: filters.dateStart + "T00:00:00Z" },
        { operator: "LessThanOrEqual", value: filters.dateEnd + "T23:59:59Z" }
      ]
    });
  }

  // Team filter
  if (filters.team && filters.team !== "All") {
    result.push({
      $schema: "http://powerbi.com/product/schema#basic",
      target: {
        table: CONFIG.filters.team.table,
        column: CONFIG.filters.team.column
      },
      filterType: models.FilterType.Basic,
      operator: "In",
      values: [filters.team]
    });
  }

  // Division filter
  if (filters.division && filters.division !== "All") {
    result.push({
      $schema: "http://powerbi.com/product/schema#basic",
      target: {
        table: CONFIG.filters.division.table,
        column: CONFIG.filters.division.column
      },
      filterType: models.FilterType.Basic,
      operator: "In",
      values: [filters.division]
    });
  }

  // Player filter (uses AdvancedFilter for "Contains" operator)
  if (filters.player) {
    result.push({
      $schema: "http://powerbi.com/product/schema#advanced",
      target: {
        table: CONFIG.filters.player.table,
        column: CONFIG.filters.player.column
      },
      filterType: models.FilterType.Advanced,
      logicalOperator: "And",
      conditions: [
        { operator: "Contains", value: filters.player }
      ]
    });
  }

  return result;
}

// Apply new filters to an already-embedded report
function reEmbedReport() {
  displayActiveFilters();
  if (pbiReport) {
    // SDK: just update filters, no need to re-embed
    applySavedFilters();
  } else {
    // Fallback: re-embed iframe
    var embedContainer = document.getElementById("reportContainer");
    var loadingEl = document.getElementById("reportLoading");
    embedContainer.innerHTML = "";
    if (loadingEl) loadingEl.style.display = "flex";
    embedPublicReport();
  }
}

function displayActiveFilters() {
  var saved = sessionStorage.getItem("selectedFilters") || localStorage.getItem("selectedFilters");
  if (!saved) return;
  var filters = JSON.parse(saved);
  var container = document.getElementById("activeFilters");
  if (!container) return;

  var chips = [];
  if (filters.dateStart && filters.dateEnd) {
    chips.push("\u{1F4C5} " + filters.dateStart + " \u2192 " + filters.dateEnd);
  }
  if (filters.division && filters.division !== "All") {
    chips.push("\u{1F3C0} " + filters.division);
  }
  if (filters.team && filters.team !== "All") {
    chips.push("\u{1F455} " + filters.team);
  }
  if (filters.player) {
    chips.push("\u{1F3C3} " + filters.player);
  }
  if (chips.length === 0) {
    chips.push("All data (no filters)");
  }

  container.innerHTML = chips.map(function (c) {
    return '<span class="filter-chip">' + c + '</span>';
  }).join("");
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