// ============================================================
// Semantic AI Engine — Answers from the Fabric Semantic Layer
// References: Match by Team, Teams, nba_players tables
// Measures: Total Games, Win Rate, Avg Score, Teams, Active Players
// ============================================================

var SEMANTIC_DATA = {
  // Season-level aggregates (from semantic model)
  season: {
    totalGames: 1231,
    winRate: 50.0,
    avgScore: 115.3,
    totalTeams: 30,
    activePlayers: 537,
    seasonStart: "2025-10-21",
    seasonEnd: "2026-04-12"
  },

  // Division-level stats
  divisions: {
    Atlantic:   { teams: 5, games: 170, winPct: 46.19, lossPct: 40.05, avgScore: 114.8 },
    Central:    { teams: 5, games: 173, winPct: 40.64, lossPct: 45.32, avgScore: 113.9 },
    Southeast:  { teams: 5, games: 176, winPct: 40.89, lossPct: 44.83, avgScore: 116.1 },
    Northwest:  { teams: 5, games: 156, winPct: 48.76, lossPct: 38.61, avgScore: 114.5 },
    Pacific:    { teams: 5, games: 162, winPct: 41.83, lossPct: 45.05, avgScore: 116.8 },
    Southwest:  { teams: 5, games: 170, winPct: 40.89, lossPct: 45.32, avgScore: 115.2 }
  },

  // Team-level stats (30 NBA teams)
  teams: {
    "Boston Celtics":            { division: "Atlantic",  wins: 58, losses: 24, winPct: 70.7, avgScore: 118.2, homeRecord: "32-9", awayRecord: "26-15" },
    "Brooklyn Nets":             { division: "Atlantic",  wins: 32, losses: 50, winPct: 39.0, avgScore: 112.1, homeRecord: "20-21", awayRecord: "12-29" },
    "New York Knicks":           { division: "Atlantic",  wins: 50, losses: 32, winPct: 61.0, avgScore: 115.4, homeRecord: "28-13", awayRecord: "22-19" },
    "Philadelphia 76ers":        { division: "Atlantic",  wins: 47, losses: 35, winPct: 57.3, avgScore: 114.8, homeRecord: "27-14", awayRecord: "20-21" },
    "Toronto Raptors":           { division: "Atlantic",  wins: 25, losses: 57, winPct: 30.5, avgScore: 110.3, homeRecord: "16-25", awayRecord: "9-32" },
    "Chicago Bulls":             { division: "Central",   wins: 39, losses: 43, winPct: 47.6, avgScore: 113.5, homeRecord: "23-18", awayRecord: "16-25" },
    "Cleveland Cavaliers":       { division: "Central",   wins: 55, losses: 27, winPct: 67.1, avgScore: 116.9, homeRecord: "30-11", awayRecord: "25-16" },
    "Detroit Pistons":           { division: "Central",   wins: 23, losses: 59, winPct: 28.0, avgScore: 109.7, homeRecord: "14-27", awayRecord: "9-32" },
    "Indiana Pacers":            { division: "Central",   wins: 47, losses: 35, winPct: 57.3, avgScore: 118.6, homeRecord: "26-15", awayRecord: "21-20" },
    "Milwaukee Bucks":           { division: "Central",   wins: 49, losses: 33, winPct: 59.8, avgScore: 117.3, homeRecord: "28-13", awayRecord: "21-20" },
    "Atlanta Hawks":             { division: "Southeast", wins: 36, losses: 46, winPct: 43.9, avgScore: 118.4, homeRecord: "22-19", awayRecord: "14-27" },
    "Charlotte Hornets":         { division: "Southeast", wins: 21, losses: 61, winPct: 25.6, avgScore: 107.8, homeRecord: "13-28", awayRecord: "8-33" },
    "Miami Heat":                { division: "Southeast", wins: 46, losses: 36, winPct: 56.1, avgScore: 112.5, homeRecord: "27-14", awayRecord: "19-22" },
    "Orlando Magic":             { division: "Southeast", wins: 50, losses: 32, winPct: 61.0, avgScore: 111.8, homeRecord: "29-12", awayRecord: "21-20" },
    "Washington Wizards":        { division: "Southeast", wins: 20, losses: 62, winPct: 24.4, avgScore: 108.9, homeRecord: "12-29", awayRecord: "8-33" },
    "Denver Nuggets":            { division: "Northwest", wins: 50, losses: 32, winPct: 61.0, avgScore: 115.7, homeRecord: "30-11", awayRecord: "20-21" },
    "Minnesota Timberwolves":    { division: "Northwest", wins: 56, losses: 26, winPct: 68.3, avgScore: 112.9, homeRecord: "31-10", awayRecord: "25-16" },
    "Oklahoma City Thunder":     { division: "Northwest", wins: 57, losses: 25, winPct: 69.5, avgScore: 118.4, homeRecord: "32-9",  awayRecord: "25-16" },
    "Portland Trail Blazers":    { division: "Northwest", wins: 21, losses: 61, winPct: 25.6, avgScore: 110.1, homeRecord: "13-28", awayRecord: "8-33" },
    "Utah Jazz":                 { division: "Northwest", wins: 29, losses: 53, winPct: 35.4, avgScore: 112.4, homeRecord: "17-24", awayRecord: "12-29" },
    "Golden State Warriors":     { division: "Pacific",   wins: 46, losses: 36, winPct: 56.1, avgScore: 117.2, homeRecord: "27-14", awayRecord: "19-22" },
    "LA Clippers":               { division: "Pacific",   wins: 38, losses: 44, winPct: 46.3, avgScore: 113.6, homeRecord: "22-19", awayRecord: "16-25" },
    "Los Angeles Lakers":        { division: "Pacific",   wins: 42, losses: 40, winPct: 51.2, avgScore: 116.8, homeRecord: "25-16", awayRecord: "17-24" },
    "Phoenix Suns":              { division: "Pacific",   wins: 49, losses: 33, winPct: 59.8, avgScore: 117.9, homeRecord: "28-13", awayRecord: "21-20" },
    "Sacramento Kings":          { division: "Pacific",   wins: 44, losses: 38, winPct: 53.7, avgScore: 118.5, homeRecord: "25-16", awayRecord: "19-22" },
    "Dallas Mavericks":          { division: "Southwest", wins: 50, losses: 32, winPct: 61.0, avgScore: 117.6, homeRecord: "28-13", awayRecord: "22-19" },
    "Houston Rockets":           { division: "Southwest", wins: 41, losses: 41, winPct: 50.0, avgScore: 114.2, homeRecord: "24-17", awayRecord: "17-24" },
    "Memphis Grizzlies":         { division: "Southwest", wins: 48, losses: 34, winPct: 58.5, avgScore: 116.3, homeRecord: "27-14", awayRecord: "21-20" },
    "New Orleans Pelicans":      { division: "Southwest", wins: 33, losses: 49, winPct: 40.2, avgScore: 114.7, homeRecord: "20-21", awayRecord: "13-28" },
    "San Antonio Spurs":         { division: "Southwest", wins: 22, losses: 60, winPct: 26.8, avgScore: 111.0, homeRecord: "14-27", awayRecord: "8-33" }
  },

  // Semantic model schema reference
  schema: {
    tables: {
      "Match by Team": {
        description: "Game-level facts — one row per team per game",
        columns: ["game_id", "game_date", "home_team", "away_team", "home_pts", "away_pts", "result"]
      },
      "Teams": {
        description: "Team dimension — one row per team",
        columns: ["team_id", "team_name", "division", "conference"]
      },
      "nba_players": {
        description: "Player dimension — one row per player",
        columns: ["player_id", "player_name", "team_id", "position"]
      }
    },
    measures: [
      { name: "Total Games",     expression: "COUNTROWS('Match by Team')" },
      { name: "Win Rate",        expression: "DIVIDE(CALCULATE(COUNTROWS('Match by Team'), 'Match by Team'[result]=\"W\"), [Total Games])" },
      { name: "Avg Score",       expression: "AVERAGE('Match by Team'[home_pts])" },
      { name: "Teams",           expression: "DISTINCTCOUNT(Teams[team_name])" },
      { name: "Active Players",  expression: "DISTINCTCOUNT(nba_players[player_name])" }
    ]
  }
};

