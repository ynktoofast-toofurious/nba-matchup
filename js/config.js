// ============================================================
// Configuration — Fill in your Azure AD + Power BI details
// ============================================================
const CONFIG = {
  // Azure AD / Microsoft Entra ID
  auth: {
    clientId: "YOUR_CLIENT_ID",            // Application (client) ID from Azure AD app registration
    authority: "https://login.microsoftonline.com/YOUR_TENANT_ID", // Replace YOUR_TENANT_ID
    redirectUri: window.location.origin + "/index.html",
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
    publicEmbedUrl: "https://app.powerbi.com/view?r=eyJrIjoiYmQxMjU1ZDEtNDkyNC00Y2E5LWIyMDItZDQ4Y2VlZTI3MWI5IiwidCI6IjE1N2Q1NzI5LTA2NWMtNDU4Ni04MDk4LTRiZDJjN2NjMzJhYiJ9"
  },

  // Report filter table/column mappings (match your Power BI model)
  filters: {
    dateRange: {
      table: "Calendar",          // Table name in your PBI model
      column: "Date"              // Column name for the date field
    },
    division: {
      table: "Teams",
      column: "Division"
    },
    team: {
      table: "Teams",
      column: "Team"
    },
    player: {
      table: "Players",
      column: "Player"
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
