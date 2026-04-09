// Vercel Serverless Function — Execute SQL queries against PostgreSQL (Neon)
// POST /api/query  { query: "SELECT ..." }

const { Pool } = require("pg");

// Connection pool (reused across invocations in the same Vercel instance)
let pool;
function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 5,
      idleTimeoutMillis: 30000
    });
  }
  return pool;
}

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

// Validate that the query is read-only (SELECT only)
function isReadOnlySQL(query) {
  if (!query || typeof query !== "string") return false;
  const trimmed = query.trim().toUpperCase();

  // Must start with SELECT or WITH (for CTEs)
  if (!trimmed.startsWith("SELECT") && !trimmed.startsWith("WITH")) return false;

  // Block any write/DDL/admin operations
  const blocked = /\b(DROP|DELETE|INSERT|UPDATE|ALTER|CREATE|EXEC|EXECUTE|TRUNCATE|GRANT|REVOKE|COPY|VACUUM|REINDEX|CLUSTER|COMMENT|LOCK|SET\s+ROLE|REASSIGN|SECURITY)\b/i;
  if (blocked.test(query)) return false;

  // Block semicolons that could enable multi-statement injection
  // Allow only the trailing semicolon
  const withoutTrailing = query.trim().replace(/;\s*$/, "");
  if (withoutTrailing.includes(";")) return false;

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

  // Set CORS headers
  Object.entries(cors).forEach(([key, value]) => res.setHeader(key, value));

  // Check env var
  if (!process.env.DATABASE_URL) {
    return res.status(500).json({ error: "Server not configured. Missing DATABASE_URL environment variable." });
  }

  try {
    const { query } = req.body || {};

    if (!query) {
      return res.status(400).json({ error: "Missing 'query' in request body" });
    }

    if (!isReadOnlySQL(query)) {
      return res.status(400).json({ error: "Invalid query. Only SELECT statements are allowed." });
    }

    // Execute with a statement timeout to prevent long-running queries
    const client = await getPool().connect();
    try {
      await client.query("SET statement_timeout = '10s'");
      const result = await client.query(query);
      const rows = result.rows || [];
      return res.status(200).json({ rows, rowCount: rows.length });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("[/api/query] Error:", err.message, "| Query:", (req.body && req.body.query || "").slice(0, 200));

    // Return enough detail for debugging while not leaking internals
    const safeMessage = err.message.includes("statement_timeout")
      ? "Query timed out (10s limit)"
      : err.message.includes("syntax")
        ? "SQL syntax error: " + err.message.slice(0, 200)
        : err.message.includes("does not exist")
          ? "SQL error: " + err.message.slice(0, 200)
          : err.message.includes("column")
            ? "SQL error: " + err.message.slice(0, 200)
            : "Query execution failed: " + err.message.slice(0, 200);

    return res.status(500).json({ error: safeMessage });
  }
};
