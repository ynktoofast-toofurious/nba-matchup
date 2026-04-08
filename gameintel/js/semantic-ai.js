// ============================================================
// Semantic AI Engine — Queries the Fabric Semantic Layer
// Generates filter logic (DAX + Power BI URL) and describes
// what the report will show. No hardcoded stats — directs
// users to the live report for actual data.
// ============================================================

var SEMANTIC_MODEL = {
  tables: {
    "Match by Team": {
      description: "Game-level facts — one row per team per game",
      columns: ["game_id", "game_date", "home_team", "away_team", "home_pts", "away_pts", "result"]
    },
    "Teams": {
      description: "Team dimension — 30 NBA teams with division/conference",
      columns: ["team_id", "team_name", "division", "conference"]
    },
    "nba_players": {
      description: "Player dimension — active roster players",
      columns: ["player_id", "player_name", "team_id", "position"]
    }
  },
  measures: {
    "Total Games":    { expression: "COUNTROWS('Match by Team')",                                                                          description: "Count of games played" },
    "Win Rate":       { expression: "DIVIDE(CALCULATE(COUNTROWS('Match by Team'), 'Match by Team'[result]=\"W\"), [Total Games])",          description: "Percentage of games won" },
    "Avg Score":      { expression: "AVERAGE('Match by Team'[home_pts])",                                                                  description: "Average points scored per game" },
    "Teams":          { expression: "DISTINCTCOUNT(Teams[team_name])",                                                                     description: "Number of distinct teams" },
    "Active Players": { expression: "DISTINCTCOUNT(nba_players[player_name])",                                                             description: "Number of active players" }
  },
  relationships: [
    { from: "Match by Team[home_team]", to: "Teams[team_name]" },
    { from: "nba_players[team_id]",     to: "Teams[team_id]" }
  ],
  season: { start: "2025-10-21", end: "2026-04-12" }
};

var DIVISION_TEAMS = {
  Atlantic:  ["Boston Celtics", "Brooklyn Nets", "New York Knicks", "Philadelphia 76ers", "Toronto Raptors"],
  Central:   ["Chicago Bulls", "Cleveland Cavaliers", "Detroit Pistons", "Indiana Pacers", "Milwaukee Bucks"],
  Southeast: ["Atlanta Hawks", "Charlotte Hornets", "Miami Heat", "Orlando Magic", "Washington Wizards"],
  Northwest: ["Denver Nuggets", "Minnesota Timberwolves", "Oklahoma City Thunder", "Portland Trail Blazers", "Utah Jazz"],
  Pacific:   ["Golden State Warriors", "LA Clippers", "Los Angeles Lakers", "Phoenix Suns", "Sacramento Kings"],
  Southwest: ["Dallas Mavericks", "Houston Rockets", "Memphis Grizzlies", "New Orleans Pelicans", "San Antonio Spurs"]
};

// ============================================================
// Semantic Query Engine
// ============================================================

function semanticQuery(input, parsed) {
  var text = input.toLowerCase();
  var intent = detectIntent(text);

  if (parsed.team) {
    return buildTeamQuery(parsed.team, parsed, intent);
  } else if (parsed.division) {
    return buildDivisionQuery(parsed.division, parsed, intent);
  } else if (parsed.player) {
    return buildPlayerQuery(parsed.player, parsed, intent);
  } else {
    return buildLeagueQuery(parsed, intent);
  }
}

function detectIntent(text) {
  return {
    winRate:   /win\s*rate|record|wins?|loss|performance|how.*doing|standing/.test(text),
    score:     /score|points?|average|avg|scoring|offensive/.test(text),
    games:     /games?|schedule|matchup|played|upcoming/.test(text),
    homeAway:  /home|away|road/.test(text),
    compare:   /compare|vs|versus|better|worse/.test(text),
    best:      /best|top|leading|strongest|highest/.test(text),
    worst:     /worst|bottom|weakest|lowest|struggling/.test(text)
  };
}

// ============================================================
// Query Builders
// ============================================================

