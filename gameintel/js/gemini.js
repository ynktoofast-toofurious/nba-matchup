// ============================================================
// Gemini LLM Integration — Live AI Q&A with SQL Execution
// Flow: User Question → LLM generates SQL → Execute against
// PostgreSQL Database → LLM interprets real results
// ============================================================

var GeminiAI = (function() {

  var GEMINI_MODELS = [
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
    "gemini-2.5-pro"
  ];
  var GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models/";
  var GEMINI_STORAGE_KEY = "gemini_api_key";
  var GROQ_STORAGE_KEY = "groq_api_key";
  var GROQ_MODEL_KEY = "groq_model";
  var PROVIDER_KEY = "ai_provider"; // "gemini" or "groq"
  var GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
  var GROQ_MODELS = [
    { id: "llama-3.3-70b-versatile", label: "Llama 3.3 70B" },
    { id: "llama-3.1-8b-instant",    label: "Llama 3.1 8B (Fast)" },
    { id: "mixtral-8x7b-32768",      label: "Mixtral 8x7B" }
  ];
  var MAX_RETRIES = 2;
  var RETRY_DELAY_MS = 5000;

  // ============================================================
  // System Prompts
  // ============================================================

  function buildModelSchema() {
    var s = SEMANTIC_MODEL;
    var schema = "";
    schema += "Season: " + s.season.start + " to " + s.season.end + "\n";
    schema += "League: 30 teams, 6 divisions, 2 conferences\n\n";

    schema += "TABLES (PostgreSQL):\n";
    for (var tName in s.tables) {
      var t = s.tables[tName];
      schema += "- \"" + tName + "\": " + t.description + "\n";
      schema += "  Columns: ";
      var cols = [];
      for (var c in t.columns) {
        cols.push(tName + "." + c + " (" + t.columns[c].type + " — " + t.columns[c].description + ")");
      }
      schema += cols.join(", ") + "\n";
    }

    schema += "\nCOMMON AGGREGATIONS:\n";
    for (var mName in s.measures) {
      var m = s.measures[mName];
      schema += "- " + mName + ": " + m.description + "\n";
    }

    schema += "\nRELATIONSHIPS (JOIN keys):\n";
    s.relationships.forEach(function(r) {
      schema += "- " + r.from + " = " + r.to + "\n";
    });

    schema += "\nDIVISIONS & TEAMS:\n";
    for (var div in DIVISION_TEAMS) {
      schema += "- " + div + " (" + DIVISION_CONFERENCE[div] + "): " + DIVISION_TEAMS[div].join(", ") + "\n";
    }

    return schema;
  }

  // Prompt for Step 1: Generate SQL query
  function buildSqlPrompt() {
    return "You are a PostgreSQL query generator for an NBA analytics database.\n" +
      "Given a user's natural language question, generate a valid PostgreSQL SELECT query.\n\n" +
      "RULES:\n" +
      "- Return ONLY the SQL query, no explanation, no markdown fences.\n" +
      "- Use double quotes around table names with spaces: \"Match by Team\"\n" +
      "- All column names are lowercase — do NOT quote column names.\n" +
      "- Use standard PostgreSQL syntax: JOIN, WHERE, GROUP BY, ORDER BY, LIMIT.\n" +
      "- Limit results to 25 rows max using LIMIT.\n" +
      "- For win rate, use: COUNT(*) FILTER (WHERE result = 'W')::float / COUNT(*)\n" +
      "- For home/away team win rate questions, include both wins and total games in output (e.g., home_wins, home_games, home_win_rate).\n" +
      "- IMPORTANT RESULT SEMANTICS: in \"Match by Team\", result is from the HOME TEAM perspective for that row.\n" +
      "- Therefore for an AWAY team's wins, use rows where away_team = target and result = 'L'.\n" +
      "- For scores, home_pts and away_pts are in \"Match by Team\".\n" +
      "- The result column values are 'W' or 'L'.\n" +
      "- Use JOIN to connect tables (see relationships below).\n" +
      "- Example JOIN: SELECT * FROM \"Match by Team\" m JOIN \"Teams\" t ON m.home_team = t.team_name\n" +
      "- If the question is about schema/metadata (not data), return exactly: NO_SQL_NEEDED\n" +
      "- If the question is conversational/greeting, return exactly: NO_SQL_NEEDED\n\n" +
      "DATABASE SCHEMA:\n" + buildModelSchema();
  }

  // Prompt for Step 2: Interpret results
  function buildAnswerPrompt() {
    return "You are an expert NBA analytics AI assistant in a Power BI dashboard called YNKIntel.\n" +
      "You have been given LIVE DATA from the PostgreSQL database.\n" +
      "Answer the user's question using the REAL DATA provided.\n\n" +
      "RULES:\n" +
      "- Use the actual numbers from the data — these are REAL, not estimates.\n" +
      "- Be concise, confident, data-driven. Lead with the key insight.\n" +
      "- For win-rate answers, include sample size (wins and games) to avoid overinterpreting small samples.\n" +
      "- If the sample size is small (fewer than 10 games), explicitly say the sample is small.\n" +
      "- Format with HTML: <strong> for emphasis, <ul><li> for lists, <code> for column/measure names.\n" +
      "- Format percentages to 1 decimal place, numbers with commas.\n" +
      "- After presenting data, suggest which report visuals to explore for more detail.\n" +
      "- If data seems incomplete, note it and suggest adjusting filters.\n" +
      "- Do NOT use markdown. Use only HTML tags.\n\n" +
      "REPORT VISUALS AVAILABLE:\n" +
      "- KPI Cards (Total Games, Win Rate, Avg Score, Teams, Active Players)\n" +
      "- Division Win/Loss (bar chart by division)\n" +
      "- Games Over Time (line chart by date)\n" +
      "- Home vs Away (split comparison)\n" +
      "- Match Schedule (game-by-game table)\n" +
      "- Team/Division/Player Slicers\n\n" +
      "DATABASE SCHEMA:\n" + buildModelSchema();
  }

  // Fallback prompt (no SQL, just model knowledge)
  function buildFallbackPrompt() {
    return "You are an expert NBA analytics AI assistant embedded in a Power BI dashboard called YNKIntel.\n" +
      "IMPORTANT: The SQL query for the user's question could not be executed successfully.\n" +
      "Answer as best you can using your knowledge of the data model.\n" +
      "For specific stats or scores, mention you can answer general questions about the model and suggest they rephrase.\n" +
      "You CAN answer general questions about the data model structure, divisions, conferences, and available data.\n" +
      "Do NOT guess or make up player-team assignments — the dataset may differ from public knowledge.\n" +
      "Be concise, confident. Use HTML tags (no markdown).\n" +
      "Format: <strong> for emphasis, <ul><li> for lists, <code> for column names.\n\n" +
      "DATABASE SCHEMA:\n" + buildModelSchema();
  }

  // ============================================================
  // Gemini API Call — with retry + model fallback
  // ============================================================

  function wait(ms) {
    return new Promise(function(resolve) { setTimeout(resolve, ms); });
  }

  // Extract retry delay from error message (e.g. "retry in 46.4s")
  function parseRetryDelay(errMsg) {
    var match = errMsg.match(/retry\s+in\s+([\d.]+)s/i);
    if (match) return Math.ceil(parseFloat(match[1]) * 1000);
    return RETRY_DELAY_MS;
  }

  function callGeminiWithModel(model, systemPrompt, userMessage, opts) {
    var apiKey = getGeminiKey();
    var url = GEMINI_BASE_URL + model + ":generateContent?key=" + apiKey;

    var config = {
      temperature: (opts && opts.temperature) || 0.7,
      maxOutputTokens: (opts && opts.maxTokens) || 1024
    };

    var body = {
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ parts: [{ text: userMessage }] }],
      generationConfig: config
    };

    return fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    })
    .then(function(res) {
      if (!res.ok) {
        return res.json().then(function(err) {
          var msg = (err.error && err.error.message) || "API returned " + res.status;
          var error = new Error(msg);
          error.status = res.status;
          error.isRateLimit = (res.status === 429 || msg.toLowerCase().indexOf("quota") !== -1);
          throw error;
        });
      }
      return res.json();
    })
    .then(function(data) {
      var text = "";
      if (data.candidates && data.candidates[0] && data.candidates[0].content) {
        text = data.candidates[0].content.parts.map(function(p) { return p.text || ""; }).join("");
      }
      if (!text) throw new Error("Empty response from Gemini");
      return text;
    });
  }

  // Try each model in order; on rate limit, wait and try next model
  function callGemini(systemPrompt, userMessage, opts) {
    var apiKey = getGeminiKey();
    if (!apiKey) return Promise.reject(new Error("No Gemini API key configured"));

    var modelIndex = 0;
    var attempt = 0;

    function tryNext(lastErr) {
      if (modelIndex >= GEMINI_MODELS.length) {
        // All models exhausted — retry from first model after delay
        if (attempt < MAX_RETRIES) {
          attempt++;
          modelIndex = 0;
          var delay = lastErr ? parseRetryDelay(lastErr.message) : RETRY_DELAY_MS;
          console.log("[GeminiAI] All models rate-limited. Retry " + attempt + "/" + MAX_RETRIES + " in " + (delay / 1000) + "s...");
          return wait(delay).then(function() { return tryNext(null); });
        }
        return Promise.reject(lastErr || new Error("All Gemini models exhausted after retries"));
      }

      var model = GEMINI_MODELS[modelIndex];
      console.log("[GeminiAI] Trying model:", model, "(attempt " + (attempt + 1) + ")");

      return callGeminiWithModel(model, systemPrompt, userMessage, opts)
        .catch(function(err) {
          if (err.isRateLimit) {
            console.warn("[GeminiAI]", model, "rate limited:", err.message);
            modelIndex++;
            return tryNext(err);
          }
          // Non-rate-limit error — propagate immediately
          throw err;
        });
    }

    return tryNext(null);
  }

  // ============================================================
  // Groq API Call
  // ============================================================

  function callGroq(systemPrompt, userMessage, opts) {
    var apiKey = getGroqKey();
    if (!apiKey) return Promise.reject(new Error("No Groq API key configured"));

    var model = getGroqModel();
    console.log("[GroqAI] Calling model:", model);

    return fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + apiKey
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage }
        ],
        temperature: (opts && opts.temperature) || 0.7,
        max_tokens: (opts && opts.maxTokens) || 1024
      })
    })
    .then(function(res) {
      if (!res.ok) {
        return res.json().then(function(err) {
          throw new Error((err.error && err.error.message) || "Groq API error " + res.status);
        });
      }
      return res.json();
    })
    .then(function(data) {
      var text = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
      if (!text) throw new Error("Empty response from Groq");
      return text;
    });
  }

  // Unified call — routes to active provider
  function callAI(systemPrompt, userMessage, opts) {
    var provider = getProvider();
    if (provider === "groq" && getGroqKey()) {
      return callGroq(systemPrompt, userMessage, opts);
    }
    return callGemini(systemPrompt, userMessage, opts);
  }

  // ============================================================
  // SQL Execution via Vercel Backend (PostgreSQL)
  // ============================================================

  var SQL_API_URL = (typeof CONFIG !== "undefined" && CONFIG.api && CONFIG.api.queryEndpoint)
    ? CONFIG.api.queryEndpoint
    : "https://gameintel.vercel.app/api/query";

  function executeSQL(sqlQuery) {
    return fetch(SQL_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: sqlQuery })
    })
    .then(function(res) {
      if (!res.ok) {
        return res.json().then(function(data) {
          throw new Error(data.error || "SQL execution failed (" + res.status + ")");
        }).catch(function(parseErr) {
          if (parseErr.message.indexOf("SQL") !== -1) throw parseErr;
          throw new Error("SQL execution failed (" + res.status + ")");
        });
      }
      return res.json();
    })
    .then(function(data) {
      if (data.error) throw new Error("SQL error: " + data.error);
      return data.rows || [];
    });
  }

  // Format DAX results as a readable text table
  function formatResults(rows) {
    if (!rows || rows.length === 0) return "No data returned.";
    var columns = Object.keys(rows[0]);
    var lines = [];
    // Header
    lines.push(columns.join(" | "));
    lines.push(columns.map(function() { return "---"; }).join(" | "));
    // Rows (cap at 25)
    var limit = Math.min(rows.length, 25);
    for (var i = 0; i < limit; i++) {
      var vals = columns.map(function(c) {
        var v = rows[i][c];
        if (v === null || v === undefined) return "—";
        if (typeof v === "number") return (v % 1 !== 0) ? v.toFixed(4) : String(v);
        return String(v);
      });
      lines.push(vals.join(" | "));
    }
    if (rows.length > 25) lines.push("... (" + rows.length + " total rows, showing first 25)");
    return lines.join("\n");
  }

  // ============================================================
  // Main Query Pipeline
  // ============================================================

  // Full pipeline: Question → SQL → Execute → Interpret
  function queryStructured(userMessage, parsed) {
    try {
      console.log("[GeminiAI] Starting query pipeline. API key:", isAvailable() ? "YES" : "NO", "Backend:", SQL_API_URL);

      // Step 1: Ask AI to generate a SQL query
      console.log("[GeminiAI] Step 1: Asking AI to generate SQL...");
      return callAI(buildSqlPrompt(), userMessage, { temperature: 0.2, maxTokens: 512 })
        .then(function(sqlResponse) {
          var sql = sqlResponse.trim().replace(/^```[\s\S]*?\n/, "").replace(/```$/, "").trim();

          if (sql === "NO_SQL_NEEDED" || (sql.toUpperCase().indexOf("SELECT") === -1 && sql.toUpperCase().indexOf("WITH") === -1)) {
            console.log("[GeminiAI] AI says no SQL needed, using model knowledge. Raw response:", sqlResponse.slice(0, 200));
            return queryWithModelKnowledge(userMessage, parsed).then(function(resp) {
              resp.insight = "AI decided no SQL query was needed (response: " + sqlResponse.trim().slice(0, 80) + ")";
              return resp;
            });
          }

          console.log("[GeminiAI] Step 2: Executing SQL:", sql);

          // Step 2: Execute the SQL query against PostgreSQL
          return executeSQL(sql)
            .then(function(rows) {
              console.log("[GeminiAI] Step 2 complete: SQL returned", rows.length, "rows");
              var resultText = formatResults(rows);

              // Step 3: Send results back to AI for interpretation
              console.log("[GeminiAI] Step 3: Sending results to AI for interpretation...");
              var interpretPrompt = "USER QUESTION: " + userMessage + "\n\n" +
                "SQL QUERY EXECUTED:\n" + sql + "\n\n" +
                "LIVE DATA RESULTS:\n" + resultText;

              return callAI(buildAnswerPrompt(), interpretPrompt, { temperature: 0.7, maxTokens: 1200 })
                .then(function(answer) {
                  console.log("[GeminiAI] Pipeline complete — live data answer ready");
                  return buildStructuredResponse(answer, parsed, sql, "live-db");
                })
                .catch(function(interpretErr) {
                  // AI interpretation failed (rate limit etc.) — show raw data instead of fallback
                  console.warn("[GeminiAI] Interpretation failed:", interpretErr.message, "— showing raw data");
                  var rawAnswer = "<strong>Live data retrieved</strong> (" + rows.length + " rows):<br><br>" +
                    "<pre style='font-size:.85em;overflow-x:auto'>" + resultText.replace(/</g, "&lt;") + "</pre>" +
                    "<br><em>AI interpretation unavailable (rate limited). Data above is from the live database.</em>";
                  return buildStructuredResponse(rawAnswer, parsed, sql, "live-db-raw");
                });
            })
            .catch(function(sqlErr) {
              console.warn("[GeminiAI] SQL execution failed:", sqlErr.message, "| SQL was:", sql);
              // Include debug info so user can see what went wrong
              return queryWithModelKnowledge(userMessage, parsed).then(function(resp) {
                resp.sqlQuery = sql;
                resp.insight = "SQL execution failed: " + sqlErr.message;
                return resp;
              });
            });
        })
        .catch(function(err) {
          console.error("[GeminiAI] AI call failed:", err.message);
          throw err;
        });
    } catch (syncErr) {
      console.error("[GeminiAI] Sync error in queryStructured:", syncErr);
      return Promise.reject(syncErr);
    }
  }

  // Fallback: Answer using model knowledge only (no live data)
  function queryWithModelKnowledge(userMessage, parsed) {
    return callAI(buildFallbackPrompt(), userMessage)
      .then(function(text) {
        return buildStructuredResponse(text, parsed, null, "gemini");
      });
  }

  // Build the structured response object compatible with the existing UI
  function buildStructuredResponse(answerText, parsed, sqlQuery, source) {
    // Extract referenced visuals
    var visuals = [];
    var visualNames = Object.keys(SEMANTIC_MODEL.visuals);
    visualNames.forEach(function(v) {
      if (answerText.toLowerCase().indexOf(v.toLowerCase()) !== -1) visuals.push(v);
    });

    // Extract referenced measures
    var measures = [];
    var measureNames = Object.keys(SEMANTIC_MODEL.measures);
    measureNames.forEach(function(m) {
      if (answerText.toLowerCase().indexOf(m.toLowerCase()) !== -1) measures.push(m);
    });

    var response = {
      answer: answerText,
      insight: sqlQuery ? "Queried live data from the PostgreSQL database" : null,
      suggestedVisuals: visuals.length > 0 ? visuals : ["KPI Cards"],
      measures: measures,
      tables: parsed && parsed.team ? ["Match by Team", "Teams"] : ["Match by Team"],
      filterLogic: buildFilterLogic(parsed),
      sqlQuery: sqlQuery || null,
      source: source
    };

    return response;
  }

  // Build filter logic from parsed data
  function buildFilterLogic(parsed) {
    if (!parsed) return [];
    var filters = [];
    if (parsed.team) {
      filters.push({ table: "Teams", column: "team_name", sql: "Teams.team_name = '" + parsed.team.replace(/'/g, "''") + "'" });
    }
    if (parsed.division) {
      filters.push({ table: "Teams", column: "division", sql: "\"Teams\".division = '" + parsed.division.replace(/'/g, "''") + "'" });
    }
    if (parsed.player) {
      filters.push({ table: "nba_players", column: "player_name", sql: "nba_players.player_name = '" + parsed.player.replace(/'/g, "''") + "'" });
    }
    if (parsed.dateRange) {
      filters.push({ table: "Match by Team", column: "game_date", sql: "\"Match by Team\".game_date BETWEEN '" + parsed.dateRange.start + "' AND '" + parsed.dateRange.end + "'" });
    }
    return filters;
  }

  // ============================================================
  // API Key & Provider Management
  // ============================================================

  function getProvider() {
    return localStorage.getItem(PROVIDER_KEY) || "gemini";
  }
  function setProvider(p) {
    localStorage.setItem(PROVIDER_KEY, p);
  }

  function getGeminiKey() {
    return localStorage.getItem(GEMINI_STORAGE_KEY) || "";
  }
  function setGeminiKey(key) {
    if (key) localStorage.setItem(GEMINI_STORAGE_KEY, key.trim());
    else localStorage.removeItem(GEMINI_STORAGE_KEY);
  }

  function getGroqKey() {
    return localStorage.getItem(GROQ_STORAGE_KEY) || "";
  }
  function setGroqKey(key) {
    if (key) localStorage.setItem(GROQ_STORAGE_KEY, key.trim());
    else localStorage.removeItem(GROQ_STORAGE_KEY);
  }

  function getGroqModel() {
    return localStorage.getItem(GROQ_MODEL_KEY) || GROQ_MODELS[0].id;
  }
  function setGroqModel(m) {
    localStorage.setItem(GROQ_MODEL_KEY, m);
  }

  // Legacy compatibility
  function getApiKey() {
    var p = getProvider();
    return p === "groq" ? getGroqKey() : getGeminiKey();
  }
  function setApiKey(key) {
    var p = getProvider();
    if (p === "groq") setGroqKey(key);
    else setGeminiKey(key);
  }

  function isAvailable() {
    return !!getApiKey();
  }

  // ============================================================
  // Settings Modal
  // ============================================================

  function showSettings() {
    var existing = document.getElementById("geminiSettingsModal");
    if (existing) existing.remove();

    var gemKey = getGeminiKey();
    var groqKey = getGroqKey();
    var groqModel = getGroqModel();
    var curProvider = getProvider();

    var groqModelOpts = GROQ_MODELS.map(function(m) {
      return '<option value="' + m.id + '"' + (groqModel === m.id ? ' selected' : '') + '>' + m.label + '</option>';
    }).join("");

    var overlay = document.createElement("div");
    overlay.id = "geminiSettingsModal";
    overlay.className = "gemini-modal-overlay";
    overlay.innerHTML =
      '<div class="gemini-modal">' +
        '<div class="gemini-modal-header">' +
          '<div class="gemini-modal-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#58a6ff" stroke-width="2"><path d="M12 2a4 4 0 0 1 4 4c0 2-2 3-2 5h-4c0-2-2-3-2-5a4 4 0 0 1 4-4z"/><line x1="10" y1="17" x2="14" y2="17"/><line x1="10" y1="20" x2="14" y2="20"/></svg></div>' +
          '<h3>AI Settings</h3>' +
          '<p class="text-muted">Configure your LLM provider and API keys</p>' +
        '</div>' +
        '<div class="gemini-modal-body">' +

          // Provider selector
          '<label class="gemini-label">Active Provider</label>' +
          '<select id="aiProviderSelect" class="gemini-key-input" style="padding:8px 12px;cursor:pointer">' +
            '<option value="gemini"' + (curProvider === "gemini" ? " selected" : "") + '>Gemini (Google)</option>' +
            '<option value="groq"'   + (curProvider === "groq"   ? " selected" : "") + '>Groq</option>' +
          '</select>' +

          '<div class="gemini-divider"></div>' +

          // Gemini section
          '<label class="gemini-label"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#58a6ff;margin-right:6px"></span>Gemini API Key</label>' +
          '<div class="gemini-key-wrap">' +
            '<input type="password" id="geminiKeyInput" class="gemini-key-input" placeholder="AIza..." value="' + gemKey + '">' +
            '<button type="button" class="btn btn-ghost gemini-toggle-vis" onclick="this.previousElementSibling.type = this.previousElementSibling.type === \'password\' ? \'text\' : \'password\'"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button>' +
          '</div>' +
          (gemKey ? '<p class="gemini-key-status connected"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#3fb950" stroke-width="3"><path d="M20 6L9 17l-5-5"/></svg> Key saved</p>' : '<p class="gemini-key-status">No key configured</p>') +
          '<p class="gemini-help">Get a free key at <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">Google AI Studio</a></p>' +

          '<div class="gemini-divider"></div>' +

          // Groq section
          '<label class="gemini-label"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#f0883e;margin-right:6px"></span>Groq API Key</label>' +
          '<div class="gemini-key-wrap">' +
            '<input type="password" id="groqKeyInput" class="gemini-key-input" placeholder="gsk_..." value="' + groqKey + '">' +
            '<button type="button" class="btn btn-ghost gemini-toggle-vis" onclick="this.previousElementSibling.type = this.previousElementSibling.type === \'password\' ? \'text\' : \'password\'"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button>' +
          '</div>' +
          (groqKey ? '<p class="gemini-key-status connected"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#3fb950" stroke-width="3"><path d="M20 6L9 17l-5-5"/></svg> Key saved</p>' : '<p class="gemini-key-status">No key configured</p>') +
          '<label class="gemini-label" style="margin-top:8px">Groq Model</label>' +
          '<select id="groqModelSelect" class="gemini-key-input" style="padding:8px 12px;cursor:pointer">' + groqModelOpts + '</select>' +
          '<p class="gemini-help">Get a free key at <a href="https://console.groq.com/keys" target="_blank" rel="noopener">Groq Console</a></p>' +

          '<div class="gemini-divider"></div>' +

          // Backend status
          '<label class="gemini-label">Live Data (PostgreSQL via Vercel)</label>' +
          '<p class="gemini-key-status connected"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#3fb950" stroke-width="3"><path d="M20 6L9 17l-5-5"/></svg> SQL queries routed via <code style="font-size:.75rem">' + SQL_API_URL + '</code></p>' +
        '</div>' +
        '<div class="gemini-modal-footer">' +
          '<button class="btn btn-ghost" onclick="document.getElementById(\'geminiSettingsModal\').remove()">Cancel</button>' +
          '<button class="btn btn-primary" id="geminiSaveBtn">Save</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(overlay);

    overlay.addEventListener("click", function(e) {
      if (e.target === overlay) overlay.remove();
    });

    document.getElementById("geminiSaveBtn").addEventListener("click", function() {
      var newGemKey = document.getElementById("geminiKeyInput").value.trim();
      var newGroqKey = document.getElementById("groqKeyInput").value.trim();
      var newProvider = document.getElementById("aiProviderSelect").value;
      var newGroqModel = document.getElementById("groqModelSelect").value;

      setGeminiKey(newGemKey);
      setGroqKey(newGroqKey);
      setProvider(newProvider);
      setGroqModel(newGroqModel);

      overlay.remove();
      updateGeminiIndicators();
    });
  }

  // Update UI to show AI connection status
  function updateGeminiIndicators() {
    var provider = getProvider();
    var hasKey = isAvailable();
    var badges = document.querySelectorAll(".gemini-status-badge");

    badges.forEach(function(badge) {
      if (hasKey && provider === "groq") {
        var mLabel = GROQ_MODELS.find(function(m) { return m.id === getGroqModel(); });
        badge.className = "gemini-status-badge connected groq";
        badge.innerHTML = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#f0883e" stroke-width="3"><path d="M20 6L9 17l-5-5"/></svg> ' + (mLabel ? mLabel.label : "Groq");
      } else if (hasKey) {
        badge.className = "gemini-status-badge connected";
        badge.innerHTML = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#3fb950" stroke-width="3"><path d="M20 6L9 17l-5-5"/></svg> Gemini';
      } else {
        badge.className = "gemini-status-badge offline";
        badge.innerHTML = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#8b949e" stroke-width="3"><circle cx="12" cy="12" r="8"/></svg> Offline AI';
      }
    });
  }

  // Public API
  return {
    queryStructured: queryStructured,
    isAvailable: isAvailable,
    getApiKey: getApiKey,
    setApiKey: setApiKey,
    getProvider: getProvider,
    setProvider: setProvider,
    showSettings: showSettings,
    updateGeminiIndicators: updateGeminiIndicators
  };

})();