// ============================================================
// Semantic Query Engine
// ============================================================

function semanticQuery(input, parsed) {
  var text = input.toLowerCase();
  var response = { answer: "", insight: "", filterLogic: [], measures: [], tables: [] };

  // Determine what the user is asking about
  var isWinRate = /win\s*rate|record|wins?|loss|performance|how.*doing/.test(text);
  var isScore = /score|points?|average|avg|scoring|offensive/.test(text);
  var isGames = /games?|schedule|matchup|played/.test(text);
  var isCompare = /compare|vs|versus|better|worse|rank/.test(text);
  var isBest = /best|top|leading|strongest|highest/.test(text);
  var isWorst = /worst|bottom|weakest|lowest|struggling/.test(text);
  var isOverview = /overview|summary|stats|tell me about|show me|how is/.test(text);
  var isHomeAway = /home|away|road/.test(text);

  // Default to overview if no specific ask detected
  if (!isWinRate && !isScore && !isGames && !isCompare && !isBest && !isWorst && !isHomeAway) {
    isOverview = true;
  }

  // Build response based on context
  if (parsed.team) {
    response = buildTeamResponse(parsed.team, parsed, { isWinRate: isWinRate, isScore: isScore, isGames: isGames, isHomeAway: isHomeAway, isOverview: isOverview });
  } else if (parsed.division) {
    response = buildDivisionResponse(parsed.division, parsed, { isBest: isBest, isWorst: isWorst, isWinRate: isWinRate, isScore: isScore, isOverview: isOverview });
  } else if (isBest || isWorst) {
    response = buildLeagueRankingResponse(isBest, { isWinRate: isWinRate, isScore: isScore });
  } else {
    response = buildLeagueOverviewResponse(parsed);
  }

  return response;
}

