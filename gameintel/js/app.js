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
  // Populate Division dropdown (if present)
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
  if (!teamSelect) return;
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
  if (!saved) return;
  const filters = JSON.parse(saved);
  var el;
  if (filters.dateStart && (el = document.getElementById("filterDateStart"))) el.value = filters.dateStart;
  if (filters.dateEnd && (el = document.getElementById("filterDateEnd"))) el.value = filters.dateEnd;
  if (filters.division && (el = document.getElementById("filterDivision"))) { el.value = filters.division; populateTeams(filters.division); }
  if (filters.team && (el = document.getElementById("filterTeam"))) el.value = filters.team;
  if (filters.player && (el = document.getElementById("filterPlayer"))) el.value = filters.player;
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
  var el;
  if ((el = document.getElementById("filterDateStart"))) el.value = "2025-10-21";
  if ((el = document.getElementById("filterDateEnd"))) el.value = "2026-04-12";
  if ((el = document.getElementById("filterDivision"))) { el.value = "All"; populateTeams("All"); }
  if ((el = document.getElementById("filterTeam"))) el.value = "All";
  if ((el = document.getElementById("filterPlayer"))) el.value = "";
  document.querySelectorAll("[data-range]").forEach(b => b.classList.remove("active"));
  sessionStorage.removeItem("selectedFilters");
}

// ============================================================
// AI Prompt Filter Assistant
// ============================================================

function fillPrompt(text) {
  document.getElementById("promptInput").value = text;
  document.getElementById("promptInput").focus();
}

function processPrompt() {
  const input = document.getElementById("promptInput").value.trim();
  if (!input) return;

  const resultEl = document.getElementById("promptResult");
  resultEl.style.display = "block";
  resultEl.className = "prompt-result loading";
  resultEl.innerHTML = '<span class="prompt-spinner"></span> Analyzing your request...';

  setTimeout(() => {
    try {
      const parsed = parsePrompt(input);
      applyParsedFilters(parsed);
      showPromptResult(parsed, resultEl);
    } catch (err) {
      console.error("Prompt processing error:", err);
      resultEl.className = "prompt-result error";
      resultEl.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ff6b6b" stroke-width="2" style="vertical-align:middle;margin-right:4px"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg> Error: ' + err.message;
    }
  }, 600);
}

function parsePrompt(input) {
  const text = input.toLowerCase();
  const result = { division: null, team: null, player: null, dateRange: null, matched: [] };
  const today = new Date();
  const fmt = d => d.toISOString().split("T")[0];

  // --- Date parsing ---
  if (/\btoday\b/.test(text)) {
    result.dateRange = { start: fmt(today), end: fmt(today) };
    result.matched.push("Date: Today");
  } else if (/\byesterday\b/.test(text)) {
    const y = new Date(today); y.setDate(y.getDate() - 1);
    result.dateRange = { start: fmt(y), end: fmt(y) };
    result.matched.push("Date: Yesterday");
  } else if (/\btomorrow\b/.test(text)) {
    const t = new Date(today); t.setDate(t.getDate() + 1);
    result.dateRange = { start: fmt(t), end: fmt(t) };
    result.matched.push("Date: Tomorrow");
  } else if (/\blast\s*(7|seven)\s*days?\b|\bpast\s*week\b|\blast\s*week\b/.test(text)) {
    const d = new Date(today); d.setDate(d.getDate() - 7);
    result.dateRange = { start: fmt(d), end: fmt(today) };
    result.matched.push("Date: Last 7 days");
  } else if (/\bnext\s*(7|seven)\s*days?\b|\bnext\s*week\b/.test(text)) {
    const d = new Date(today); d.setDate(d.getDate() + 7);
    result.dateRange = { start: fmt(today), end: fmt(d) };
    result.matched.push("Date: Next 7 days");
  } else if (/\blast\s*(30|thirty)\s*days?\b|\blast\s*month\b|\bpast\s*month\b/.test(text)) {
    const d = new Date(today); d.setDate(d.getDate() - 30);
    result.dateRange = { start: fmt(d), end: fmt(today) };
    result.matched.push("Date: Last 30 days");
  } else if (/\bthis\s*season\b|\bfull\s*season\b|\ball\s*season\b|\bentire\s*season\b/.test(text)) {
    result.dateRange = { start: "2025-10-21", end: "2026-04-12" };
    result.matched.push("Date: Full season");
  } else if (/\bpast\b|\bhistor/.test(text)) {
    result.dateRange = { start: "2025-10-21", end: fmt(today) };
    result.matched.push("Date: Past games");
  }

  // --- Team parsing ---
  const allTeams = Object.values(CONFIG.teamsByDivision).flat();
  // Build lookup: full name, city name, and nickname
  for (const team of allTeams) {
    const parts = team.split(" ");
    const nickname = parts[parts.length - 1].toLowerCase(); // e.g. "celtics"
    const city = parts.slice(0, -1).join(" ").toLowerCase(); // e.g. "boston"
    if (text.includes(team.toLowerCase()) || text.includes(nickname) || text.includes(city)) {
      result.team = team;
      // Find which division this team is in
      for (const [div, teams] of Object.entries(CONFIG.teamsByDivision)) {
        if (teams.includes(team)) {
          result.division = div;
          break;
        }
      }
      result.matched.push("Team: " + team);
      break;
    }
  }

  // --- Division parsing (only if no team already matched) ---
  if (!result.division) {
    for (const div of CONFIG.divisions) {
      if (text.includes(div.toLowerCase())) {
        result.division = div;
        result.matched.push("Division: " + div);
        break;
      }
    }
  }

  // --- Player parsing ---
  // Look for capitalized name patterns in the original input (not lowercased)
  const nameMatch = input.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/);
  if (nameMatch) {
    const possibleName = nameMatch[1];
    // Make sure it's not a team name or division
    const isTeam = allTeams.some(t => t === possibleName);
    const isDiv = CONFIG.divisions.some(d => d === possibleName);
    if (!isTeam && !isDiv) {
      result.player = possibleName;
      result.matched.push("Player: " + possibleName);
    }
  }

  return result;
}

function applyParsedFilters(parsed) {
  resetFilters();
  var el;
  if (parsed.dateRange) {
    if ((el = document.getElementById("filterDateStart"))) el.value = parsed.dateRange.start;
    if ((el = document.getElementById("filterDateEnd"))) el.value = parsed.dateRange.end;
  }
  if (parsed.division) {
    if ((el = document.getElementById("filterDivision"))) { el.value = parsed.division; populateTeams(parsed.division); }
  }
  if (parsed.team) {
    if ((el = document.getElementById("filterTeam"))) el.value = parsed.team;
  }
  if (parsed.player) {
    if ((el = document.getElementById("filterPlayer"))) el.value = parsed.player;
  }
}

function showPromptResult(parsed, el) {
  if (parsed.matched.length === 0) {
    el.className = "prompt-result error";
    el.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ff6b6b" stroke-width="2" style="vertical-align:middle;margin-right:4px"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg> Could not understand that query. Try mentioning a <strong>team name</strong>, <strong>division</strong>, <strong>player name</strong>, or <strong>time range</strong> (e.g. "Lakers last 7 days").';
    return;
  }

  // Use the semantic AI engine to generate a data-driven response
  var input = document.getElementById("promptInput").value.trim();
  var semanticResponse = semanticQuery(input, parsed);
  renderSemanticResponse(semanticResponse, parsed, el);
}