// ============================================================
// Power BI Embed — iframe with URL filter parameters
// Uses the user's Power BI session (no embed token needed)
// ============================================================

document.addEventListener("DOMContentLoaded", function () {
  var user = requireAuth();
  if (!user) return;

  // Display user info
  var userNameEl = document.getElementById("userName");
  if (userNameEl) userNameEl.textContent = user.name;

  // Show active filters
  displayActiveFilters();

  // Embed the report
  embedReport();
});

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

function buildFilterString(filters) {
  // Power BI URL filter format: ?filter=Table/Column eq 'value'
  // Multiple filters joined with " and "
  // Docs: https://learn.microsoft.com/en-us/power-bi/collaborate-share/service-url-filters
  var parts = [];

  if (filters.division && filters.division !== "All") {
    parts.push(CONFIG.filters.division.table + "/" + CONFIG.filters.division.column + " eq '" + filters.division + "'");
  }

  if (filters.team && filters.team !== "All") {
    parts.push(CONFIG.filters.team.table + "/" + CONFIG.filters.team.column + " eq '" + filters.team + "'");
  }

  if (filters.player) {
    parts.push(CONFIG.filters.player.table + "/" + CONFIG.filters.player.column + " eq '" + filters.player + "'");
  }

  return parts.length > 0 ? "&filter=" + encodeURIComponent(parts.join(" and ")) : "";
}

function embedReport() {
  var embedContainer = document.getElementById("reportContainer");
  var loadingEl = document.getElementById("reportLoading");

  // Use public embed URL (Publish to Web — no auth needed)
  var fullUrl = CONFIG.powerbi.publicEmbedUrl;

  // Create iframe
  var iframe = document.createElement("iframe");
  iframe.src = fullUrl;
  iframe.frameBorder = "0";
  iframe.allowFullscreen = true;
  iframe.style.width = "100%";
  iframe.style.height = "100%";
  iframe.style.border = "none";
  iframe.setAttribute("allow", "fullscreen");

  iframe.onload = function () {
    if (loadingEl) loadingEl.style.display = "none";
  };

  iframe.onerror = function () {
    showEmbedError("Failed to load the Power BI report. Make sure you're signed into Power BI.");
  };

  embedContainer.appendChild(iframe);

  // Fallback: hide loading after 5 seconds even if onload doesn't fire
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
