// ============================================================
// Gemini LLM Integration — Live AI Q&A over the semantic model
// Uses the free Google Gemini API (gemini-2.0-flash)
// ============================================================

var GeminiAI = (function() {

  var API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";
  var STORAGE_KEY = "gemini_api_key";

  // Build the system prompt with full semantic model context
  function buildSystemPrompt() {
    var s = SEMANTIC_MODEL;
    var prompt = "You are an expert NBA analytics AI assistant embedded in a Power BI dashboard called GameIntel.\n";
    prompt += "You answer questions about NBA basketball data using the semantic model below.\n";
    prompt += "Be concise, confident, and data-driven. Use bold for emphasis. Use HTML tags (no markdown).\n";
    prompt += "When referencing measures, explain the DAX formula. When referencing visuals, tell the user which visual to look at.\n";
    prompt += "Always tell the user what filters to apply in the report slicers if relevant.\n";
    prompt += "If you don't know a live stat, explain what the report CAN show and how to find it.\n";
    prompt += "Format lists with <ul><li>. Use <strong> for emphasis. Use <code> for DAX/column names.\n\n";

    prompt += "=== SEMANTIC MODEL ===\n";
    prompt += "Season: " + s.season.start + " to " + s.season.end + "\n";
    prompt += "League: 30 teams, 6 divisions, 2 conferences, 5 teams per division\n\n";

    prompt += "TABLES:\n";
    for (var tName in s.tables) {
      var t = s.tables[tName];
      prompt += "- " + tName + ": " + t.description + "\n";
      prompt += "  Columns: ";
      var cols = [];
      for (var c in t.columns) {
        cols.push(c + " (" + t.columns[c].type + " — " + t.columns[c].description + ")");
      }
      prompt += cols.join(", ") + "\n";
    }

    prompt += "\nMEASURES:\n";
    for (var mName in s.measures) {
      var m = s.measures[mName];
      prompt += "- " + mName + " = " + m.expression + " — " + m.description + "\n";
    }

    prompt += "\nRELATIONSHIPS:\n";
    s.relationships.forEach(function(r) {
      prompt += "- " + r.from + " → " + r.to + " (" + r.description + ")\n";
    });

    prompt += "\nREPORT VISUALS:\n";
    for (var vName in s.visuals) {
      var v = s.visuals[vName];
      prompt += "- " + vName + ": " + v.description;
      if (v.measures.length) prompt += " [Measures: " + v.measures.join(", ") + "]";
      prompt += "\n";
    }

    prompt += "\nDIVISIONS & TEAMS:\n";
    for (var div in DIVISION_TEAMS) {
      prompt += "- " + div + " (" + DIVISION_CONFERENCE[div] + "): " + DIVISION_TEAMS[div].join(", ") + "\n";
    }

    prompt += "\nKNOWN PLAYERS:\n";
    var playerList = [];
    for (var p in KNOWN_PLAYERS) {
      playerList.push(p + " (" + KNOWN_PLAYERS[p] + ")");
    }
    prompt += playerList.join(", ") + "\n";

    return prompt;
  }

  // Get stored API key
  function getApiKey() {
    return localStorage.getItem(STORAGE_KEY) || "";
  }

  // Save API key
  function setApiKey(key) {
    if (key) {
      localStorage.setItem(STORAGE_KEY, key.trim());
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  // Check if Gemini is available
  function isAvailable() {
    return !!getApiKey();
  }

  // Call Gemini API
  function query(userMessage) {
    var apiKey = getApiKey();
    if (!apiKey) {
      return Promise.reject(new Error("No Gemini API key configured"));
    }

    var systemPrompt = buildSystemPrompt();

    var body = {
      system_instruction: {
        parts: [{ text: systemPrompt }]
      },
      contents: [{
        parts: [{ text: userMessage }]
      }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1024
      }
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

  // Build a structured response object compatible with the existing UI
  function queryStructured(userMessage, parsed) {
    return query(userMessage).then(function(text) {
      // Extract suggested visuals from the response text
      var visuals = [];
      var visualNames = Object.keys(SEMANTIC_MODEL.visuals);
      visualNames.forEach(function(v) {
        if (text.toLowerCase().indexOf(v.toLowerCase()) !== -1) {
          visuals.push(v);
        }
      });

      // Extract referenced measures
      var measures = [];
      var measureNames = Object.keys(SEMANTIC_MODEL.measures);
      measureNames.forEach(function(m) {
        if (text.toLowerCase().indexOf(m.toLowerCase()) !== -1) {
          measures.push(m);
        }
      });

      return {
        answer: text,
        insight: null,
        suggestedVisuals: visuals.length > 0 ? visuals : ["KPI Cards"],
        measures: measures,
        tables: parsed && parsed.team ? ["Match by Team", "Teams"] : ["Match by Team"],
        filterLogic: buildFilterLogic(parsed),
        source: "gemini"
      };
    });
  }

  // Build filter logic from parsed data (reusing existing logic)
  function buildFilterLogic(parsed) {
    if (!parsed) return [];
    var filters = [];
    if (parsed.team) {
      filters.push({ table: "Teams", column: "team_name", dax: "Teams[team_name] = \"" + parsed.team + "\"" });
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

  // Show API key settings modal
  function showSettings() {
    var existing = document.getElementById("geminiSettingsModal");
    if (existing) existing.remove();

    var currentKey = getApiKey();
    var masked = currentKey ? currentKey.slice(0, 6) + "..." + currentKey.slice(-4) : "";

    var overlay = document.createElement("div");
    overlay.id = "geminiSettingsModal";
    overlay.className = "gemini-modal-overlay";
    overlay.innerHTML =
      '<div class="gemini-modal">' +
        '<div class="gemini-modal-header">' +
          '<div class="gemini-modal-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#58a6ff" stroke-width="2"><path d="M12 2a4 4 0 0 1 4 4c0 2-2 3-2 5h-4c0-2-2-3-2-5a4 4 0 0 1 4-4z"/><line x1="10" y1="17" x2="14" y2="17"/><line x1="10" y1="20" x2="14" y2="20"/></svg></div>' +
          '<h3>Gemini AI Settings</h3>' +
          '<p class="text-muted">Connect a Google Gemini API key for live AI-powered answers</p>' +
        '</div>' +
        '<div class="gemini-modal-body">' +
          '<label class="gemini-label">API Key</label>' +
          '<div class="gemini-key-wrap">' +
            '<input type="password" id="geminiKeyInput" class="gemini-key-input" placeholder="AIza..." value="' + currentKey + '">' +
            '<button type="button" class="btn btn-ghost gemini-toggle-vis" onclick="this.previousElementSibling.type = this.previousElementSibling.type === \'password\' ? \'text\' : \'password\'"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button>' +
          '</div>' +
          (currentKey ? '<p class="gemini-key-status connected"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#3fb950" stroke-width="3"><path d="M20 6L9 17l-5-5"/></svg> Connected (' + masked + ')</p>' : '<p class="gemini-key-status">No key configured — using offline AI engine</p>') +
          '<p class="gemini-help">Get a free API key at <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">Google AI Studio</a></p>' +
        '</div>' +
        '<div class="gemini-modal-footer">' +
          '<button class="btn btn-ghost" onclick="document.getElementById(\'geminiSettingsModal\').remove()">Cancel</button>' +
          '<button class="btn btn-primary" id="geminiSaveBtn">Save Key</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(overlay);

    // Close on overlay click
    overlay.addEventListener("click", function(e) {
      if (e.target === overlay) overlay.remove();
    });

    // Save button
    document.getElementById("geminiSaveBtn").addEventListener("click", function() {
      var key = document.getElementById("geminiKeyInput").value.trim();
      setApiKey(key);
      overlay.remove();
      // Update UI indicators
      updateGeminiIndicators();
    });
  }

  // Update UI to show Gemini connection status
  function updateGeminiIndicators() {
    var badges = document.querySelectorAll(".gemini-status-badge");
    badges.forEach(function(badge) {
      if (isAvailable()) {
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
    query: query,
    queryStructured: queryStructured,
    isAvailable: isAvailable,
    getApiKey: getApiKey,
    setApiKey: setApiKey,
    showSettings: showSettings,
    updateGeminiIndicators: updateGeminiIndicators
  };

})();
