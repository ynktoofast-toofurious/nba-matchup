// ============================================================
// Semantic AI Engine — Smart Q&A over the Fabric Semantic Layer
// Understands user questions, reasons about the data model,
// provides contextual answers, and guides users to the right
// report visuals. Connected to the live semantic model schema.
// ============================================================

var SEMANTIC_MODEL = {
  tables: {
    "Match by Team": {
      description: "Game-level facts — one row per team per game",
      columns: {
        game_id:   { type: "text",    description: "Unique game identifier" },
        game_date: { type: "date",    description: "Date the game was played" },
        home_team: { type: "text",    description: "Home team name" },
        away_team: { type: "text",    description: "Away team name" },
        home_pts:  { type: "number",  description: "Points scored by home team" },
        away_pts:  { type: "number",  description: "Points scored by away team" },
        result:    { type: "text",    description: "W (win) or L (loss) for the row's team" }
      }
    },
    "Teams": {
      description: "Team dimension — 30 NBA teams with division/conference",
      columns: {
        team_id:    { type: "text", description: "Unique team identifier" },
        team_name:  { type: "text", description: "Full team name (e.g. Los Angeles Lakers)" },
        division:   { type: "text", description: "NBA division (Atlantic, Central, Southeast, Northwest, Pacific, Southwest)" },
        conference: { type: "text", description: "Eastern or Western Conference" }
      }
    },
    "nba_players": {
      description: "Player dimension — active roster players",
      columns: {
        player_id:   { type: "text", description: "Unique player identifier" },
        player_name: { type: "text", description: "Full player name" },
        team_id:     { type: "text", description: "Team the player belongs to" },
        position:    { type: "text", description: "Playing position (PG, SG, SF, PF, C)" }
      }
    }
  },
  measures: {
    "Total Games":    { expression: "COUNTROWS('Match by Team')",                                                                          description: "Count of games played" },
    "Win Rate":       { expression: "DIVIDE(CALCULATE(COUNTROWS('Match by Team'), 'Match by Team'[result]=\"W\"), [Total Games])",          description: "Percentage of games won (wins / total games)" },
    "Avg Score":      { expression: "AVERAGE('Match by Team'[home_pts])",                                                                  description: "Average points scored per game" },
    "Teams":          { expression: "DISTINCTCOUNT(Teams[team_name])",                                                                     description: "Number of distinct teams" },
    "Active Players": { expression: "DISTINCTCOUNT(nba_players[player_name])",                                                             description: "Number of active players" }
  },
  relationships: [
    { from: "\"Match by Team\".home_team", to: "\"Teams\".team_name", description: "Links games to the Teams dimension by team name" },
    { from: "nba_players.team_id",         to: "\"Teams\".team_id",   description: "Links players to their team" }
  ],
  // Report visuals the user will see
  visuals: {
    "KPI Cards":              { measures: ["Total Games", "Win Rate", "Avg Score", "Teams", "Active Players"], description: "Top-level KPI cards showing aggregate numbers" },
    "Division Win/Loss":      { measures: ["Total Games", "Win Rate"], description: "Bar chart showing win/loss records grouped by division" },
    "Games Over Time":        { measures: ["Total Games"], description: "Line chart showing game volume over the season timeline" },
    "Home vs Away":           { measures: ["Total Games", "Win Rate"], description: "Split view comparing home and away W/L records" },
    "Match Schedule":         { measures: ["Total Games"], description: "Table listing individual games with scores, dates, and results" },
    "Team Slicer":            { measures: [], description: "Dropdown slicer to filter by team name" },
    "Division Slicer":        { measures: [], description: "Dropdown slicer to filter by division" },
    "Player Slicer":          { measures: [], description: "Dropdown slicer to filter by player" }
  },
  season: { start: "2025-10-21", end: "2026-04-12" },
  leagueInfo: {
    totalTeams: 30,
    divisions: 6,
    conferences: 2,
    teamsPerDivision: 5
  }
};

var DIVISION_TEAMS = {
  Atlantic:  ["Boston Celtics", "Brooklyn Nets", "New York Knicks", "Philadelphia 76ers", "Toronto Raptors"],
  Central:   ["Chicago Bulls", "Cleveland Cavaliers", "Detroit Pistons", "Indiana Pacers", "Milwaukee Bucks"],
  Southeast: ["Atlanta Hawks", "Charlotte Hornets", "Miami Heat", "Orlando Magic", "Washington Wizards"],
  Northwest: ["Denver Nuggets", "Minnesota Timberwolves", "Oklahoma City Thunder", "Portland Trail Blazers", "Utah Jazz"],
  Pacific:   ["Golden State Warriors", "LA Clippers", "Los Angeles Lakers", "Phoenix Suns", "Sacramento Kings"],
  Southwest: ["Dallas Mavericks", "Houston Rockets", "Memphis Grizzlies", "New Orleans Pelicans", "San Antonio Spurs"]
};

var DIVISION_CONFERENCE = {
  Atlantic: "Eastern", Central: "Eastern", Southeast: "Eastern",
  Northwest: "Western", Pacific: "Western", Southwest: "Western"
};