function buildTeamResponse(teamName, parsed, flags) {
  var team = SEMANTIC_DATA.teams[teamName];
  if (!team) return { answer: "Team not found in the semantic model.", insight: "", filterLogic: [], measures: [], tables: [] };

  var response = { answer: "", insight: "", filterLogic: [], measures: [], tables: ["Match by Team", "Teams"] };

  // Build filter logic
  response.filterLogic.push({
    table: "Teams",
    column: "team_name",
    operator: "=",
    value: teamName,
    dax: "Teams[team_name] = \"" + teamName + "\""
  });

  if (parsed.dateRange) {
    response.filterLogic.push({
      table: "Match by Team",
      column: "game_date",
      operator: "between",
      value: parsed.dateRange.start + " to " + parsed.dateRange.end,
      dax: "'Match by Team'[game_date] >= DATE(" + parsed.dateRange.start.replace(/-/g, ",") + ") && 'Match by Team'[game_date] <= DATE(" + parsed.dateRange.end.replace(/-/g, ",") + ")"
    });
  }

  // Build answer
  var totalGames = team.wins + team.losses;
  response.answer = "<strong>" + teamName + "</strong> (" + team.division + " Division) have a record of " +
    "<strong>" + team.wins + "-" + team.losses + "</strong> (" + team.winPct + "% win rate) this season, " +
    "averaging <strong>" + team.avgScore + " points</strong> per game across " + totalGames + " games played.";

  if (flags.isHomeAway) {
    response.answer += "<br><br>Home record: <strong>" + team.homeRecord + "</strong> | Away record: <strong>" + team.awayRecord + "</strong>";
    response.measures.push("Total Games", "Win Rate", "Home vs Away");
  } else {
    response.measures.push("Total Games", "Win Rate", "Avg Score");
  }

  // Insight
  if (team.winPct >= 60) {
    response.insight = "This is a top-tier team with a strong season performance. They're among the league's best.";
  } else if (team.winPct >= 50) {
    response.insight = "A solid playoff-caliber team with a winning record. Competitive in their division.";
  } else if (team.winPct >= 40) {
    response.insight = "Currently below .500 and fighting for a play-in spot. Inconsistent performance.";
  } else {
    response.insight = "Struggling this season with a losing record. In the bottom tier of the league.";
  }

  return response;
}

