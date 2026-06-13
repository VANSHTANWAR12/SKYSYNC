import { useState, useRef, useEffect } from "react";

const AGENT_COLORS = {
  "Weather Agent":    "#f59e0b", // amber
  "Traffic Agent":    "#60a5fa", // blue
  "Navigation Agent": "#34d399", // green
  "Captain":          "#22d3ee", // cyan
  "User":             "#fff",    // white
  "System":           "#ef4444", // red
};

export default function AgentConsole({
  displayFlights = [],
  swarmSelectedFlightIds = [],
  onToggleSwarmFlight,
  onInjectStormForFlight,
  swarmMode = false,
  onSelectFlight,
  customStormCell,
  onCustomStormPlaced,
  onClearStorm,
  rerouteData = null,
  rerouteStatus = "idle",
  swarmResults = [],
}) {
  const [chatLog, setChatLog] = useState([
    {
      agent: "Weather Agent",
      message: "Weather Radar online. Scanning India airspace corridors for convective storm cell formations...",
      time: "00:00:01",
    },
    {
      agent: "Traffic Agent",
      message: "Traffic control link synchronized. Monitoring sector saturation levels. Standby for collision avoidance routing.",
      time: "00:00:02",
    },
    {
      agent: "Navigation Agent",
      message: "Routing calculation engine ready. Place a custom storm on the map or select a flight to compute weather avoidance detours.",
      time: "00:00:02",
    },
    {
      agent: "AI Copilot",
      message: "AI Copilot online — powered by Gemini. Ask me anything about flights, weather, fuel, rerouting, or aviation. Type / for commands.",
      time: "00:00:03",
    },
  ]);
  const [inputText, setInputText] = useState("");
  const [isAiThinking, setIsAiThinking] = useState(false);
  const feedRef = useRef(null);

  // Suggestions state
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [suggestionIndex, setSuggestionIndex] = useState(0);

  // Auto-scroll chat log to bottom
  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [chatLog]);

  // Helper to stream word-by-word typewriter message
  const streamAgentMessage = (agent, fullText, startDelay = 300, metrics = null) => {
    const time = new Date().toLocaleTimeString("en-GB", { hour12: false });
    const messageId = Math.random().toString(36).substring(2, 9);
    
    // Add typing loader
    setChatLog(prev => [
      ...prev,
      { id: messageId, agent, message: "", time, typing: true }
    ]);
    
    setTimeout(() => {
      const words = fullText.split(" ");
      let currentWordIndex = 0;
      let currentText = "";
      
      const interval = setInterval(() => {
        if (currentWordIndex >= words.length) {
          clearInterval(interval);
          setChatLog(prev => prev.map(m => m.id === messageId ? { ...m, typing: false, message: fullText, metrics } : m));
          return;
        }
        
        currentText += (currentWordIndex === 0 ? "" : " ") + words[currentWordIndex];
        setChatLog(prev => prev.map(m => m.id === messageId ? { ...m, typing: false, message: currentText } : m));
        currentWordIndex++;
      }, 45);
    }, startDelay);
  };

  const addAgentResponse = (agent, message, delay = 0) => {
    streamAgentMessage(agent, message, delay);
  };

  // Watch for single-flight rerouteData updates to post telemetry in console
  useEffect(() => {
    if (!swarmMode && rerouteData && rerouteStatus === "active") {
      const { flightNumber, metrics } = rerouteData;
      
      const key = `reroute-${flightNumber}-${metrics.safetyScore}`;
      if (window._lastLoggedReroute === key) return;
      window._lastLoggedReroute = key;

      streamAgentMessage(
        "Navigation Agent",
        `Avoidance trajectory computed for flight ${flightNumber}. Dynamic telemetry compared with original flight path:`,
        400,
        {
          safetyScore: metrics.safetyScore,
          fuelDelta: (metrics.alternateFuelKg - metrics.originalFuelKg),
          timeDelta: (metrics.alternateTimeMin - metrics.originalTimeMin)
        }
      );
    }
  }, [rerouteData, rerouteStatus, swarmMode]);

  // Watch for swarmMode reroute completions
  useEffect(() => {
    if (swarmMode && swarmResults.length > 0) {
      const activeResults = swarmResults.filter(r => r.status === "active");
      if (activeResults.length > 0 && activeResults.length === swarmSelectedFlightIds.length) {
        const totalFuelDelta = activeResults.reduce((acc, curr) => acc + (curr.metrics?.fuelDelta || 0), 0);
        const totalTimeDelta = activeResults.reduce((acc, curr) => acc + (curr.metrics?.timeDelta || 0), 0);
        const avgSafety = Math.round(activeResults.reduce((acc, curr) => acc + (curr.metrics?.safetyScore || 0), 0) / activeResults.length);
        
        const key = `swarm-reroute-${activeResults.length}-${totalFuelDelta}`;
        if (window._lastLoggedSwarmReroute === key) return;
        window._lastLoggedSwarmReroute = key;

        streamAgentMessage(
          "Navigation Agent",
          `Fleet-wide weather avoidance paths computed. Rerouted ${activeResults.length} flights concurrently. Aggregated metrics:`,
          400,
          {
            safetyScore: avgSafety,
            fuelDelta: totalFuelDelta,
            timeDelta: totalTimeDelta
          }
        );
      }
    }
  }, [swarmResults, swarmMode, swarmSelectedFlightIds]);

  // Log incoming custom storm cell placements in the chat HUD
  useEffect(() => {
    if (customStormCell) {
      const time = new Date().toLocaleTimeString("en-GB", { hour12: false });
      setChatLog(prev => [
        ...prev,
        {
          agent: "System",
          message: `🌩 Custom convective cell placed at ${customStormCell[0].toFixed(3)}°N, ${customStormCell[1].toFixed(3)}°E.`,
          time,
        }
      ]);
      streamAgentMessage("Weather Agent", `CRITICAL WEATHER DETECTED! Storm cell radius is ~150km. Analyzing turbulence threat vectors...`, 300);
      streamAgentMessage("Traffic Agent", `Initiating airspace scan. Recalculating separation minimums for active corridors.`, 800);
    }
  }, [customStormCell]);

  // Autocomplete Options Generator
  const getAutocompleteOptions = (inputVal) => {
    if (!inputVal.startsWith("/")) return [];
    
    const text = inputVal.toLowerCase();
    const parts = inputVal.split(" ");
    const cmd = parts[0].toLowerCase();
    
    const commands = [
      { text: "/reroute", label: "Reroute a flight", type: "command" },
      { text: "/storm", label: "Place custom storm coordinates", type: "command" },
      { text: "/clear", label: "Clear chat log / weather", type: "command" }
    ];
    
    if (parts.length === 1) {
      return commands.filter(c => c.text.startsWith(cmd));
    }
    
    if (cmd === "/reroute") {
      const query = parts[1] || "";
      return displayFlights
        .filter(f => f.flightNumber?.toUpperCase().includes(query.toUpperCase()))
        .map(f => ({
          text: `/reroute ${f.flightNumber}`,
          label: `${f.airline} · ${f.origin} ➔ ${f.destination}`,
          type: "flight"
        }));
    }
    
    if (cmd === "/storm") {
      const query = parts.slice(1).join(" ");
      const options = [
        { text: "/storm clear", label: "Clear custom storm cell", type: "sub" },
        { text: "/storm stop", label: "Stop storm simulation", type: "sub" },
        { text: "/storm 21.5 76.8", label: "Central India coordinate", type: "coord" },
        { text: "/storm 28.6 77.2", label: "Near Delhi coordinates", type: "coord" },
        { text: "/storm 19.1 72.8", label: "Near Mumbai coordinates", type: "coord" }
      ];
      return options.filter(o => o.text.toLowerCase().includes(text));
    }
    
    if (cmd === "/clear") {
      const options = [
        { text: "/clear storm", label: "Clear custom storm cell", type: "sub" },
        { text: "/clear weather", label: "Clear weather threat layer", type: "sub" }
      ];
      return options.filter(o => o.text.toLowerCase().includes(text));
    }
    
    return [];
  };

  // Input listener for suggestions
  useEffect(() => {
    if (inputText.startsWith("/")) {
      const opts = getAutocompleteOptions(inputText);
      setSuggestions(opts);
      setShowSuggestions(opts.length > 0);
      setSuggestionIndex(0);
    } else {
      setShowSuggestions(false);
      setSuggestions([]);
    }
  }, [inputText, displayFlights]);

  const handleCommand = (text) => {
    const time = new Date().toLocaleTimeString("en-GB", { hour12: false });
    const cleanText = text.trim();
    if (!cleanText) return;

    setChatLog(prev => [...prev, { agent: "User", message: cleanText, time }]);

    if (cleanText.startsWith("/")) {
      const parts = cleanText.split(" ");
      const cmd = parts[0].toLowerCase();

      if (cmd === "/clear") {
        const sub = parts[1]?.toLowerCase();
        if (sub === "storm" || sub === "weather") {
          addAgentResponse("System", "Clearing custom convective weather cells. Restoring original flight corridors...", 100);
          onClearStorm && onClearStorm();
          return;
        }
        setChatLog([]);
        return;
      }

      if (cmd === "/reroute") {
        const flightNum = parts[1]?.toUpperCase();
        if (!flightNum) {
          addAgentResponse("System", "Error: Specify flight number. Example: /reroute AI-3088", 100);
          return;
        }

        const flight = displayFlights.find(
          f => f.flightNumber.toUpperCase() === flightNum || f.id.toUpperCase() === flightNum
        );

        if (!flight) {
          addAgentResponse("System", `Error: Flight "${flightNum}" not found in current fleet.`, 100);
          return;
        }

        addAgentResponse("System", `Instruction received. Directing Navigation Agent to reroute flight ${flight.flightNumber}.`, 100);
        onSelectFlight(flight.id);
        
        setTimeout(() => {
          onInjectStormForFlight(flight);
        }, 600);
        return;
      }

      if (cmd === "/storm") {
        const sub = parts[1]?.toLowerCase();
        if (sub === "clear" || sub === "stop") {
          addAgentResponse("System", "Clearing custom convective weather cells. Restoring original flight corridors...", 100);
          onClearStorm && onClearStorm();
          return;
        }

        const lat = parseFloat(parts[1]);
        const lng = parseFloat(parts[2]);

        if (isNaN(lat) || isNaN(lng)) {
          addAgentResponse("System", "Error: Specify valid coordinates or sub-command. Example: /storm 21.5 78.2 or /storm clear", 100);
          return;
        }

        addAgentResponse("System", `Spawning custom weather cell at ${lat}°N, ${lng}°E...`, 100);
        onCustomStormPlaced && onCustomStormPlaced(lat, lng);
        return;
      }

      addAgentResponse("System", `Unknown command: ${cmd}. Available: /reroute [flight], /storm [lat] [lng], /storm clear, /clear`, 100);
    } else {
      // ── Gemini AI Copilot ──────────────────────────────────────────────────
      if (isAiThinking) return; // debounce: one request at a time
      setIsAiThinking(true);

      // Show typing indicator immediately
      const thinkingId = Math.random().toString(36).substring(2, 9);
      const thinkTime = new Date().toLocaleTimeString("en-GB", { hour12: false });
      setChatLog(prev => [...prev, { id: thinkingId, agent: "AI Copilot", message: "", time: thinkTime, typing: true }]);

      fetch("http://localhost:8000/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: cleanText,
          flights: displayFlights,
        }),
      })
        .then(r => r.json())
        .then(data => {
          const reply = data.reply || "I didn't receive a valid response. Please try again.";
          // Remove typing indicator, then stream reply
          setChatLog(prev => prev.filter(m => m.id !== thinkingId));
          streamAgentMessage("AI Copilot", reply, 0);
        })
        .catch(() => {
          setChatLog(prev => prev.filter(m => m.id !== thinkingId));
          streamAgentMessage("AI Copilot", "Connection error — I couldn't reach the AI backend. Check that the server is running on port 8000.", 0);
        })
        .finally(() => setIsAiThinking(false));
    }
  };

  const handleKeyDown = (e) => {
    if (showSuggestions && suggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSuggestionIndex(prev => (prev + 1) % suggestions.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSuggestionIndex(prev => (prev - 1 + suggestions.length) % suggestions.length);
      } else if (e.key === "Tab" || (e.key === "Enter" && suggestions[suggestionIndex])) {
        e.preventDefault();
        setInputText(suggestions[suggestionIndex].text);
        setShowSuggestions(false);
      } else if (e.key === "Escape") {
        setShowSuggestions(false);
      }
    } else if (e.key === "Enter") {
      handleCommand(inputText);
      setInputText("");
    }
  };

  return (
    <div className="agent-console-hud" style={{ display: "flex", flexDirection: "column", height: "100%", background: "#050d18", position: "relative" }}>
      {/* Console Feed */}
      <div ref={feedRef} className="agent-console-hud__feed" style={{ flex: 1, padding: "14px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "10px" }}>
        {chatLog.map((log, idx) => (
          <div
            key={idx}
            className={`agent-console-msg ${log.agent === "User" ? "agent-console-msg--user" : log.agent === "System" ? "agent-console-msg--system" : ""}`}
            style={{
              padding: "10px 12px",
              borderRadius: "12px",
              background: log.agent === "User" ? "rgba(34, 211, 238, 0.08)" : log.agent === "System" ? "rgba(239, 68, 68, 0.05)" : "rgba(255, 255, 255, 0.02)",
              border: log.agent === "User" ? "1px solid rgba(34, 211, 238, 0.2)" : log.agent === "System" ? "1px solid rgba(239, 68, 68, 0.2)" : "1px solid rgba(255,255,255,0.04)",
              maxWidth: "90%",
              alignSelf: log.agent === "User" ? "flex-end" : "flex-start",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px", gap: "12px" }}>
              <span style={{ fontSize: "10px", fontWeight: "900", color: AGENT_COLORS[log.agent] || "var(--text-strong)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {log.agent}
              </span>
              <span style={{ fontSize: "9px", color: "var(--muted)" }}>{log.time}</span>
            </div>
            {log.typing ? (
              <div className="typing-indicator" style={{ display: "flex", gap: "4px", padding: "4px 0", alignItems: "center" }}>
                <span className="typing-dot" style={{ width: "6px", height: "6px", background: "var(--cyan)", borderRadius: "50%", animation: "typingPulse 1.2s infinite ease-in-out" }} />
                <span className="typing-dot" style={{ width: "6px", height: "6px", background: "var(--cyan)", borderRadius: "50%", animation: "typingPulse 1.2s infinite ease-in-out", animationDelay: "0.2s" }} />
                <span className="typing-dot" style={{ width: "6px", height: "6px", background: "var(--cyan)", borderRadius: "50%", animation: "typingPulse 1.2s infinite ease-in-out", animationDelay: "0.4s" }} />
              </div>
            ) : (
              <>
                <p style={{ margin: 0, fontSize: "12px", color: "var(--text)", lineHeight: "1.45" }}>
                  {log.message}
                </p>
                {log.metrics && (
                  <div
                    className="console-metrics-card"
                    style={{
                      marginTop: "8px",
                      padding: "10px",
                      background: "rgba(0,0,0,0.3)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: "8px",
                      fontSize: "11px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "6px"
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ color: "var(--muted)" }}>AI Safety Index:</span>
                      <span style={{ fontWeight: "bold", color: log.metrics.safetyScore >= 80 ? "#34d399" : "#f59e0b" }}>
                        {log.metrics.safetyScore}/100
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: "10px", marginTop: "2px" }}>
                      <div style={{ flex: 1 }}>
                        <span style={{ color: "var(--muted)", display: "block", fontSize: "9px" }}>Fuel Delta:</span>
                        <span style={{ fontWeight: "bold", color: log.metrics.fuelDelta < 0 ? "#34d399" : "#f87171" }}>
                          {log.metrics.fuelDelta > 0 ? "+" : ""}{log.metrics.fuelDelta.toLocaleString()} kg
                        </span>
                      </div>
                      <div style={{ flex: 1 }}>
                        <span style={{ color: "var(--muted)", display: "block", fontSize: "9px" }}>Time Delta:</span>
                        <span style={{ fontWeight: "bold", color: log.metrics.timeDelta <= 0 ? "#34d399" : "#f59e0b" }}>
                          {log.metrics.timeDelta > 0 ? "+" : ""}{log.metrics.timeDelta} min
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        ))}
      </div>

      {/* Autocomplete suggestions menu */}
      {showSuggestions && suggestions.length > 0 && (
        <div
          className="agent-console-autocomplete"
          style={{
            position: "absolute",
            bottom: "94px", // raised above suggested buttons + input bar
            left: "14px",
            right: "14px",
            background: "rgba(6, 16, 29, 0.95)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(34, 211, 238, 0.25)",
            borderRadius: "12px",
            maxHeight: "180px",
            overflowY: "auto",
            zIndex: 100,
            boxShadow: "0 10px 25px rgba(0,0,0,0.5)",
            display: "flex",
            flexDirection: "column",
            padding: "6px 0"
          }}
        >
          {suggestions.map((opt, idx) => (
            <div
              key={idx}
              onClick={() => {
                setInputText(opt.text);
                setShowSuggestions(false);
              }}
              style={{
                padding: "8px 14px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                cursor: "pointer",
                background: idx === suggestionIndex ? "rgba(34, 211, 238, 0.1)" : "transparent",
                borderBottom: "1px solid rgba(255, 255, 255, 0.02)",
                transition: "all 0.15s"
              }}
              onMouseEnter={() => setSuggestionIndex(idx)}
            >
              <span style={{ fontSize: "12px", fontWeight: "bold", color: "#fff" }}>{opt.text}</span>
              <span style={{ fontSize: "10px", color: "var(--muted)" }}>{opt.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Suggested Commands Bar */}
      <div className="agent-console-hud__suggested" style={{ padding: "4px 14px", display: "flex", gap: "6px", overflowX: "auto", borderTop: "1px solid rgba(255,255,255,0.03)", background: "rgba(0,0,0,0.15)", flexShrink: 0 }}>
        <button
          onClick={() => handleCommand("/reroute AI-3088")}
          style={{ background: "none", border: "none", color: "var(--cyan)", fontSize: "10px", cursor: "pointer", padding: "4px 8px", borderRadius: "10px", background: "rgba(34, 211, 238, 0.06)", border: "1px solid rgba(34, 211, 238, 0.15)", whiteSpace: "nowrap", transition: "transform 0.1s" }}
          onMouseEnter={e => e.currentTarget.style.transform = "scale(1.05)"}
          onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
        >
          /reroute AI-3088
        </button>
        <button
          onClick={() => handleCommand("/storm 21.5 76.8")}
          style={{ background: "none", border: "none", color: "var(--cyan)", fontSize: "10px", cursor: "pointer", padding: "4px 8px", borderRadius: "10px", background: "rgba(34, 211, 238, 0.06)", border: "1px solid rgba(34, 211, 238, 0.15)", whiteSpace: "nowrap", transition: "transform 0.1s" }}
          onMouseEnter={e => e.currentTarget.style.transform = "scale(1.05)"}
          onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
        >
          /storm 21.5 76.8
        </button>
        <button
          onClick={() => handleCommand("/clear")}
          style={{ background: "none", border: "none", color: "var(--muted)", fontSize: "10px", cursor: "pointer", padding: "4px 8px", borderRadius: "10px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)", whiteSpace: "nowrap", transition: "transform 0.1s" }}
          onMouseEnter={e => e.currentTarget.style.transform = "scale(1.05)"}
          onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
        >
          /clear
        </button>
        <button
          onClick={() => handleCommand("/storm clear")}
          style={{ background: "none", border: "none", color: "var(--cyan)", fontSize: "10px", cursor: "pointer", padding: "4px 8px", borderRadius: "10px", background: "rgba(34, 211, 238, 0.06)", border: "1px solid rgba(34, 211, 238, 0.15)", whiteSpace: "nowrap", transition: "transform 0.1s" }}
          onMouseEnter={e => e.currentTarget.style.transform = "scale(1.05)"}
          onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
        >
          /storm clear
        </button>
        <button
          onClick={() => handleCommand("/help")}
          style={{ background: "none", border: "none", color: "#ffeb3b", fontSize: "10px", cursor: "pointer", padding: "4px 8px", borderRadius: "10px", background: "rgba(255, 235, 59, 0.06)", border: "1px solid rgba(255, 235, 59, 0.15)", whiteSpace: "nowrap", transition: "transform 0.1s" }}
          onMouseEnter={e => e.currentTarget.style.transform = "scale(1.05)"}
          onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
        >
          /help
        </button>
      </div>

      {/* Input Bar */}
      <div className="agent-console-hud__input-bar" style={{ padding: "12px 14px", borderTop: "1px solid var(--line)", background: "rgba(0,0,0,0.2)", display: "flex", gap: "8px", alignItems: "center", flexShrink: 0 }}>
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isAiThinking ? "AI Copilot is thinking…" : "Ask anything, or type / for commands…"}
          disabled={isAiThinking}
          style={{
            flex: 1,
            background: "rgba(255,255,255,0.03)",
            border: `1px solid ${isAiThinking ? "rgba(167,139,250,0.4)" : "var(--line)"}`,
            borderRadius: "10px",
            padding: "8px 12px",
            color: isAiThinking ? "var(--muted)" : "#fff",
            fontSize: "12px",
            outline: "none",
            transition: "border-color 0.2s",
          }}
        />
        <button
          onClick={() => {
            handleCommand(inputText);
            setInputText("");
          }}
          style={{
            background: "rgba(34, 211, 238, 0.15)",
            border: "1px solid #22d3ee",
            borderRadius: "10px",
            padding: "8px 14px",
            color: "#22d3ee",
            fontSize: "12px",
            fontWeight: "700",
            cursor: "pointer",
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
}