// Known player-team associations for smarter answers
var KNOWN_PLAYERS = {
  "LeBron James": "Los Angeles Lakers",
  "Stephen Curry": "Golden State Warriors",
  "Kevin Durant": "Phoenix Suns",
  "Giannis Antetokounmpo": "Milwaukee Bucks",
  "Luka Doncic": "Los Angeles Lakers",
  "Jayson Tatum": "Boston Celtics",
  "Joel Embiid": "Philadelphia 76ers",
  "Nikola Jokic": "Denver Nuggets",
  "Anthony Davis": "Los Angeles Lakers",
  "Damian Lillard": "Milwaukee Bucks",
  "Jimmy Butler": "Miami Heat",
  "Devin Booker": "Phoenix Suns",
  "Ja Morant": "Memphis Grizzlies",
  "Trae Young": "Atlanta Hawks",
  "Zion Williamson": "New Orleans Pelicans",
  "Anthony Edwards": "Minnesota Timberwolves",
  "Shai Gilgeous-Alexander": "Oklahoma City Thunder",
  "Donovan Mitchell": "Cleveland Cavaliers",
  "Tyrese Haliburton": "Indiana Pacers",
  "Paolo Banchero": "Orlando Magic",
  "Jalen Brunson": "New York Knicks",
  "De'Aaron Fox": "Sacramento Kings",
  "Kawhi Leonard": "LA Clippers",
  "Paul George": "Philadelphia 76ers",
  "Karl-Anthony Towns": "New York Knicks",
  "Domantas Sabonis": "Sacramento Kings",
  "Kyrie Irving": "Dallas Mavericks",
  "Victor Wembanyama": "San Antonio Spurs",
  "Chet Holmgren": "Oklahoma City Thunder",
  "Scottie Barnes": "Toronto Raptors"
};

// ============================================================
// Intent Detection — understands WHAT the user is asking
// ============================================================

function detectIntent(text) {
  return {
    // Data questions
    winRate:     /win\s*rate|winning|record|wins?|loss(es)?|w[\/-]l|how.*doing|standing|perform/.test(text),
    score:       /score|points?|average|avg|scoring|offensive|pts|ppg|how\s*many\s*points/.test(text),
    games:       /games?|schedule|matchup|played|upcoming|how\s*many\s*games|total\s*games/.test(text),
    homeAway:    /home|away|road|venue|court\s*advantage|home\s*court/.test(text),
    players:     /player|roster|who\s*plays|lineup|squad|active\s*players|how\s*many\s*players/.test(text),

    // Analytical questions
    compare:     /compare|vs\.?|versus|better|worse|difference|head\s*to\s*head|against|between/.test(text),
    ranking:     /best|top|leading|strongest|highest|#\s*1|number\s*one|first\s*place|rank|most/.test(text),
    worst:       /worst|bottom|weakest|lowest|struggling|last\s*place|fewest|least/.test(text),
    trend:       /trend|over\s*time|improving|declining|streak|momentum|lately|recently|hot|cold/.test(text),

    // Explanation questions
    explain:     /what\s*(is|are|does)|how\s*(does|is|are)|explain|tell\s*me\s*about|describe|definition|meaning|understand|mean/.test(text),
    whyHow:      /why|how\s*come|reason|cause|because/.test(text),
    count:       /how\s*many|count|total|number\s*of/.test(text),
    list:        /list|show\s*(me\s*)?(all|every)|which|what\s*(teams?|divisions?|players?)/.test(text),

    // Model questions
    modelInfo:   /semantic\s*(model|layer)|data\s*model|tables?|columns?|measures?|dax|schema|relationship|data\s*source|fabric/.test(text),
    visualInfo:  /visual|chart|graph|report\s*layout|what.*report\s*show|dashboard|kpi|card/.test(text),

    // Conference / division structure
    conference:  /conference|eastern|western|east|west/.test(text),
    division:    /division/.test(text)
  };
}

// ============================================================
// Semantic Query Engine — routes to the right answer builder
// ============================================================

function semanticQuery(input, parsed) {
  var text = input.toLowerCase();
  var intent = detectIntent(text);

  // Store the original question for context
  var context = { input: input, text: text, intent: intent, parsed: parsed };

  // Route: explanation/meta questions first (no entity needed)
  if (intent.explain && intent.modelInfo) return answerModelExplain(context);
  if (intent.modelInfo) return answerModelInfo(context);
  if (intent.visualInfo) return answerVisualInfo(context);

  // Route: measure explanation
  if (intent.explain && !parsed.team && !parsed.division && !parsed.player) {
    var measureMatch = matchMeasureQuestion(text);
    if (measureMatch) return answerMeasureExplain(measureMatch, context);
  }

  // Route: listing questions
  if (intent.list && !parsed.team) return answerListQuestion(context);

  // Route: conference questions
  if (intent.conference && !parsed.team && !parsed.division) return answerConferenceQuestion(context);

  // Route: comparison (two teams mentioned)
  if (intent.compare) {
    var teams = findMultipleTeams(text);
    if (teams.length >= 2) return answerCompareTeams(teams, context);
  }

  // Route: ranking questions (no specific entity)
  if ((intent.ranking || intent.worst) && !parsed.team && !parsed.player) return answerRankingQuestion(context);

  // Route: entity-specific questions
  if (parsed.team) return answerTeamQuestion(parsed.team, context);
  if (parsed.player) return answerPlayerQuestion(parsed.player, context);
  if (parsed.division) return answerDivisionQuestion(parsed.division, context);

  // Route: general/league-wide
  return answerLeagueQuestion(context);
}

// ============================================================
// Answer Builders — each generates a rich, contextual response
// ============================================================