function buildTeamQuery(teamName, parsed, intent) {
  var division = "";
  for (var div in DIVISION_TEAMS) {
    if (DIVISION_TEAMS[div].indexOf(teamName) !== -1) { division = div; break; }
  }

  var response = {
    answer: "",
    insight: "",
    filterLogic: [],
    measures: [],
    tables: ["Match by Team", "Teams"]
  };

  response.filterLogic.push({
    table: "Teams",
    column: "team_name",
    operator: "=",
    value: teamName,
    dax: "Teams[team_name] = \"" + teamName + "\""
  });

  addDateFilter(response, parsed);

  if (intent.homeAway) {
    response.measures = ["Total Games", "Win Rate", "Avg Score"];
    response.answer = "Filtering the report for <strong>" + teamName + "</strong>" +
      (division ? " (" + division + " Division)" : "") +
      " to show their <strong>home vs away performance</strong>." +
      "<br><br>The report will display:" +
      "<ul class='ai-list'>" +
      "<li><strong>Total Games</strong> — split by home and away</li>" +
      "<li><strong>Win Rate</strong> — home court vs road performance</li>" +
      "<li>The <em>Home vs Away</em> visual breaks down W/L by location</li>" +
      "</ul>";
    response.insight = "Use the Home vs Away visual on the report to compare their record at home versus on the road.";
  } else if (intent.score) {
    response.measures = ["Avg Score", "Total Games"];
    response.answer = "Filtering the report for <strong>" + teamName + "</strong>" +
      (division ? " (" + division + " Division)" : "") +
      " to analyze their <strong>scoring output</strong>." +
      "<br><br>The report will show:" +
      "<ul class='ai-list'>" +
      "<li><strong>Avg Score</strong> — <code>AVERAGE('Match by Team'[home_pts])</code></li>" +
      "<li><strong>Games Over Time</strong> chart for scoring trends</li>" +
      "<li><strong>Match Schedule</strong> with game-by-game scores (HomePts, AwayPts)</li>" +
      "</ul>";
    response.insight = "Check the Match Schedule table for individual game scoring details.";
  } else {
    response.measures = ["Total Games", "Win Rate", "Avg Score"];
    response.answer = "Filtering the report for <strong>" + teamName + "</strong>" +
      (division ? " (" + division + " Division)" : "") +
      " to show their <strong>season performance</strong>." +
      "<br><br>The report will display:" +
      "<ul class='ai-list'>" +
      "<li><strong>Total Games</strong> — games played this season</li>" +
      "<li><strong>Win Rate</strong> — win/loss percentage</li>" +
      "<li><strong>Avg Score</strong> — average points per game</li>" +
      "<li><strong>Division Win/Loss Record</strong> — how they compare in the " + (division || "their") + " division</li>" +
      "<li><strong>Games Over Time</strong> — game trend over the season</li>" +
      "<li><strong>Home vs Away</strong> — W/L breakdown by venue</li>" +
      "</ul>";
    response.insight = "Apply these filters and view the report to see live data from the Fabric semantic model.";
  }

  return response;
}

function buildDivisionQuery(divName, parsed, intent) {
  var teams = DIVISION_TEAMS[divName];
  if (!teams) return { answer: "Division not found in the semantic model.", insight: "", filterLogic: [], measures: [], tables: [] };

  var response = {
    answer: "",
    insight: "",
    filterLogic: [],
    measures: ["Total Games", "Win Rate", "Avg Score"],
    tables: ["Match by Team", "Teams"]
  };

  response.filterLogic.push({
    table: "Teams",
    column: "team_name",
    operator: "in",
    value: teams.join(", "),
    dax: "Teams[team_name] IN {" + teams.map(function(t) { return '"' + t + '"'; }).join(", ") + "}"
  });

  addDateFilter(response, parsed);

  response.answer = "Filtering the report for the <strong>" + divName + " Division</strong> (" + teams.length + " teams)." +
    "<br><br>Teams included:" +
    "<ul class='ai-list'>" +
    teams.map(function(t) { return "<li>" + t + "</li>"; }).join("") +
    "</ul>" +
    "The report will show:" +
    "<ul class='ai-list'>" +
    "<li><strong>Division Win/Loss Record</strong> — W/L breakdown for the " + divName + " division</li>" +
    "<li><strong>Total Games</strong>, <strong>Win Rate</strong>, and <strong>Avg Score</strong> aggregated across all " + teams.length + " teams</li>" +
    "<li><strong>Games Over Time</strong> — game volume trend</li>" +
    "<li><strong>Match Schedule</strong> — filtered to division games only</li>" +
    "</ul>";

  response.insight = "The Division Win/Loss Record visual will highlight how " + divName + " compares to other divisions across the league.";

  return response;
}