function buildDivisionResponse(divName, parsed, flags) {
  var div = SEMANTIC_DATA.divisions[divName];
  if (!div) return { answer: "Division not found.", insight: "", filterLogic: [], measures: [], tables: [] };

  var response = { answer: "", insight: "", filterLogic: [], measures: ["Total Games", "Win Rate", "Avg Score"], tables: ["Match by Team", "Teams"] };

  // Get teams in this division sorted by win%
  var divTeams = [];
  for (var t in SEMANTIC_DATA.teams) {
    if (SEMANTIC_DATA.teams[t].division === divName) {
      divTeams.push({ name: t, data: SEMANTIC_DATA.teams[t] });
    }
  }
  divTeams.sort(function(a, b) { return b.data.winPct - a.data.winPct; });

  response.filterLogic.push({
    table: "Teams",
    column: "team_name",
    operator: "in",
    value: divTeams.map(function(t) { return t.name; }).join(", "),
    dax: "Teams[team_name] IN {" + divTeams.map(function(t) { return '"' + t.name + '"'; }).join(", ") + "}"
  });

  if (parsed.dateRange) {
    response.filterLogic.push({
      table: "Match by Team",
      column: "game_date",
      operator: "between",
      value: parsed.dateRange.start + " to " + parsed.dateRange.end,
      dax: "'Match by Team'[game_date] >= DATE(" + parsed.dateRange.start.replace(/-/g, ",") + ") && 'Match by Team'[game_date] <= DATE(" + parsed.dateRange.end.replace(/-/g, ",") + ")"
    });
  }

  // Build standings table
  var standingsRows = divTeams.map(function(t, i) {
    return "<tr><td>" + (i + 1) + "</td><td>" + t.name + "</td><td>" + t.data.wins + "-" + t.data.losses +
      "</td><td>" + t.data.winPct + "%</td><td>" + t.data.avgScore + "</td></tr>";
  }).join("");

  response.answer = "<strong>" + divName + " Division</strong> — " + div.games + " total games, " +
    div.avgScore + " avg score this season." +
    '<table class="ai-table"><thead><tr><th>#</th><th>Team</th><th>Record</th><th>Win%</th><th>Avg Pts</th></tr></thead>' +
    '<tbody>' + standingsRows + '</tbody></table>';

  var leader = divTeams[0];
  response.insight = leader.name + " leads the " + divName + " Division with a " + leader.data.winPct + "% win rate. " +
    "The division averages " + div.avgScore + " points per game.";

  return response;
}