function answerTeamQuestion(teamName, ctx) {
  var division = findTeamDivision(teamName);
  var conference = division ? DIVISION_CONFERENCE[division] : "";
  var divTeams = division ? DIVISION_TEAMS[division] : [];
  var intent = ctx.intent;

  var r = makeResponse(["Match by Team", "Teams"]);
  addTeamFilter(r, teamName);
  addDateFilter(r, ctx.parsed);

  if (intent.homeAway) {
    r.measures = ["Total Games", "Win Rate", "Avg Score"];
    r.answer = "Great question! To see <strong>" + teamName + "</strong>'s <strong>home vs away</strong> performance:" +
      "<br><br>The <strong>Home vs Away</strong> visual on the report splits their W/L record by venue. " +
      "Once you filter the report to " + teamName + ", you'll see:" +
      "<ul class='ai-list'>" +
      "<li><strong>Home record</strong> — games played at their home court</li>" +
      "<li><strong>Away record</strong> — road game performance</li>" +
      "<li><strong>Win Rate</strong> comparison — " + formatDAX("Win Rate") + "</li>" +
      "</ul>" +
      "Home court advantage is a real factor in the NBA — teams typically win ~60% of home games league-wide.";
    r.insight = "Look at the Home vs Away visual after applying the Team filter. The split will reveal if " + teamName + " performs differently at home vs on the road.";
    r.suggestedVisuals = ["Home vs Away", "KPI Cards", "Match Schedule"];
  } else if (intent.score) {
    r.measures = ["Avg Score", "Total Games"];
    r.answer = "To analyze <strong>" + teamName + "</strong>'s <strong>scoring</strong>:" +
      "<br><br>The report tracks scoring via:" +
      "<ul class='ai-list'>" +
      "<li><strong>Avg Score</strong> — " + formatDAX("Avg Score") + " — shows their average points per game</li>" +
      "<li><strong>Match Schedule</strong> — game-by-game breakdown with <code>home_pts</code> and <code>away_pts</code></li>" +
      "<li><strong>Games Over Time</strong> — shows trend of game activity</li>" +
      "</ul>" +
      "Filter the report to <strong>" + teamName + "</strong> to see their scoring profile relative to the league average.";
    r.insight = "The Match Schedule table has individual game scores. Sort by home_pts or away_pts to find their highest/lowest scoring games.";
    r.suggestedVisuals = ["KPI Cards", "Match Schedule", "Games Over Time"];
  } else if (intent.trend) {
    r.measures = ["Total Games", "Win Rate"];
    r.answer = "To see <strong>" + teamName + "</strong>'s <strong>trend</strong> this season:" +
      "<br><br>The <strong>Games Over Time</strong> visual shows game volume across the season timeline. " +
      "Combined with the Win Rate KPI and Match Schedule, you can track:" +
      "<ul class='ai-list'>" +
      "<li><strong>Recent form</strong> — check the Match Schedule for their last few games</li>" +
      "<li><strong>Season trajectory</strong> — Games Over Time shows when they've been busiest</li>" +
      "<li><strong>Overall record</strong> — Win Rate KPI shows their season W/L percentage</li>" +
      "</ul>";
    r.insight = "Use the date slicer to narrow to recent weeks and see if " + teamName + " is trending up or down.";
    r.suggestedVisuals = ["Games Over Time", "KPI Cards", "Match Schedule"];
  } else if (intent.games || intent.count) {
    r.measures = ["Total Games"];
    r.answer = "To see <strong>how many games " + teamName + "</strong> has played:" +
      "<br><br>The <strong>Total Games</strong> KPI card shows: <code>" + escapeHtml(SEMANTIC_MODEL.measures["Total Games"].expression) + "</code>" +
      "<br><br>When filtered to " + teamName + ", this counts all their games. The <strong>Match Schedule</strong> table lists each game individually with date, opponent, and score.";
    r.insight = "NBA teams play 82 regular season games. The Total Games KPI shows how far " + teamName + " is into their schedule.";
    r.suggestedVisuals = ["KPI Cards", "Match Schedule"];
  } else if (intent.players) {
    r.measures = ["Active Players"];
    r.tables.push("nba_players");
    r.answer = "To see <strong>" + teamName + "</strong>'s <strong>roster / players</strong>:" +
      "<br><br>The <strong>Active Players</strong> KPI shows: <code>" + escapeHtml(SEMANTIC_MODEL.measures["Active Players"].expression) + "</code>" +
      "<br><br>The <code>nba_players</code> table connects to Teams via <code>team_id</code>. Filter the report to " + teamName + " and the player count will reflect their active roster." +
      "<br><br>You can also use the <strong>Player slicer</strong> to further drill down to a specific player on the team.";
    r.insight = "The nba_players table has player_name, team_id, and position columns. Use the Player slicer after filtering by team.";
    r.suggestedVisuals = ["KPI Cards"];
  } else {
    // General team question (how are they doing, season overview)
    r.measures = ["Total Games", "Win Rate", "Avg Score"];
    r.answer = "<strong>" + teamName + "</strong>" +
      (division ? " plays in the <strong>" + division + " Division</strong> (" + conference + " Conference)" : "") +
      "." +
      (divTeams.length > 0 ? " Their division rivals: " + divTeams.filter(function(t) { return t !== teamName; }).map(function(t) { return "<strong>" + t + "</strong>"; }).join(", ") + "." : "") +
      "<br><br>When you filter the report to this team, here's what you'll see:" +
      "<ul class='ai-list'>" +
      "<li><strong>Total Games</strong> — number of games played so far</li>" +
      "<li><strong>Win Rate</strong> — their W/L percentage (" + formatDAX("Win Rate") + ")</li>" +
      "<li><strong>Avg Score</strong> — average points per game</li>" +
      "<li><strong>Division Win/Loss</strong> — how they stack up against " + (division || "other") + " teams</li>" +
      "<li><strong>Home vs Away</strong> — home court vs road performance</li>" +
      "<li><strong>Games Over Time</strong> — season timeline</li>" +
      "<li><strong>Match Schedule</strong> — every game with scores and results</li>" +
      "</ul>";
    r.insight = "Select " + teamName + " in the Team slicer to see all these visuals filtered to their games.";
    r.suggestedVisuals = ["KPI Cards", "Division Win/Loss", "Home vs Away", "Games Over Time", "Match Schedule"];
  }

  return r;
}