function buildPlayerQuery(playerName, parsed, intent) {
  var response = {
    answer: "",
    insight: "",
    filterLogic: [],
    measures: ["Total Games", "Active Players"],
    tables: ["Match by Team", "Teams", "nba_players"]
  };

  response.filterLogic.push({
    table: "nba_players",
    column: "player_name",
    operator: "=",
    value: playerName,
    dax: "nba_players[player_name] = \"" + playerName + "\""
  });

  addDateFilter(response, parsed);

  response.answer = "Filtering the report for player <strong>" + playerName + "</strong>." +
    "<br><br>The report will show:" +
    "<ul class='ai-list'>" +
    "<li>Games where <strong>" + playerName + "</strong> participated</li>" +
    "<li>Their team's performance metrics (Win Rate, Avg Score)</li>" +
    "<li><strong>Match Schedule</strong> filtered to their games</li>" +
    "</ul>" +
    "<br>This filter uses the <code>nba_players</code> table which connects to <code>Teams</code> via <code>team_id</code>.";

  response.insight = "Player-level filtering uses the nba_players dimension. The report shows team games associated with this player.";

  return response;
}

function buildLeagueQuery(parsed, intent) {
  var response = {
    answer: "",
    insight: "",
    filterLogic: [],
    measures: ["Total Games", "Win Rate", "Avg Score", "Teams", "Active Players"],
    tables: ["Match by Team", "Teams", "nba_players"]
  };

  addDateFilter(response, parsed);

  if (intent.best || intent.worst) {
    var direction = intent.best ? "top" : "bottom";
    var metric = intent.score ? "scoring (Avg Score)" : "win rate (Win Rate)";
    response.answer = "To find the <strong>" + direction + " performing teams</strong> by " + metric + ":" +
      "<br><br>The report's <strong>Division Win/Loss Record</strong> visual shows W/L distribution across all 6 divisions. " +
      "For team-level rankings:" +
      "<ul class='ai-list'>" +
      "<li>Use the <strong>Team</strong> slicer to filter individual teams</li>" +
      "<li>The <strong>Win Rate</strong> measure: <code>" + escapeHtml(SEMANTIC_MODEL.measures["Win Rate"].expression) + "</code></li>" +
      "<li>The <strong>Avg Score</strong> measure: <code>" + escapeHtml(SEMANTIC_MODEL.measures["Avg Score"].expression) + "</code></li>" +
      "</ul>";
    response.insight = "View the report with no team filter to see the Division Win/Loss Record comparing all divisions at once.";
  } else {
    response.answer = "<strong>NBA 2025-26 Season — Semantic Model Overview</strong>" +
      "<br><br>The report is built on 3 tables in the Fabric semantic model:" +
      "<ul class='ai-list'>" +
      "<li><strong>Match by Team</strong> — " + SEMANTIC_MODEL.tables["Match by Team"].description + "</li>" +
      "<li><strong>Teams</strong> — " + SEMANTIC_MODEL.tables["Teams"].description + "</li>" +
      "<li><strong>nba_players</strong> — " + SEMANTIC_MODEL.tables["nba_players"].description + "</li>" +
      "</ul>" +
      "Key measures:" +
      '<table class="ai-table"><thead><tr><th>Measure</th><th>DAX Expression</th></tr></thead><tbody>';

    for (var m in SEMANTIC_MODEL.measures) {
      response.answer += "<tr><td><strong>" + m + "</strong></td><td><code>" + escapeHtml(SEMANTIC_MODEL.measures[m].expression) + "</code></td></tr>";
    }
    response.answer += "</tbody></table>";

    response.insight = "View the report with no filters to see league-wide aggregates across all 30 teams and 6 divisions.";
  }

  return response;
}

// ============================================================
// Helpers
// ============================================================

function addDateFilter(response, parsed) {
  if (parsed.dateRange) {
    response.filterLogic.push({
      table: "Match by Team",
      column: "game_date",
      operator: "between",
      value: parsed.dateRange.start + " to " + parsed.dateRange.end,
      dax: "'Match by Team'[game_date] >= DATE(" + parsed.dateRange.start.replace(/-/g, ",") + ") && 'Match by Team'[game_date] <= DATE(" + parsed.dateRange.end.replace(/-/g, ",") + ")"
    });
  }
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
