// ============================================================
// Gemini LLM Integration — Live AI Q&A with DAX Execution
// Flow: User Question → Gemini generates DAX → Execute against
// Power BI Semantic Model → Gemini interprets real results
// ============================================================

var GeminiAI = (function() {

  var API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";
  var STORAGE_KEY = "gemini_api_key";

  // ============================================================
  // System Prompts
  // ============================================================

  function buildModelSchema() {
    var s = SEMANTIC_MODEL;
    var schema = "";
    schema += "Season: " + s.season.start + " to " + s.season.end + "\n";
    schema += "League: 30 teams, 6 divisions, 2 conferences\n\n";

    schema += "TABLES:\n";
    for (var tName in s.tables) {
      var t = s.tables[tName];
      schema += "- '" + tName + "': " + t.description + "\n";
      schema += "  Columns: ";
      var cols = [];
      for (var c in t.columns) {
        cols.push("'" + tName + "'[" + c + "] (" + t.columns[c].type + " — " + t.columns[c].description + ")");
      }
      schema += cols.join(", ") + "\n";
    }

    schema += "\nMEASURES (defined in model):\n";
    for (var mName in s.measures) {
      var m = s.measures[mName];
      schema += "- [" + mName + "] = " + m.expression + " — " + m.description + "\n";
    }

    schema += "\nRELATIONSHIPS:\n";
    s.relationships.forEach(function(r) {
      schema += "- " + r.from + " → " + r.to + "\n";
    });

    schema += "\nDIVISIONS & TEAMS:\n";
    for (var div in DIVISION_TEAMS) {
      schema += "- " + div + " (" + DIVISION_CONFERENCE[div] + "): " + DIVISION_TEAMS[div].join(", ") + "\n";
    }

    schema += "\nKNOWN PLAYERS:\n";
    var playerList = [];
    for (var p in KNOWN_PLAYERS) {
      playerList.push(p + " → " + KNOWN_PLAYERS[p]);
    }
    schema += playerList.join(", ") + "\n";

    return schema;
  }

  // Prompt for Step 1: Generate DAX query
  function buildDaxPrompt() {
    return "You are a DAX query generator for a Power BI semantic model.\n" +
      "Given a user's natural language question, generate a valid DAX EVALUATE query.\n\n" +
      "RULES:\n" +
      "- Return ONLY the DAX query, no explanation, no markdown fences.\n" +
      "- Use EVALUATE with SUMMARIZECOLUMNS, TOPN, FILTER, CALCULATETABLE, or ADDCOLUMNS as needed.\n" +
      "- Always use single quotes around table names with spaces: 'Match by Team'\n" +
      "- For the 'Team' column in Teams table, use Teams[Team] (NOT team_name).\n" +
      "- Use existing measures like [Total Games], [Win Rate], [Avg Score] when possible.\n" +
      "- Limit results to 25 rows max using TOPN if the result set could be large.\n" +
      "- For win rate, use: DIVIDE(CALCULATE(COUNTROWS('Match by Team'), 'Match by Team'[result]=\"W\"), COUNTROWS('Match by Team'))\n" +
      "- For scores, home_pts and away_pts are in 'Match by Team'.\n" +
      "- The result column values are \"W\" or \"L\".\n" +
      "- If the question is about model/schema/metadata (not data), return exactly: NO_DAX_NEEDED\n" +
      "- If the question is conversational/greeting, return exactly: NO_DAX_NEEDED\n\n" +
      "SEMANTIC MODEL:\n" + buildModelSchema();
  }

  // Prompt for Step 2: Interpret results
  function buildAnswerPrompt() {
    return "You are an expert NBA analytics AI assistant in a Power BI dashboard called GameIntel.\n" +
      "You have been given LIVE DATA from the Power BI semantic model.\n" +
      "Answer the user's question using the REAL DATA provided.\n\n" +
      "RULES:\n" +
      "- Use the actual numbers from the data — these are REAL, not estimates.\n" +
      "- Be concise, confident, data-driven. Lead with the key insight.\n" +
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
      "SEMANTIC MODEL:\n" + buildModelSchema();
  }

  // Fallback prompt (no DAX, just model knowledge)
  function buildFallbackPrompt() {
    return "You are an expert NBA analytics AI assistant embedded in a Power BI dashboard called GameIntel.\n" +
      "IMPORTANT: Answer the user's question DIRECTLY first. Give the actual answer to what they asked.\n" +
      "Use the KNOWN PLAYERS section below to answer which team a player plays for, their division, and conference.\n" +
      "After giving the direct answer, briefly mention which report visual or filter to use for more details.\n" +
      "Be concise, confident, and data-driven. Use HTML tags (no markdown).\n" +
      "Format: <strong> for emphasis, <ul><li> for lists, <code> for DAX/column names.\n" +
      "Do NOT start with 'Looking up' or describe the semantic model structure. Just answer the question.\n\n" +
      "SEMANTIC MODEL:\n" + buildModelSchema();
  }

  // ============================================================
  // Gemini API Call
  // ============================================================

  function callGemini(systemPrompt, userMessage, opts) {
    var apiKey = getApiKey();
    if (!apiKey) return Promise.reject(new Error("No Gemini API key configured"));

    var config = {
      temperature: (opts && opts.temperature) || 0.7,
      maxOutputTokens: (opts && opts.maxTokens) || 1024
    };

    var body = {
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ parts: [{ text: userMessage }] }],
      generationConfig: config
    };

    return fetch(API_URL + "?key=" + apiKey, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    })
    .then(function(res) {
      if (!res.ok) {
        return res.json().then(function(err) {
          var msg = (err.error && err.error.message) || "API returned " + res.status;
          throw new Error(msg);
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

  // ============================================================
  // Power BI DAX Query Execution
  // ============================================================

  function executeDAX(daxQuery) {
    var token = (typeof pbiAccessToken !== "undefined") ? pbiAccessToken : null;
    if (!token) {
      return Promise.reject(new Error("NO_TOKEN"));
    }

    var url = "https://api.powerbi.com/v1.0/myorg/groups/" +
      CONFIG.powerbi.groupId + "/datasets/" +
      CONFIG.powerbi.reportId + "/executeQueries";

    var body = {
      queries: [{ query: daxQuery }],
      serializerSettings: { includeNulls: true }
    };

    return fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + token
      },
      body: JSON.stringify(body)
    })
    .then(function(res) {
      if (!res.ok) {
        return res.text().then(function(t) {
          throw new Error("DAX execution failed (" + res.status + "): " + t.slice(0, 200));
        });
      }
      return res.json();
    })
    .then(function(data) {
      if (data.error) throw new Error("DAX error: " + (data.error.message || JSON.stringify(data.error)));
      // Extract rows from result
      if (data.results && data.results[0] && data.results[0].tables && data.results[0].tables[0]) {
        return data.results[0].tables[0].rows || [];
      }
      return [];
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

  // Full pipeline: Question → DAX → Execute → Interpret
  function queryStructured(userMessage, parsed) {
    try {
      var hasToken = (typeof pbiAccessToken !== "undefined") && !!pbiAccessToken;

      if (!hasToken) {
        // No PBI token — skip DAX execution, use Gemini with model knowledge only
        return queryWithModelKnowledge(userMessage, parsed);
      }

      // Step 1: Ask Gemini to generate a DAX query
      return callGemini(buildDaxPrompt(), userMessage, { temperature: 0.2, maxTokens: 512 })
        .then(function(daxResponse) {
          var dax = daxResponse.trim().replace(/^```[\s\S]*?\n/, "").replace(/```$/, "").trim();

          // If Gemini says no DAX needed (metadata / conversational question)
          if (dax === "NO_DAX_NEEDED" || dax.indexOf("EVALUATE") === -1) {
            return queryWithModelKnowledge(userMessage, parsed);
          }

          console.log("[GeminiAI] Generated DAX:", dax);

          // Step 2: Execute the DAX query against Power BI
          return executeDAX(dax)
            .then(function(rows) {
              console.log("[GeminiAI] DAX returned", rows.length, "rows");
              var resultText = formatResults(rows);

              // Step 3: Send results back to Gemini for interpretation
              var interpretPrompt = "USER QUESTION: " + userMessage + "\n\n" +
                "DAX QUERY EXECUTED:\n" + dax + "\n\n" +
                "LIVE DATA RESULTS:\n" + resultText;

              return callGemini(buildAnswerPrompt(), interpretPrompt, { temperature: 0.7, maxTokens: 1200 });
            })
            .then(function(answer) {
              return buildStructuredResponse(answer, parsed, dax, "gemini-live");
            })
            .catch(function(daxErr) {
              console.warn("[GeminiAI] DAX execution failed:", daxErr.message);
              return queryWithModelKnowledge(userMessage, parsed);
            });
        })
        .catch(function(err) {
          console.warn("[GeminiAI] DAX generation failed:", err.message);
          return queryWithModelKnowledge(userMessage, parsed);
        });
    } catch (syncErr) {
      console.error("[GeminiAI] Sync error in queryStructured:", syncErr);
      return Promise.reject(syncErr);
    }
  }

  // Fallback: Answer using model knowledge only (no live data)
  function queryWithModelKnowledge(userMessage, parsed) {
    return callGemini(buildFallbackPrompt(), userMessage)
      .then(function(text) {
        return buildStructuredResponse(text, parsed, null, "gemini");
      });
  }

  // Build the structured response object compatible with the existing UI
  function buildStructuredResponse(answerText, parsed, daxQuery, source) {
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
      insight: daxQuery ? "Queried live data from the Power BI semantic model" : null,
      suggestedVisuals: visuals.length > 0 ? visuals : ["KPI Cards"],
      measures: measures,
      tables: parsed && parsed.team ? ["Match by Team", "Teams"] : ["Match by Team"],
      filterLogic: buildFilterLogic(parsed),
      daxQuery: daxQuery || null,
      source: source
    };

    return response;
  }

  // Build filter logic from parsed data
  function buildFilterLogic(parsed) {
    if (!parsed) return [];
    var filters = [];
    if (parsed.team) {
      filters.push({ table: "Teams", column: "Team", dax: "Teams[Team] = \"" + parsed.team + "\"" });
    }
    if (parsed.division) {
      filters.push({ table: "Teams", column: "Division", dax: "Teams[Division] = \"" + parsed.division + "\"" });
    }
    if (parsed.player) {
      filters.push({ table: "nba_players", column: "player_name", dax: "nba_players[player_name] = \"" + parsed.player + "\"" });
    }
    if (parsed.dateRange) {
      filters.push({ table: "Match by Team", column: "game_date", dax: "'Match by Team'[game_date] >= DATE(" + parsed.dateRange.start.replace(/-/g, ",") + ") && 'Match by Team'[game_date] <= DATE(" + parsed.dateRange.end.replace(/-/g, ",") + ")" });
    }
    return filters;
  }

  // ============================================================
  // API Key Management
  // ============================================================

  function getApiKey() {
    return localStorage.getItem(STORAGE_KEY) || "";
  }

  function setApiKey(key) {
    if (key) {
      localStorage.setItem(STORAGE_KEY, key.trim());
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
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

    var currentKey = getApiKey();
    var masked = currentKey ? currentKey.slice(0, 6) + "..." + currentKey.slice(-4) : "";
    var hasToken = (typeof pbiAccessToken !== "undefined") && !!pbiAccessToken;

    var overlay = document.createElement("div");
    overlay.id = "geminiSettingsModal";
    overlay.className = "gemini-modal-overlay";
    overlay.innerHTML =
      '<div class="gemini-modal">' +
        '<div class="gemini-modal-header">' +
          '<div class="gemini-modal-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#58a6ff" stroke-width="2"><path d="M12 2a4 4 0 0 1 4 4c0 2-2 3-2 5h-4c0-2-2-3-2-5a4 4 0 0 1 4-4z"/><line x1="10" y1="17" x2="14" y2="17"/><line x1="10" y1="20" x2="14" y2="20"/></svg></div>' +
          '<h3>Gemini AI Settings</h3>' +
          '<p class="text-muted">Connect Gemini for live AI answers powered by your semantic model data</p>' +
        '</div>' +
        '<div class="gemini-modal-body">' +
          '<label class="gemini-label">Gemini API Key</label>' +
          '<div class="gemini-key-wrap">' +
            '<input type="password" id="geminiKeyInput" class="gemini-key-input" placeholder="AIza..." value="' + currentKey + '">' +
            '<button type="button" class="btn btn-ghost gemini-toggle-vis" onclick="this.previousElementSibling.type = this.previousElementSibling.type === \'password\' ? \'text\' : \'password\'"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button>' +
          '</div>' +
          (currentKey ? '<p class="gemini-key-status connected"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#3fb950" stroke-width="3"><path d="M20 6L9 17l-5-5"/></svg> Connected (' + masked + ')</p>' : '<p class="gemini-key-status">No key configured — using offline AI engine</p>') +
          '<p class="gemini-help">Get a free API key at <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">Google AI Studio</a></p>' +
          '<div class="gemini-divider"></div>' +
          '<label class="gemini-label">Live Data Access</label>' +
          (hasToken ? '<p class="gemini-key-status connected"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#3fb950" stroke-width="3"><path d="M20 6L9 17l-5-5"/></svg> Power BI connected — AI will query live data via DAX</p>' : '<p class="gemini-key-status"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#f0883e" stroke-width="3"><circle cx="12" cy="12" r="8"/></svg> Not signed in — AI will use model knowledge only. Sign in on the report page to enable live data queries.</p>') +
        '</div>' +
        '<div class="gemini-modal-footer">' +
          '<button class="btn btn-ghost" onclick="document.getElementById(\'geminiSettingsModal\').remove()">Cancel</button>' +
          '<button class="btn btn-primary" id="geminiSaveBtn">Save Key</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(overlay);

    overlay.addEventListener("click", function(e) {
      if (e.target === overlay) overlay.remove();
    });

    document.getElementById("geminiSaveBtn").addEventListener("click", function() {
      var key = document.getElementById("geminiKeyInput").value.trim();
      setApiKey(key);
      overlay.remove();
      updateGeminiIndicators();
    });
  }

  // Update UI to show Gemini connection status
  function updateGeminiIndicators() {
    var hasToken = (typeof pbiAccessToken !== "undefined") && !!pbiAccessToken;
    var badges = document.querySelectorAll(".gemini-status-badge");
    badges.forEach(function(badge) {
      if (isAvailable() && hasToken) {
        badge.className = "gemini-status-badge connected";
        badge.innerHTML = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#3fb950" stroke-width="3"><path d="M20 6L9 17l-5-5"/></svg> Gemini Live';
      } else if (isAvailable()) {
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
    showSettings: showSettings,
    updateGeminiIndicators: updateGeminiIndicators
  };

})();