function answerPlayerQuestion(playerName, ctx) {
  // Case-insensitive KNOWN_PLAYERS lookup
  var knownTeam = null;
  var knownKeys = Object.keys(KNOWN_PLAYERS);
  for (var ki = 0; ki < knownKeys.length; ki++) {
    if (knownKeys[ki].toLowerCase() === playerName.toLowerCase()) {
      knownTeam = KNOWN_PLAYERS[knownKeys[ki]];
      playerName = knownKeys[ki]; // normalize casing
      break;
    }
  }
  var intent = ctx.intent;

  var r = makeResponse(["Match by Team", "Teams", "nba_players"]);
  addPlayerFilter(r, playerName);
  addDateFilter(r, ctx.parsed);
  r.measures = ["Total Games", "Active Players", "Win Rate", "Avg Score"];

  // Lead with the direct answer
  if (knownTeam) {
    var div = findTeamDivision(knownTeam);
    r.answer = "<strong>" + playerName + "</strong> plays for the <strong>" + knownTeam + "</strong>" +
      (div ? " (" + div + " Division, " + DIVISION_CONFERENCE[div] + " Conference)" : "") + ".";
  } else {
    r.answer = "<strong>" + playerName + "</strong> was found in the query.";
  }

  // Add report guidance
  r.answer += "<br><br>In the report, filtering to this player shows:" +
    "<ul class='ai-list'>" +
    (knownTeam ? "<li><strong>" + knownTeam + "'s games</strong> — all matches the team played</li>" : "<li><strong>Their team's games</strong> — all matches the team played</li>") +
    "<li><strong>Win Rate</strong> — team's W/L percentage during the filtered period</li>" +
    "<li><strong>Avg Score</strong> — team's scoring average</li>" +
    "<li><strong>Match Schedule</strong> — individual game results</li>" +
    "</ul>";

  if (intent.score) {
    r.answer += "<br>Note: The current model tracks <em>team-level</em> scoring (home_pts, away_pts), not individual player stats. " +
      "The Avg Score measure shows the team's scoring when " + playerName + " is on the roster.";
    r.insight = "Individual player stats (PPG, rebounds, assists) aren't in this model yet. The data shows team games associated with " + playerName + ".";
  } else {
    r.insight = knownTeam ? playerName + " plays for " + knownTeam + ". Select this player in the Player slicer to see their team's stats." : "Select this player in the Player slicer.";
  }

  r.suggestedVisuals = ["KPI Cards", "Match Schedule", "Home vs Away"];
  return r;
}

function answerDivisionQuestion(divName, ctx) {
  var teams = DIVISION_TEAMS[divName];
  if (!teams) return makeErrorResponse("Division '" + divName + "' not found. Valid divisions: " + Object.keys(DIVISION_TEAMS).join(", "));

  var conference = DIVISION_CONFERENCE[divName];
  var intent = ctx.intent;

  var r = makeResponse(["Match by Team", "Teams"]);
  addDivisionFilter(r, divName, teams);
  addDateFilter(r, ctx.parsed);
  r.measures = ["Total Games", "Win Rate", "Avg Score"];

  r.answer = "The <strong>" + divName + " Division</strong> (" + conference + " Conference) has " + teams.length + " teams:" +
    "<ul class='ai-list'>" +
    teams.map(function(t) { return "<li><strong>" + t + "</strong></li>"; }).join("") +
    "</ul>";

  if (intent.ranking || intent.worst) {
    r.answer += "To find the <strong>" + (intent.ranking ? "best" : "weakest") + " team</strong> in the " + divName + " division:" +
      "<br>Filter the report to this division, then use the <strong>Division Win/Loss</strong> visual to compare W/L records. " +
      "You can also click through each team in the <strong>Team slicer</strong> to compare their <strong>Win Rate</strong>.";
    r.insight = "The Division Win/Loss visual shows the aggregated division view. For per-team comparison, toggle through teams using the Team slicer.";
  } else if (intent.compare) {
    r.answer += "The <strong>Division Win/Loss</strong> visual compares all divisions side by side. " +
      "Filter to " + divName + " to isolate their data, or remove the division filter to see how " + divName + " stacks up against other divisions.";
    r.insight = "View the report without a division filter to see all 6 divisions compared in the Division Win/Loss chart.";
  } else {
    r.answer += "When you filter the report to this division:" +
      "<ul class='ai-list'>" +
      "<li><strong>KPI Cards</strong> — aggregate stats across all " + teams.length + " teams</li>" +
      "<li><strong>Division Win/Loss</strong> — W/L breakdown for " + divName + "</li>" +
      "<li><strong>Games Over Time</strong> — division game volume</li>" +
      "<li><strong>Match Schedule</strong> — all games involving " + divName + " teams</li>" +
      "</ul>";
    r.insight = "Select " + divName + " in the Division slicer. All visuals will update to show only these " + teams.length + " teams.";
  }

  r.suggestedVisuals = ["Division Win/Loss", "KPI Cards", "Match Schedule"];
  return r;
}

function answerCompareTeams(teams, ctx) {
  var r = makeResponse(["Match by Team", "Teams"]);
  r.measures = ["Total Games", "Win Rate", "Avg Score"];
  addDateFilter(r, ctx.parsed);

  var team1 = teams[0], team2 = teams[1];
  var div1 = findTeamDivision(team1), div2 = findTeamDivision(team2);

  r.answer = "<strong>Comparing " + team1 + " vs " + team2 + "</strong>" +
    "<br><br>" +
    "<table class='ai-table'><thead><tr><th></th><th>" + team1 + "</th><th>" + team2 + "</th></tr></thead><tbody>" +
    "<tr><td>Division</td><td>" + (div1 || "—") + "</td><td>" + (div2 || "—") + "</td></tr>" +
    "<tr><td>Conference</td><td>" + (div1 ? DIVISION_CONFERENCE[div1] : "—") + "</td><td>" + (div2 ? DIVISION_CONFERENCE[div2] : "—") + "</td></tr>" +
    "</tbody></table>" +
    "<br>To compare these teams in the report:" +
    "<ol class='ai-list'>" +
    "<li>First, select <strong>" + team1 + "</strong> in the Team slicer and note down their KPI values (Win Rate, Avg Score, Total Games)</li>" +
    "<li>Then switch to <strong>" + team2 + "</strong> and compare the numbers</li>" +
    "<li>The <strong>Match Schedule</strong> table will show head-to-head matchups if they've played each other</li>" +
    "</ol>" +
    "<br>Key measures to compare:" +
    "<ul class='ai-list'>" +
    "<li><strong>Win Rate</strong> — " + formatDAX("Win Rate") + "</li>" +
    "<li><strong>Avg Score</strong> — " + formatDAX("Avg Score") + "</li>" +
    "<li><strong>Home vs Away</strong> — which team has better home court advantage</li>" +
    "</ul>";

  r.filterLogic.push({
    table: "Teams", column: "team_name", operator: "=", value: team1,
    dax: 'Teams[team_name] = "' + team1 + '"'
  });

  r.insight = "The report doesn't have a side-by-side comparison view. Toggle between teams in the Team slicer to compare their stats manually.";
  r.suggestedVisuals = ["KPI Cards", "Home vs Away", "Match Schedule"];
  return r;
}

