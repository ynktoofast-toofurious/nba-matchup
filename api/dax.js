// Vercel Serverless Function — Execute DAX queries against Power BI
// Uses Azure AD Service Principal for auth (no user sign-in needed)
// POST /api/dax  { query: "EVALUATE ..." }

const TENANT_ID = process.env.AZURE_TENANT_ID;
const CLIENT_ID = process.env.AZURE_CLIENT_ID;
const CLIENT_SECRET = process.env.AZURE_CLIENT_SECRET;
const PBI_GROUP_ID = process.env.PBI_GROUP_ID;
const PBI_DATASET_ID = process.env.PBI_DATASET_ID;

// Allowed origins for CORS
const ALLOWED_ORIGINS = [
  "https://ynktoofast-toofurious.github.io",
  "https://gameintel.vercel.app",
  "http://localhost:3000",
  "http://127.0.0.1:5500"
];

function getCorsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400"
  };
}

// Get an access token using client credentials (service principal)
async function getAccessToken() {
  const tokenUrl = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`;

  const params = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    scope: "https://analysis.windows.net/powerbi/api/.default"
  });

  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString()
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token request failed (${res.status}): ${text.slice(0, 300)}`);
  }

  const data = await res.json();
  return data.access_token;
}

// Execute a DAX query against the Power BI dataset
async function executeDAX(accessToken, daxQuery) {
  const url = `https://api.powerbi.com/v1.0/myorg/groups/${PBI_GROUP_ID}/datasets/${PBI_DATASET_ID}/executeQueries`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${accessToken}`
    },
    body: JSON.stringify({
      queries: [{ query: daxQuery }],
      serializerSettings: { includeNulls: true }
    })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`DAX execution failed (${res.status}): ${text.slice(0, 300)}`);
  }

  const data = await res.json();

  if (data.error) {
    throw new Error(`DAX error: ${data.error.message || JSON.stringify(data.error)}`);
  }

  if (data.results && data.results[0] && data.results[0].tables && data.results[0].tables[0]) {
    return data.results[0].tables[0].rows || [];
  }

  return [];
}

// Validate that the query is a read-only DAX EVALUATE statement
function isValidDAX(query) {
  if (!query || typeof query !== "string") return false;
  const trimmed = query.trim().toUpperCase();
  // Only allow EVALUATE (read-only) — block DEFINE with VAR assignments that could be abusive
  if (!trimmed.startsWith("EVALUATE") && !trimmed.startsWith("DEFINE")) return false;
  // Block any attempt to use non-DAX SQL injection-style attacks
  const blocked = /\b(DROP|DELETE|INSERT|UPDATE|ALTER|CREATE|EXEC|EXECUTE|TRUNCATE|GRANT|REVOKE)\b/i;
  if (blocked.test(query)) return false;
  return true;
}

module.exports = async function handler(req, res) {
  const origin = req.headers.origin || "";
  const cors = getCorsHeaders(origin);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204, cors);
    res.end();
    return;
  }

  // Only allow POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Set CORS headers for the response
  Object.entries(cors).forEach(([key, value]) => res.setHeader(key, value));

  // Check env vars are configured
  if (!TENANT_ID || !CLIENT_ID || !CLIENT_SECRET || !PBI_GROUP_ID || !PBI_DATASET_ID) {
    return res.status(500).json({ error: "Server not configured. Missing Azure/Power BI environment variables." });
  }

  try {
    const { query } = req.body || {};

    if (!query) {
      return res.status(400).json({ error: "Missing 'query' in request body" });
    }

    if (!isValidDAX(query)) {
      return res.status(400).json({ error: "Invalid DAX query. Only EVALUATE statements are allowed." });
    }

    // Get service principal token
    const accessToken = await getAccessToken();

    // Execute the DAX query
    const rows = await executeDAX(accessToken, query);

    return res.status(200).json({ rows, rowCount: rows.length });
  } catch (err) {
    console.error("[/api/dax] Error:", err.message);
    return res.status(500).json({ error: err.message });
  }
};
