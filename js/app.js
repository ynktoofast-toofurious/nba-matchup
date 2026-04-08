// ============================================================
// Dashboard / Filter Page Logic
// ============================================================

document.addEventListener("DOMContentLoaded", () => {
  const user = requireAuth();
  if (!user) return;

  // Display user info
  const userNameEl = document.getElementById("userName");
  const userEmailEl = document.getElementById("userEmail");
  const userAvatarEl = document.getElementById("userAvatar");
  if (userNameEl) userNameEl.textContent = user.name;
  if (userEmailEl) userEmailEl.textContent = user.email;
  if (userAvatarEl) userAvatarEl.textContent = user.name.charAt(0).toUpperCase();

  initFilters();
  loadSavedFilters();
});

function initFilters() {
  // Populate Division dropdown
  const divSelect = document.getElementById("filterDivision");
  if (divSelect) {
    CONFIG.divisions.forEach(div => {
      const opt = document.createElement("option");
      opt.value = div;
      opt.textContent = div;
      divSelect.appendChild(opt);
    });
    divSelect.addEventListener("change", onDivisionChange);
  }

  // Team dropdown — populated based on division
  const teamSelect = document.getElementById("filterTeam");
  if (teamSelect) {
    populateTeams("All");
  }

  // Date defaults
  const startDate = document.getElementById("filterDateStart");
  const endDate = document.getElementById("filterDateEnd");
  if (startDate && !startDate.value) startDate.value = "2025-10-21";
  if (endDate && !endDate.value) endDate.value = "2026-04-12";

  // Quick-date buttons
  document.querySelectorAll("[data-range]").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("[data-range]").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      applyQuickDate(btn.dataset.range);
    });
  });
}

function onDivisionChange() {
  const divValue = document.getElementById("filterDivision").value;
  populateTeams(divValue);
  // Reset player
  document.getElementById("filterPlayer").value = "";
}

function populateTeams(division) {
  const teamSelect = document.getElementById("filterTeam");
  teamSelect.innerHTML = '<option value="All">All Teams</option>';
  if (division === "All") {
    // All teams across all divisions
    const allTeams = Object.values(CONFIG.teamsByDivision).flat().sort();
    allTeams.forEach(team => {
      const opt = document.createElement("option");
      opt.value = team;
      opt.textContent = team;
      teamSelect.appendChild(opt);
    });
  } else {
    const teams = CONFIG.teamsByDivision[division] || [];
    teams.forEach(team => {
      const opt = document.createElement("option");
      opt.value = team;
      opt.textContent = team;
      teamSelect.appendChild(opt);
    });
  }
}

function applyQuickDate(range) {
  const startDate = document.getElementById("filterDateStart");
  const endDate = document.getElementById("filterDateEnd");
  const today = new Date();
  const fmt = d => d.toISOString().split("T")[0];

  switch (range) {
    case "today":
      startDate.value = fmt(today);
      endDate.value = fmt(today);
      break;
    case "yesterday": {
      const y = new Date(today);
      y.setDate(y.getDate() - 1);
      startDate.value = fmt(y);
      endDate.value = fmt(y);
      break;
    }
    case "tomorrow": {
      const t = new Date(today);
      t.setDate(t.getDate() + 1);
      startDate.value = fmt(t);
      endDate.value = fmt(t);
      break;
    }
    case "next7": {
      const n = new Date(today);
      n.setDate(n.getDate() + 7);
      startDate.value = fmt(today);
      endDate.value = fmt(n);
      break;
    }
    case "past":
      startDate.value = "2025-10-21";
      endDate.value = fmt(today);
      break;
    case "all":
      startDate.value = "2025-10-21";
      endDate.value = "2026-04-12";
      break;
  }
}

function loadSavedFilters() {
  const saved = sessionStorage.getItem("selectedFilters");
  if (saved) {
    const filters = JSON.parse(saved);
    if (filters.dateStart) document.getElementById("filterDateStart").value = filters.dateStart;
    if (filters.dateEnd) document.getElementById("filterDateEnd").value = filters.dateEnd;
    if (filters.division) {
      document.getElementById("filterDivision").value = filters.division;
      populateTeams(filters.division);
    }
    if (filters.team) document.getElementById("filterTeam").value = filters.team;
    if (filters.player) document.getElementById("filterPlayer").value = filters.player;
  }
}

function getSelectedFilters() {
  return {
    dateStart: document.getElementById("filterDateStart").value,
    dateEnd: document.getElementById("filterDateEnd").value,
    division: document.getElementById("filterDivision").value,
    team: document.getElementById("filterTeam").value,
    player: document.getElementById("filterPlayer").value
  };
}

function viewReport() {
  const filters = getSelectedFilters();
  sessionStorage.setItem("selectedFilters", JSON.stringify(filters));
  window.location.href = "report.html";
}

function resetFilters() {
  document.getElementById("filterDateStart").value = "2025-10-21";
  document.getElementById("filterDateEnd").value = "2026-04-12";
  document.getElementById("filterDivision").value = "All";
  populateTeams("All");
  document.getElementById("filterTeam").value = "All";
  document.getElementById("filterPlayer").value = "";
  document.querySelectorAll("[data-range]").forEach(b => b.classList.remove("active"));
  sessionStorage.removeItem("selectedFilters");
}