function answerRankingQuestion(ctx) {
  var intent = ctx.intent;
  var r = makeResponse(["Match by Team", "Teams"]);
  r.measures = ["Total Games", "Win Rate", "Avg Score"];
  addDateFilter(r, ctx.parsed);

  var direction = intent.ranking ? "top" : "bottom";
  var isScore = intent.score;

  r.answer = "To find the <strong>" + direction + " performing teams</strong>" +
    (isScore ? " by <strong>scoring</strong>" : " by <strong>win rate</strong>") + ":" +
    "<br><br>The report's <strong>Division Win/Loss</strong> visual shows the W/L distribution across all 6 divisions " +
    "— this gives a quick read on which divisions (and their teams) are " + (intent.ranking ? "dominant" : "struggling") + "." +
    "<br><br>For team-level rankings:" +
    "<ol class='ai-list'>" +
    "<li>View the report <strong>without any team/division filter</strong> to see league-wide stats</li>" +
    "<li>Use the <strong>Division Win/Loss</strong> chart to identify the " + (intent.ranking ? "strongest" : "weakest") + " divisions</li>" +
    "<li>Then filter to that division and toggle through teams to find the " + direction + " performer</li>" +
    "</ol>" +
    "<br>The key measure to watch:<br>" +
    (isScore
      ? "<code>" + escapeHtml(SEMANTIC_MODEL.measures["Avg Score"].expression) + "</code> — average points per game"
      : "<code>" + escapeHtml(SEMANTIC_MODEL.measures["Win Rate"].expression) + "</code> — win percentage");

  r.insight = "There's no built-in ranking table in the current report. Use the slicers to toggle between teams/divisions and compare their KPI values manually.";
  r.suggestedVisuals = ["Division Win/Loss", "KPI Cards"];
  return r;
}

function answerConferenceQuestion(ctx) {
  var text = ctx.text;
  var conf = /east/i.test(text) ? "Eastern" : "Western";
  var divisions = [];
  var allTeams = [];
  for (var div in DIVISION_CONFERENCE) {
    if (DIVISION_CONFERENCE[div] === conf) {
      divisions.push(div);
      allTeams = allTeams.concat(DIVISION_TEAMS[div]);
    }
  }

  var r = makeResponse(["Match by Team", "Teams"]);
  r.measures = ["Total Games", "Win Rate", "Avg Score", "Teams"];
  addDateFilter(r, ctx.parsed);

  r.answer = "The <strong>" + conf + " Conference</strong> has " + divisions.length + " divisions and " + allTeams.length + " teams:" +
    "<br><br>" +
    divisions.map(function(d) {
      return "<strong>" + d + " Division:</strong> " + DIVISION_TEAMS[d].join(", ");
    }).join("<br>") +
    "<br><br>To view " + conf + " Conference data in the report:" +
    "<ul class='ai-list'>" +
    "<li>Use the <strong>Division slicer</strong> to select one of the " + conf + " divisions (" + divisions.join(", ") + ")</li>" +
    "<li>The <strong>Division Win/Loss</strong> visual shows all divisions — the " + conf + " divisions are " + divisions.join(", ") + "</li>" +
    "</ul>";

  r.insight = "The report doesn't have a Conference slicer directly. Filter by individual divisions to analyze " + conf + " Conference performance.";
  r.suggestedVisuals = ["Division Win/Loss", "KPI Cards"];
  return r;
}