function buildLeagueRankingResponse(isBest, flags) {
  var response = { answer: "", insight: "", filterLogic: [], measures: ["Total Games", "Win Rate", "Avg Score"], tables: ["Match by Team", "Teams"] };

  // Sort all teams
  var allTeams = [];
  for (var t in SEMANTIC_DATA.teams) {
    allTeams.push({ name: t, data: SEMANTIC_DATA.teams[t] });
  }

  if (flags.isScore) {
    allTeams.sort(function(a, b) { return isBest ? b.data.avgScore - a.data.avgScore : a.data.avgScore - b.data.avgScore; });
  } else {
    allTeams.sort(function(a, b) { return isBest ? b.data.winPct - a.data.winPct : a.data.winPct - b.data.winPct; });
  }

  var top5 = allTeams.slice(0, 5);
  var label = isBest ? "Top 5" : "Bottom 5";
  var metric = flags.isScore ? "scoring" : "win rate";

  var rows = top5.map(function(t, i) {
    return "<tr><td>" + (i + 1) + "</td><td>" + t.name + "</td><td>" + t.data.wins + "-" + t.data.losses +
      "</td><td>" + t.data.winPct + "%</td><td>" + t.data.avgScore + "</td></tr>";
  }).join("");

  response.answer = "<strong>" + label + " Teams by " + metric + ":</strong>" +
    '<table class="ai-table"><thead><tr><th>#</th><th>Team</th><th>Record</th><th>Win%</th><th>Avg Pts</th></tr></thead>' +
    '<tbody>' + rows + '</tbody></table>';

  response.insight = top5[0].name + " leads the league with a " +
    (flags.isScore ? top5[0].data.avgScore + " point average" : top5[0].data.winPct + "% win rate") + " this season.";

  // No specific filter — league-wide view
  response.filterLogic.push({
    table: "Match by Team",
    column: "game_date",
    operator: "between",
    value: SEMANTIC_DATA.season.seasonStart + " to " + SEMANTIC_DATA.season.seasonEnd,
    dax: "'Match by Team'[game_date] >= DATE(2025,10,21) && 'Match by Team'[game_date] <= DATE(2026,4,12)"
  });

  return response;
}

function buildLeagueOverviewResponse(parsed) {
  var s = SEMANTIC_DATA.season;
  var response = {
    answer: "",
    insight: "",
    filterLogic: [],
    measures: ["Total Games", "Win Rate", "Avg Score", "Teams", "Active Players"],
    tables: ["Match by Team", "Teams", "nba_players"]
  };

  response.answer = "<strong>NBA 2025-26 Season Overview</strong><br><br>" +
    '<div class="ai-stats-grid">' +
    '<div class="ai-stat"><span class="ai-stat-value">' + s.totalGames.toLocaleString() + '</span><span class="ai-stat-label">Total Games</span></div>' +
    '<div class="ai-stat"><span class="ai-stat-value">' + s.winRate + '%</span><span class="ai-stat-label">Win Rate</span></div>' +
    '<div class="ai-stat"><span class="ai-stat-value">' + s.avgScore + '</span><span class="ai-stat-label">Avg Score</span></div>' +
    '<div class="ai-stat"><span class="ai-stat-value">' + s.totalTeams + '</span><span class="ai-stat-label">Teams</span></div>' +
    '<div class="ai-stat"><span class="ai-stat-value">' + s.activePlayers + '</span><span class="ai-stat-label">Active Players</span></div>' +
    '</div>';

  if (parsed.dateRange) {
    response.filterLogic.push({
      table: "Match by Team",
      column: "game_date",
      operator: "between",
      value: parsed.dateRange.start + " to " + parsed.dateRange.end,
      dax: "'Match by Team'[game_date] >= DATE(" + parsed.dateRange.start.replace(/-/g, ",") + ") && 'Match by Team'[game_date] <= DATE(" + parsed.dateRange.end.replace(/-/g, ",") + ")"
    });
  } else {
    response.filterLogic.push({
      table: "Match by Team",
      column: "game_date",
      operator: "between",
      value: s.seasonStart + " to " + s.seasonEnd,
      dax: "'Match by Team'[game_date] >= DATE(2025,10,21) && 'Match by Team'[game_date] <= DATE(2026,4,12)"
    });
  }

  response.insight = "The NBA season is in full swing with " + s.totalGames + " games played across " + s.totalTeams + " teams and " + s.activePlayers + " active players.";

  return response;
}

// ============================================================
// Render AI Response Card
// ============================================================

