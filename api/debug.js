// Debug endpoint — test service principal token and PBI access
// GET /api/debug  (remove this after testing)

const TENANT_ID = process.env.AZURE_TENANT_ID;
const CLIENT_ID = process.env.AZURE_CLIENT_ID;
const CLIENT_SECRET = process.env.AZURE_CLIENT_SECRET;
const PBI_GROUP_ID = process.env.PBI_GROUP_ID;
const PBI_DATASET_ID = process.env.PBI_DATASET_ID;

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const results = { steps: [] };

  // Step 1: Check env vars
  results.steps.push({
    step: "Environment variables",
    AZURE_TENANT_ID: TENANT_ID ? "SET (" + TENANT_ID.slice(0, 8) + "...)" : "MISSING",
    AZURE_CLIENT_ID: CLIENT_ID ? "SET (" + CLIENT_ID.slice(0, 8) + "...)" : "MISSING",
    AZURE_CLIENT_SECRET: CLIENT_SECRET ? "SET (length=" + CLIENT_SECRET.length + ")" : "MISSING",
    PBI_GROUP_ID: PBI_GROUP_ID ? "SET (" + PBI_GROUP_ID.slice(0, 8) + "...)" : "MISSING",
    PBI_DATASET_ID: PBI_DATASET_ID ? "SET (" + PBI_DATASET_ID.slice(0, 8) + "...)" : "MISSING"
  });

  try {
    // Step 2: Get token
    const tokenUrl = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`;
    const params = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      scope: "https://analysis.windows.net/powerbi/api/.default"
    });

    const tokenRes = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString()
    });

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok) {
      results.steps.push({ step: "Token acquisition", status: "FAILED", error: tokenData });
      return res.status(200).json(results);
    }

    results.steps.push({ step: "Token acquisition", status: "OK", tokenLength: tokenData.access_token?.length });

    const token = tokenData.access_token;

    // Step 3: List groups (workspaces)
    const groupsRes = await fetch("https://api.powerbi.com/v1.0/myorg/groups", {
      headers: { "Authorization": "Bearer " + token }
    });
    const groupsData = await groupsRes.json();
    results.steps.push({
      step: "List workspaces",
      status: groupsRes.ok ? "OK" : "FAILED (" + groupsRes.status + ")",
      workspaces: groupsRes.ok ? (groupsData.value || []).map(g => ({ id: g.id, name: g.name })) : groupsData
    });

    // Step 4: List datasets in the target workspace
    const dsRes = await fetch(`https://api.powerbi.com/v1.0/myorg/groups/${PBI_GROUP_ID}/datasets`, {
      headers: { "Authorization": "Bearer " + token }
    });
    const dsData = await dsRes.json();
    results.steps.push({
      step: "List datasets in workspace",
      status: dsRes.ok ? "OK" : "FAILED (" + dsRes.status + ")",
      datasets: dsRes.ok ? (dsData.value || []).map(d => ({ id: d.id, name: d.name })) : dsData
    });

    // Step 5: Try executeQueries
    const daxRes = await fetch(`https://api.powerbi.com/v1.0/myorg/groups/${PBI_GROUP_ID}/datasets/${PBI_DATASET_ID}/executeQueries`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + token
      },
      body: JSON.stringify({
        queries: [{ query: "EVALUATE ROW(\"test\", 1)" }],
        serializerSettings: { includeNulls: true }
      })
    });
    const daxData = await daxRes.text();
    results.steps.push({
      step: "Execute DAX query",
      status: daxRes.ok ? "OK" : "FAILED (" + daxRes.status + ")",
      response: daxData.slice(0, 500)
    });

  } catch (err) {
    results.steps.push({ step: "Unexpected error", error: err.message });
  }

  return res.status(200).json(results);
};