function answerListQuestion(ctx) {
  var intent = ctx.intent;
  var text = ctx.text;
  var r = makeResponse(["Teams"]);

  if (/division/.test(text)) {
    r.answer = "The NBA has <strong>6 divisions</strong> across 2 conferences:" +
      "<br><br><strong>Eastern Conference:</strong>" +
      "<ul class='ai-list'>" +
      "<li><strong>Atlantic</strong> — " + DIVISION_TEAMS.Atlantic.join(", ") + "</li>" +
      "<li><strong>Central</strong> — " + DIVISION_TEAMS.Central.join(", ") + "</li>" +
      "<li><strong>Southeast</strong> — " + DIVISION_TEAMS.Southeast.join(", ") + "</li>" +
      "</ul>" +
      "<strong>Western Conference:</strong>" +
      "<ul class='ai-list'>" +
      "<li><strong>Northwest</strong> — " + DIVISION_TEAMS.Northwest.join(", ") + "</li>" +
      "<li><strong>Pacific</strong> — " + DIVISION_TEAMS.Pacific.join(", ") + "</li>" +
      "<li><strong>Southwest</strong> — " + DIVISION_TEAMS.Southwest.join(", ") + "</li>" +
      "</ul>";
    r.insight = "Use the Division slicer on the report to filter to any of these 6 divisions.";
  } else if (/team/.test(text)) {
    var allTeams = Object.values(DIVISION_TEAMS).flat().sort();
    r.answer = "There are <strong>30 NBA teams</strong> in the semantic model:" +
      "<br><br>" + allTeams.map(function(t) { return "<strong>" + t + "</strong>"; }).join(", ") + ".";
    r.insight = "All 30 teams are available in the Team slicer on the report.";
  } else if (/player/.test(text)) {
    var knownNames = Object.keys(KNOWN_PLAYERS).sort();
    r.answer = "The <code>nba_players</code> table contains all active NBA players. Here are some well-known players in the model:" +
      "<ul class='ai-list'>" +
      knownNames.slice(0, 15).map(function(p) { return "<li><strong>" + p + "</strong> — " + KNOWN_PLAYERS[p] + "</li>"; }).join("") +
      "</ul>" +
      "<br>Use the <strong>Player slicer</strong> on the report to search for any player.";
    r.insight = "The Active Players measure counts: " + escapeHtml(SEMANTIC_MODEL.measures["Active Players"].expression);
    r.tables.push("nba_players");
  } else if (/measure/.test(text)) {
    r.answer = "The semantic model has <strong>" + Object.keys(SEMANTIC_MODEL.measures).length + " measures</strong>:" +
      '<table class="ai-table"><thead><tr><th>Measure</th><th>Description</th><th>DAX</th></tr></thead><tbody>';
    for (var m in SEMANTIC_MODEL.measures) {
      var mInfo = SEMANTIC_MODEL.measures[m];
      r.answer += "<tr><td><strong>" + m + "</strong></td><td>" + mInfo.description + "</td><td><code>" + escapeHtml(mInfo.expression) + "</code></td></tr>";
    }
    r.answer += "</tbody></table>";
    r.insight = "These measures power the KPI cards and visuals on the report.";
  } else {
    r.answer = "The semantic model contains:" +
      "<ul class='ai-list'>" +
      "<li><strong>30 teams</strong> across 6 divisions and 2 conferences</li>" +
      "<li><strong>3 tables</strong>: Match by Team (games), Teams (team info), nba_players (roster)</li>" +
      "<li><strong>5 measures</strong>: Total Games, Win Rate, Avg Score, Teams, Active Players</li>" +
      "<li><strong>Season:</strong> Oct 21, 2025 — Apr 12, 2026</li>" +
      "</ul>" +
      "Ask me about any of these — e.g. \"list all teams\", \"list divisions\", \"what measures are available?\"";
    r.insight = "I understand the full structure of the NBA semantic model and can answer questions about any table, measure, or relationship.";
  }

  r.suggestedVisuals = [];
  return r;
}

function answerMeasureExplain(measureName, ctx) {
  var measure = SEMANTIC_MODEL.measures[measureName];
  if (!measure) return answerLeagueQuestion(ctx);

  var r = makeResponse(["Match by Team", "Teams"]);
  r.measures = [measureName];

  r.answer = "<strong>" + measureName + "</strong> — " + measure.description +
    "<br><br><strong>DAX Expression:</strong><br><code>" + escapeHtml(measure.expression) + "</code>" +
    "<br><br><strong>How it works:</strong><br>";

  if (measureName === "Win Rate") {
    r.answer += "This measure divides the number of games won (<code>'Match by Team'[result] = \"W\"</code>) by the total number of games. " +
      "A Win Rate of 0.60 means the team wins 60% of their games. " +
      "It uses the DIVIDE function to safely handle division by zero.";
  } else if (measureName === "Total Games") {
    r.answer += "Simply counts the number of rows in the Match by Team table. Each row represents one team's participation in one game. " +
      "When filtered to a specific team, it shows that team's game count.";
  } else if (measureName === "Avg Score") {
    r.answer += "Computes the average of the <code>home_pts</code> column. This gives the average points scored in home games. " +
      "When filtered to a team, it reflects that team's scoring when they're the home team.";
  } else if (measureName === "Teams") {
    r.answer += "Counts the distinct team names in the Teams table. Without filters, this returns 30 (all NBA teams). " +
      "With a division filter, it shows the count of teams in that division (typically 5).";
  } else if (measureName === "Active Players") {
    r.answer += "Counts distinct player names from the nba_players table. Shows the roster size when filtered to a team.";
  }

  r.answer += "<br><br>This measure is displayed on the <strong>KPI Cards</strong> at the top of the report.";
  r.insight = "You can see this measure update live as you apply filters on the report.";
  r.suggestedVisuals = ["KPI Cards"];
  return r;
}

function answerModelInfo(ctx) {
  var r = makeResponse(["Match by Team", "Teams", "nba_players"]);
  r.measures = Object.keys(SEMANTIC_MODEL.measures);

  r.answer = "<strong>Semantic Model Architecture</strong>" +
    "<br><br>This report is powered by a <strong>Microsoft Fabric semantic model</strong> with the following structure:" +
    "<br><br><strong>Tables:</strong>" +
    '<table class="ai-table"><thead><tr><th>Table</th><th>Description</th><th>Key Columns</th></tr></thead><tbody>';

  for (var tName in SEMANTIC_MODEL.tables) {
    var t = SEMANTIC_MODEL.tables[tName];
    var cols = Object.keys(t.columns).join(", ");
    r.answer += "<tr><td><strong>" + tName + "</strong></td><td>" + t.description + "</td><td><code>" + cols + "</code></td></tr>";
  }
  r.answer += "</tbody></table>";

  r.answer += "<br><strong>Relationships:</strong>" +
    "<ul class='ai-list'>" +
    SEMANTIC_MODEL.relationships.map(function(rel) {
      return "<li><code>" + rel.from + "</code> → <code>" + rel.to + "</code> — " + rel.description + "</li>";
    }).join("") +
    "</ul>";

  r.answer += "<br><strong>Measures:</strong>" +
    '<table class="ai-table"><thead><tr><th>Measure</th><th>DAX</th><th>Description</th></tr></thead><tbody>';
  for (var m in SEMANTIC_MODEL.measures) {
    var mInfo = SEMANTIC_MODEL.measures[m];
    r.answer += "<tr><td><strong>" + m + "</strong></td><td><code>" + escapeHtml(mInfo.expression) + "</code></td><td>" + mInfo.description + "</td></tr>";
  }
  r.answer += "</tbody></table>";

  r.insight = "The semantic model lives in Microsoft Fabric. The report reads from these tables and measures in real-time.";
  r.suggestedVisuals = [];
  return r;
}

