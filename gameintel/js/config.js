// ============================================================
// Configuration — Fill in your Azure AD + Power BI details
// ============================================================
const CONFIG = {
  // Azure AD / Microsoft Entra ID
  auth: {
    clientId: "395122c6-d002-4a97-b407-4fab7a285372",
    authority: "https://login.microsoftonline.com/157d5729-065c-4586-8098-4bd2c7cc32ab",
    redirectUri: window.location.origin + "/gameintel/gameintel/index.html",
    scopes: [
      "https://analysis.windows.net/powerbi/api/Report.Read.All",
      "https://analysis.windows.net/powerbi/api/Dataset.Read.All"
    ]
  },

  // Azure AD tenant for Power BI auto-sign-in
  tenant: {
    domain: "veenkongologmail.onmicrosoft.com",
    loginHint: "PowerBI@veenkongologmail.onmicrosoft.com"
  },

  // Power BI Embed
  powerbi: {
    reportId: "c8fa7b41-d7db-45f4-bd62-b18e49ba90cd",
    groupId: "2648337b-b32f-42ab-a1b9-576f27be4c5e",
    pageId: "7eb1f7b21fcf5ca5bdfe",
    // Standard report URL — supports URL filtering (user must be signed into PBI)
    reportUrl: "https://app.powerbi.com/groups/2648337b-b32f-42ab-a1b9-576f27be4c5e/reports/c8fa7b41-d7db-45f4-bd62-b18e49ba90cd/7eb1f7b21fcf5ca5bdfe",
    // Public embed URL — fallback, no filters supported
    publicEmbedUrl: "https://app.powerbi.com/view?r=eyJrIjoiYmQxMjU1ZDEtNDkyNC00Y2E5LWIyMDItZDQ4Y2VlZTI3MWI5IiwidCI6IjE1N2Q1NzI5LTA2NWMtNDU4Ni04MDk4LTRiZDJjN2NjMzJhYiJ9"
  },

  // Report filter table/column mappings (must match PBIP semantic model exactly)
  filters: {
    dateRange: {
      table: "Match by Team",
      column: "game_date"
    },
    team: {
      table: "Teams",
      column: "team_name"
    },
    player: {
      table: "nba_players",
      column: "player_name"
    }
  },

  // Division options for the filter dropdown
  divisions: [
    "Atlantic",
    "Central",
    "Southeast",
    "Northwest",
    "Pacific",
    "Southwest"
  ],

  // NBA Teams grouped by division (for cascading filters)
  teamsByDivision: {
    Atlantic: ["Boston Celtics", "Brooklyn Nets", "New York Knicks", "Philadelphia 76ers", "Toronto Raptors"],
    Central: ["Chicago Bulls", "Cleveland Cavaliers", "Detroit Pistons", "Indiana Pacers", "Milwaukee Bucks"],
    Southeast: ["Atlanta Hawks", "Charlotte Hornets", "Miami Heat", "Orlando Magic", "Washington Wizards"],
    Northwest: ["Denver Nuggets", "Minnesota Timberwolves", "Oklahoma City Thunder", "Portland Trail Blazers", "Utah Jazz"],
    Pacific: ["Golden State Warriors", "LA Clippers", "Los Angeles Lakers", "Phoenix Suns", "Sacramento Kings"],
    Southwest: ["Dallas Mavericks", "Houston Rockets", "Memphis Grizzlies", "New Orleans Pelicans", "San Antonio Spurs"]
  }
};