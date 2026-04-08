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

  // Check if Azure AD is configured and MSAL is available
  if (CONFIG.auth.clientId && CONFIG.auth.clientId !== "YOUR_CLIENT_ID" && typeof msal !== "undefined") {
    // Safety net: if auth takes more than 8 seconds, fall back to public embed
    var authTimeout = setTimeout(function () {
      console.warn("MSAL auth timed out — falling back to public embed");
      embedPublicReport();
    }, 8000);
    authenticateAndEmbed(authTimeout);
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

function authenticateAndEmbed(authTimeout) {
  try {
    var msalInstance = getMsalInstance();
  } catch (e) {
    console.error("MSAL init failed:", e);
    clearTimeout(authTimeout);
    embedPublicReport();
    return;
  }

  var loginRequest = {
    scopes: CONFIG.auth.scopes,
    loginHint: CONFIG.tenant.loginHint || undefined
  };

  function onToken(accessToken) {
    clearTimeout(authTimeout);
    embedWithToken(accessToken);
  }

  function onFail(error) {
    console.error("MSAL auth failed:", error);
    clearTimeout(authTimeout);
    embedPublicReport();
  }

  msalInstance.handleRedirectPromise().then(function (response) {
    if (response) {
      onToken(response.accessToken);
      return;
    }

    var accounts = msalInstance.getAllAccounts();
    if (accounts.length > 0) {
      var silentRequest = {
        scopes: CONFIG.auth.scopes,
        account: accounts[0]
      };
      return msalInstance.acquireTokenSilent(silentRequest).then(function (tokenResponse) {
        onToken(tokenResponse.accessToken);
      }).catch(function () {
        return msalInstance.acquireTokenPopup(loginRequest).then(function (tokenResponse) {
          onToken(tokenResponse.accessToken);
        });
      });
    } else {
      return msalInstance.acquireTokenPopup(loginRequest).then(function (tokenResponse) {
        onToken(tokenResponse.accessToken);
      });
    }
  }).catch(onFail);
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
        filters: { visible: false },
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
    // Apply saved filters after report loads
    applySavedFilters();
  });

  pbiReport.off("error");
  pbiReport.on("error", function (event) {
    console.error("Power BI embed error:", event.detail);
    showEmbedError("Report failed to load: " + (event.detail.message || "Unknown error"));
  });

  pbiReport.off("rendered");
  pbiReport.on("rendered", function () {
    console.log("Report rendered successfully");
  });
}

// ============================================================
// Programmatic Filter Application (SDK)
// ============================================================

function applySavedFilters() {
  if (!pbiReport) return;

  var saved = sessionStorage.getItem("selectedFilters");
  if (!saved) return;

  var filters = JSON.parse(saved);
  var pbiFilters = buildPbiFilters(filters);

  if (pbiFilters.length > 0) {
    pbiReport.setFilters(pbiFilters).catch(function (err) {
      console.error("Failed to apply filters:", err);
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

  // Division filter (multiple teams)
  if (filters.division && filters.division !== "All" && (!filters.team || filters.team === "All")) {
    var teams = CONFIG.teamsByDivision[filters.division];
    if (teams && teams.length > 0) {
      result.push({
        $schema: "http://powerbi.com/product/schema#basic",
        target: {
          table: CONFIG.filters.team.table,
          column: CONFIG.filters.team.column
        },
        filterType: models.FilterType.Basic,
        operator: "In",
        values: teams
      });
    }
  }

  // Player filter
  if (filters.player) {
    result.push({
      $schema: "http://powerbi.com/product/schema#basic",
      target: {
        table: CONFIG.filters.player.table,
        column: CONFIG.filters.player.column
      },
      filterType: models.FilterType.Basic,
      operator: "Contains",
      values: [filters.player]
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
  var saved = sessionStorage.getItem("selectedFilters");
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