function answerModelExplain(ctx) {
  var text = ctx.text;
  var r = makeResponse(["Match by Team", "Teams", "nba_players"]);

  // Check which specific table/column they're asking about
  for (var tName in SEMANTIC_MODEL.tables) {
    if (text.indexOf(tName.toLowerCase()) !== -1 || text.indexOf(tName.toLowerCase().replace(/ /g, "_")) !== -1) {
      var t = SEMANTIC_MODEL.tables[tName];
      r.answer = "<strong>" + tName + "</strong> — " + t.description +
        "<br><br><strong>Columns:</strong>" +
        '<table class="ai-table"><thead><tr><th>Column</th><th>Type</th><th>Description</th></tr></thead><tbody>';
      for (var col in t.columns) {
        var c = t.columns[col];
        r.answer += "<tr><td><code>" + col + "</code></td><td>" + c.type + "</td><td>" + c.description + "</td></tr>";
      }
      r.answer += "</tbody></table>";
      r.insight = "This table is part of the Fabric semantic model and can be filtered using the slicers on the report.";
      return r;
    }
  }

  // Generic model explanation
  return answerModelInfo(ctx);
}

function answerVisualInfo(ctx) {
  var r = makeResponse([]);

  r.answer = "<strong>Report Visuals</strong>" +
    "<br><br>The Power BI report contains these visuals:" +
    '<table class="ai-table"><thead><tr><th>Visual</th><th>Description</th><th>Measures Used</th></tr></thead><tbody>';

  for (var vName in SEMANTIC_MODEL.visuals) {
    var v = SEMANTIC_MODEL.visuals[vName];
    r.answer += "<tr><td><strong>" + vName + "</strong></td><td>" + v.description + "</td><td>" +
      (v.measures.length > 0 ? v.measures.map(function(m) { return "<code>" + m + "</code>"; }).join(", ") : "—") +
      "</td></tr>";
  }
  r.answer += "</tbody></table>" +
    "<br>All visuals respond to the slicers (Team, Division, Player, Date). When you apply a filter, every visual updates automatically.";

  r.insight = "Ask me about any specific visual, measure, or filter to get a detailed explanation.";
  r.suggestedVisuals = [];
  return r;
}

function answerLeagueQuestion(ctx) {
  var intent = ctx.intent;
  var r = makeResponse(["Match by Team", "Teams", "nba_players"]);
  r.measures = ["Total Games", "Win Rate", "Avg Score", "Teams", "Active Players"];
  addDateFilter(r, ctx.parsed);

  r.answer = "<strong>NBA 2025-26 Season Overview</strong>" +
    "<br><br>The league has <strong>30 teams</strong> across <strong>6 divisions</strong> and <strong>2 conferences</strong>." +
    " The regular season runs from <strong>Oct 21, 2025</strong> to <strong>Apr 12, 2026</strong>." +
    "<br><br>The report shows these key metrics:" +
    "<ul class='ai-list'>" +
    "<li><strong>Total Games</strong> — how many games have been played</li>" +
    "<li><strong>Win Rate</strong> — W/L percentage across teams (when filtered)</li>" +
    "<li><strong>Avg Score</strong> — average points per game</li>" +
    "<li><strong>Division Win/Loss</strong> — W/L breakdown by division</li>" +
    "<li><strong>Games Over Time</strong> — season activity trend</li>" +
    "<li><strong>Home vs Away</strong> — venue performance split</li>" +
    "</ul>" +
    "<br>Try asking me something specific! For example:" +
    "<ul class='ai-list'>" +
    "<li>\"How are the Lakers doing this season?\"</li>" +
    "<li>\"Compare Celtics vs Warriors\"</li>" +
    "<li>\"Which division is the strongest?\"</li>" +
    "<li>\"What is the Win Rate measure?\"</li>" +
    "<li>\"Show me all teams in the Pacific division\"</li>" +
    "<li>\"LeBron James games last 7 days\"</li>" +
    "</ul>";

  r.insight = "I'm connected to the Fabric semantic model. Ask me about teams, divisions, players, measures, or how the data model works.";
  r.suggestedVisuals = ["KPI Cards", "Division Win/Loss", "Games Over Time", "Home vs Away"];
  return r;
}

// ============================================================
// Helpers
// ============================================================

function makeResponse(tables) {
  return {
    answer: "",
    insight: "",
    filterLogic: [],
    measures: [],
    tables: tables,
    suggestedVisuals: []
  };
}

function makeErrorResponse(message) {
  return { answer: message, insight: "", filterLogic: [], measures: [], tables: [], suggestedVisuals: [] };
}

function addTeamFilter(r, teamName) {
  r.filterLogic.push({
    table: "Teams", column: "team_name", operator: "=", value: teamName,
    dax: 'Teams[team_name] = "' + teamName + '"'
  });
}

function addPlayerFilter(r, playerName) {
  r.filterLogic.push({
    table: "nba_players", column: "player_name", operator: "=", value: playerName,
    dax: 'nba_players[player_name] = "' + playerName + '"'
  });
}

function addDivisionFilter(r, divName, teams) {
  r.filterLogic.push({
    table: "Teams", column: "Division", operator: "in", value: teams.join(", "),
    dax: "Teams[Division] = \"" + divName + "\""
  });
}

function addDateFilter(r, parsed) {
  if (parsed.dateRange) {
    r.filterLogic.push({
      table: "Match by Team", column: "game_date", operator: "between",
      value: parsed.dateRange.start + " to " + parsed.dateRange.end,
      dax: "'Match by Team'[game_date] >= DATE(" + parsed.dateRange.start.replace(/-/g, ",") + ") && 'Match by Team'[game_date] <= DATE(" + parsed.dateRange.end.replace(/-/g, ",") + ")"
    });
  }
}