function renderSemanticResponse(response, parsed, targetEl) {
  var html = '<div class="ai-response-card">';

  // Answer section
  html += '<div class="ai-answer-section">';
  html += '<div class="ai-answer-header"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00d4aa" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg> <span>Semantic Model Response</span></div>';
  html += '<div class="ai-answer-body">' + response.answer + '</div>';
  if (response.insight) {
    html += '<div class="ai-insight"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f0c000" stroke-width="2"><path d="M12 2a4 4 0 0 1 4 4c0 2-2 3-2 5h-4c0-2-2-3-2-5a4 4 0 0 1 4-4z"/><line x1="10" y1="17" x2="14" y2="17"/></svg> ' + response.insight + '</div>';
  }
  html += '</div>';

  // Semantic Model Reference
  html += '<div class="ai-semantic-section">';
  html += '<div class="ai-section-title">Semantic Layer Reference</div>';
  html += '<div class="ai-ref-grid">';
  if (response.tables.length > 0) {
    html += '<div class="ai-ref-item"><span class="ai-ref-label">Tables</span><span class="ai-ref-value">' +
      response.tables.map(function(t) { return '<code>' + t + '</code>'; }).join(' ') + '</span></div>';
  }
  if (response.measures.length > 0) {
    html += '<div class="ai-ref-item"><span class="ai-ref-label">Measures</span><span class="ai-ref-value">' +
      response.measures.map(function(m) { return '<code>' + m + '</code>'; }).join(' ') + '</span></div>';
  }
  html += '</div>';
  html += '</div>';

  // Filter Logic
  if (response.filterLogic.length > 0) {
    html += '<div class="ai-filter-section">';
    html += '<div class="ai-section-title">Filter Logic (DAX)</div>';
    html += '<div class="ai-filter-code">';
    response.filterLogic.forEach(function(f) {
      html += '<div class="ai-filter-line">';
      html += '<code class="ai-dax">' + escapeHtml(f.dax) + '</code>';
      html += '</div>';
    });
    html += '</div>';

    // URL filter equivalent
    html += '<div class="ai-section-title" style="margin-top:.75rem">Power BI URL Filter</div>';
    html += '<div class="ai-filter-code"><code class="ai-dax">';
    var urlParts = response.filterLogic.map(function(f) {
      if (f.operator === "=") return f.table + "/" + f.column + " eq '" + f.value + "'";
      if (f.operator === "in") return f.table + "/" + f.column + " in (" + f.value.split(", ").map(function(v) { return "'" + v + "'"; }).join(",") + ")";
      if (f.operator === "between") {
        var dates = f.value.split(" to ");
        return f.table + "/" + f.column + " ge datetime'" + dates[0] + "T00:00:00' and " + f.table + "/" + f.column + " le datetime'" + dates[1] + "T23:59:59'";
      }
      return "";
    });
    html += escapeHtml("?filter=" + urlParts.join(" and "));
    html += '</code></div>';
    html += '</div>';
  }

  // Action buttons
  html += '<div class="ai-actions">';
  if (parsed.matched.length > 0) {
    html += '<button class="btn btn-primary btn-sm" onclick="viewReport()"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg> Apply Filters &amp; View Report</button>';
  }
  html += '<button class="btn btn-ghost btn-sm ai-copy-btn" onclick="copyFilterLogic(this)" data-filters=\'' + escapeHtml(JSON.stringify(response.filterLogic)) + '\'><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy Filter Logic</button>';
  html += '</div>';

  html += '</div>';

  targetEl.innerHTML = html;
  targetEl.style.display = "block";
  targetEl.className = targetEl.className.replace(/\bloading\b/, "").replace(/\berror\b/, "").replace(/\bsuccess\b/, "");
}

function escapeHtml(text) {
  var div = document.createElement("div");
  div.appendChild(document.createTextNode(text));
  return div.innerHTML;
}

function copyFilterLogic(btn) {
  var filters = JSON.parse(btn.dataset.filters);
  var text = filters.map(function(f) { return f.dax; }).join("\n");
  navigator.clipboard.writeText(text).then(function() {
    var orig = btn.innerHTML;
    btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg> Copied!';
    setTimeout(function() { btn.innerHTML = orig; }, 2000);
  });
}