function findTeamDivision(teamName) {
  for (var div in DIVISION_TEAMS) {
    if (DIVISION_TEAMS[div].indexOf(teamName) !== -1) return div;
  }
  return null;
}

function findMultipleTeams(text) {
  var allTeams = Object.values(DIVISION_TEAMS).flat();
  var found = [];
  for (var i = 0; i < allTeams.length; i++) {
    var team = allTeams[i];
    var parts = team.split(" ");
    var nickname = parts[parts.length - 1].toLowerCase();
    var city = parts.slice(0, -1).join(" ").toLowerCase();
    if (text.indexOf(team.toLowerCase()) !== -1 || text.indexOf(nickname) !== -1 || text.indexOf(city) !== -1) {
      if (found.indexOf(team) === -1) found.push(team);
    }
  }
  return found;
}

function matchMeasureQuestion(text) {
  var measureNames = Object.keys(SEMANTIC_MODEL.measures);
  for (var i = 0; i < measureNames.length; i++) {
    if (text.indexOf(measureNames[i].toLowerCase()) !== -1) return measureNames[i];
  }
  // Fuzzy matching
  if (/win\s*rate/.test(text)) return "Win Rate";
  if (/total\s*games/.test(text)) return "Total Games";
  if (/avg\s*score|average\s*score/.test(text)) return "Avg Score";
  if (/active\s*players/.test(text)) return "Active Players";
  return null;
}

function formatDAX(measureName) {
  var m = SEMANTIC_MODEL.measures[measureName];
  return m ? "<code>" + escapeHtml(m.expression) + "</code>" : "";
}

// ============================================================
// Render AI Response Card
// ============================================================

function renderSemanticResponse(response, parsed, targetEl) {
  var html = '<div class="ai-response-card">';

  // Answer section
  var srcMap = { "live-db": ["gemini-live", "Live Data"], "live-db-raw": ["gemini-live", "Live Data (Raw)"], "gemini-live": ["gemini-live", "Gemini Live"], "gemini": ["gemini", "Gemini"] };
  var srcInfo = srcMap[response.source] || ["offline", "Offline AI"];
  var sourceClass = srcInfo[0];
  var sourceLabel = srcInfo[1];
  html += '<div class="ai-answer-section">';
  html += '<div class="ai-answer-header"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00d4aa" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg> <span>AI Analysis</span><span class="ai-source-label ' + sourceClass + '">' + sourceLabel + '</span></div>';
  html += '<div class="ai-answer-body">' + response.answer + '</div>';
  if (response.insight) {
    html += '<div class="ai-insight"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f0c000" stroke-width="2"><path d="M12 2a4 4 0 0 1 4 4c0 2-2 3-2 5h-4c0-2-2-3-2-5a4 4 0 0 1 4-4z"/><line x1="10" y1="17" x2="14" y2="17"/></svg> ' + response.insight + '</div>';
  }
  var showQuery = response.sqlQuery || response.daxQuery;
  if (showQuery) {
    html += '<details class="guide-dax-details"><summary>View SQL Query</summary><pre class="guide-dax-code">' + showQuery.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;") + '</pre></details>';
  }
  html += '</div>';

  // Suggested visuals
  if (response.suggestedVisuals && response.suggestedVisuals.length > 0) {
    html += '<div class="ai-semantic-section">';
    html += '<div class="ai-section-title">Look at these visuals on the report</div>';
    html += '<div class="ai-ref-value" style="display:flex;flex-wrap:wrap;gap:.375rem">';
    response.suggestedVisuals.forEach(function(v) {
      html += '<code style="background:rgba(56,139,253,.1);border-color:rgba(56,139,253,.2);color:#388bfd">' + v + '</code>';
    });
    html += '</div></div>';
  }

  // Semantic Model Reference
  if (response.tables.length > 0 || response.measures.length > 0) {
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
  }

  // Filter Logic
  if (response.filterLogic.length > 0) {
    html += '<div class="ai-filter-section">';
    html += '<div class="ai-section-title">Filter Logic</div>';
    html += '<div class="ai-filter-code">';
    response.filterLogic.forEach(function(f) {
      html += '<div class="ai-filter-line"><code class="ai-dax">' + escapeHtml(f.sql || f.dax || '') + '</code></div>';
    });
    html += '</div></div>';
  }

  // Action buttons
  html += '<div class="ai-actions">';
  if (parsed.matched.length > 0) {
    html += '<button class="btn btn-primary btn-sm" onclick="viewReport()"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg> View Report</button>';
  }
  if (response.filterLogic.length > 0) {
    html += '<button class="btn btn-ghost btn-sm ai-copy-btn" onclick="copyFilterLogic(this)" data-filters=\'' + escapeHtml(JSON.stringify(response.filterLogic)) + '\'><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy SQL</button>';
  }
  html += '</div>';

  html += '</div>';

  targetEl.innerHTML = html;
  targetEl.style.display = "block";
  targetEl.className = targetEl.className.replace(/\bloading\b/, "").replace(/\berror\b/, "").replace(/\bsuccess\b/, "");

  // Store the AI response for the report guide panel
  try {
    sessionStorage.setItem("aiResponse", JSON.stringify({
      answer: response.answer,
      insight: response.insight,
      suggestedVisuals: response.suggestedVisuals || [],
      measures: response.measures,
      filterLogic: response.filterLogic
    }));
    localStorage.setItem("aiResponse", JSON.stringify({
      answer: response.answer,
      insight: response.insight,
      suggestedVisuals: response.suggestedVisuals || [],
      measures: response.measures,
      filterLogic: response.filterLogic
    }));
  } catch (e) { /* storage full */ }
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
