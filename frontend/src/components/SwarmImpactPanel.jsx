/**
 * SkySync — SwarmImpactPanel
 * Right panel shown when Swarm Mode is active.
 * Displays:
 *  - Aggregated fleet metrics across all affected flights (default summary)
 *  - Flight details card when a flight is selected (telemetry comparison, pilot brief, logs, Focus Mode)
 */
import { useState } from "react";

const STATUS_COLOR = {
  loading:  "#f59e0b",
  active:   "#22d3ee",
  approved: "#34d399",
  rejected: "#ef4444",
  idle:     "#475569",
};

const LOG_TYPE_COLOR = {
  SCAN:     "#60a5fa",   // blue
  ANALYSIS: "#f59e0b",  // amber
  COMPUTE:  "#a78bfa",  // purple
  DECISION: "#34d399",  // green
  METRICS:  "#22d3ee",  // cyan
  INFO:     "#94a3b8",  // muted
};

const AGENT_COLOR = {
  "Weather Agent":    "#f59e0b",
  "Traffic Agent":    "#60a5fa",
  "Navigation Agent": "#34d399",
  "Captain":          "#22d3ee",
  "System":           "#ef4444",
};

const AIRLINE_INITIAL = (name = "") => name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();

function ScoreBadge({ score }) {
  const color = score >= 80 ? "#34d399" : score >= 65 ? "#f59e0b" : "#ef4444";
  return (
    <span style={{
      display: "inline-block",
      padding: "2px 8px",
      borderRadius: "999px",
      fontSize: "11px",
      fontWeight: 700,
      color,
      background: `${color}18`,
      border: `1px solid ${color}33`,
    }}>
      {score}/100
    </span>
  );
}

function FleetFlightRow({ result, index, color, isHighlighted, isSelected, onHover, onClick }) {
  const isLoading = result.status === "loading";
  return (
    <div
      className={`swarm-flight-row ${isHighlighted ? "swarm-flight-row--highlighted" : ""} ${isSelected ? "swarm-flight-row--selected" : ""}`}
      style={{ "--rc": color, cursor: "pointer" }}
      onMouseEnter={() => onHover && onHover(result.id)}
      onMouseLeave={() => onHover && onHover(null)}
      onClick={onClick}
    >
      <div className="swarm-flight-row__accent" />
      <div className="swarm-flight-row__body">
        <div className="swarm-flight-row__top">
          <span className="swarm-flight-row__badge">{AIRLINE_INITIAL(result.airline)}</span>
          <span className="swarm-flight-row__num">{result.flightNumber}</span>
          <span className="swarm-flight-row__airline">{result.airline}</span>
          <span
            className="swarm-flight-row__status-dot"
            style={{ background: STATUS_COLOR[result.status] || "#475569" }}
            title={result.status}
          />
        </div>
        {isLoading ? (
          <p className="swarm-flight-row__loading">Computing reroute…</p>
        ) : result.metrics ? (
          <div className="swarm-flight-row__metrics">
            <span className="swarm-metric">
              <span className="swarm-metric__label">Fuel Δ</span>
              <span className="swarm-metric__val" style={{ color: result.metrics.fuelDelta < 0 ? "#34d399" : "#f87171" }}>
                {result.metrics.fuelDelta > 0 ? "+" : ""}{result.metrics.fuelDelta.toLocaleString()} kg
              </span>
            </span>
            <span className="swarm-metric">
              <span className="swarm-metric__label">Time Δ</span>
              <span className="swarm-metric__val" style={{ color: result.metrics.timeDelta < 0 ? "#34d399" : "#f59e0b" }}>
                {result.metrics.timeDelta > 0 ? "+" : ""}{result.metrics.timeDelta} min
              </span>
            </span>
            <span className="swarm-metric">
              <span className="swarm-metric__label">Safety</span>
              <ScoreBadge score={result.metrics.safetyScore} />
            </span>
          </div>
        ) : result.status === "rejected" ? (
          <p className="swarm-flight-row__loading" style={{ color: "#ef4444" }}>Reroute failed</p>
        ) : (
          <p className="swarm-flight-row__loading" style={{ color: "#64748b" }}>corridor armed · select to inspect</p>
        )}
      </div>
    </div>
  );
}

export default function SwarmImpactPanel({
  swarmResults = [],
  isSwarmLoading,
  onApproveAll,
  onRejectAll,
  hoveredFlightId = null,
  selectedFlightId = null,
  onHoverFlight = null,
  onSelectFlight = null,
  focusMode = false,
  onToggleFocus = null,
  onApproveFlight = null,
  onRejectFlight = null,
}) {
  const [logExpanded, setLogExpanded] = useState(true);

  // If a flight is clicked, show its detailed focused view instead of the list summary
  const focusedResult = selectedFlightId ? swarmResults.find(r => r.id === selectedFlightId) : null;

  if (focusedResult) {
    const isApproved = focusedResult.status === "approved";
    const isLoading = focusedResult.status === "loading";
    const hasReroute = !!focusedResult.rerouteData;
    const { metrics, copilot, agentLog = [], flightNumber, airline } = focusedResult.rerouteData || {};

    return (
      <section className="panel swarm-impact-panel">
        {/* Header */}
        <div className="panel__header" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <button className="clear-selection-btn" onClick={() => onSelectFlight(null)} style={{ alignSelf: "flex-start", fontSize: "11px", display: "inline-flex", alignItems: "center", gap: "5px", padding: "4px 8px" }}>
            ← Back to Fleet Summary
          </button>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
            <div>
              <p className="panel__eyebrow">Corridor details</p>
              <h2 className="panel__title">{flightNumber} · {airline}</h2>
            </div>
            <div className={`reroute-card__status-pill ${isApproved ? "reroute-card__status-pill--approved" : ""}`} style={{ fontSize: "10px", padding: "4px 8px" }}>
              {focusedResult.status.toUpperCase()}
            </div>
          </div>
        </div>

        <div className="panel__body" style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {/* Focus Mode Selector */}
          <div className="focus-mode-bar" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", background: "rgba(34, 211, 238, 0.06)", border: "1px solid rgba(34, 211, 238, 0.18)", borderRadius: "12px" }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: "11px", fontWeight: "700", color: "#fff", textTransform: "uppercase", letterSpacing: "0.05em" }}>Focus Mode</span>
              <span style={{ fontSize: "10px", color: "#64748b" }}>Isolate this corridor on the map</span>
            </div>
            <label className="focus-toggle-switch" style={{ position: "relative", display: "inline-block", width: "38px", height: "20px" }}>
              <input
                type="checkbox"
                checked={focusMode}
                onChange={e => onToggleFocus && onToggleFocus(e.target.checked)}
                style={{ opacity: 0, width: 0, height: 0 }}
              />
              <span className="focus-toggle-slider" />
            </label>
          </div>

          {isLoading ? (
            <div className="agent-loading" style={{ padding: "40px 0" }}>
              <div className="agent-loading__spinner" />
              <p style={{ marginTop: "12px", fontSize: "12px" }}>Computing weather-avoidance detours…</p>
            </div>
          ) : !hasReroute ? (
            <div className="swarm-empty" style={{ padding: "40px 10px" }}>
              <p className="swarm-empty__title" style={{ fontSize: "13px" }}>Reroute Pending</p>
              <p className="swarm-empty__sub" style={{ fontSize: "11px" }}>Trigger <strong>Inject Swarm Storm</strong> in the top panel to simulate thunderstorms and calculate dynamic avoidance paths.</p>
            </div>
          ) : (
            <>
              {/* AI Safety Score */}
              <div className="reroute-card__safety" style={{ padding: 0 }}>
                <span className="reroute-card__safety-label">AI Safety Index</span>
                <div className="reroute-card__safety-bar-wrap">
                  <div
                    className="reroute-card__safety-bar"
                    style={{ width: `${metrics.safetyScore}%` }}
                  />
                </div>
                <span className="reroute-card__safety-score">{metrics.safetyScore}/100</span>
              </div>

              {/* Fuel and Time Deltas */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div className="telemetry-item" style={{ padding: "10px 12px", flexDirection: "column", alignItems: "flex-start", gap: "4px" }}>
                  <span className="telemetry-item__label" style={{ fontSize: "9px" }}>Fuel Change</span>
                  <span className="telemetry-item__value" style={{ fontSize: "14px", color: (metrics.alternateFuelKg - metrics.originalFuelKg) < 0 ? "#34d399" : "#f87171" }}>
                    {(metrics.alternateFuelKg - metrics.originalFuelKg) > 0 ? "+" : ""}{(metrics.alternateFuelKg - metrics.originalFuelKg).toLocaleString()} kg
                  </span>
                </div>
                <div className="telemetry-item" style={{ padding: "10px 12px", flexDirection: "column", alignItems: "flex-start", gap: "4px" }}>
                  <span className="telemetry-item__label" style={{ fontSize: "9px" }}>Delay delta</span>
                  <span className="telemetry-item__value" style={{ fontSize: "14px", color: (metrics.alternateTimeMin - metrics.originalTimeMin) < 0 ? "#34d399" : "#f59e0b" }}>
                    {(metrics.alternateTimeMin - metrics.originalTimeMin) > 0 ? "+" : ""}{(metrics.alternateTimeMin - metrics.originalTimeMin)} min
                  </span>
                </div>
              </div>

              {/* Copilot Briefing */}
              {copilot && (
                <div className="reroute-card__copilot-panel" style={{ margin: 0 }}>
                  <div className="rc-copilot__header">
                    <span className="rc-copilot__sparkle">✦</span>
                    <span className="rc-copilot__title">AI Dispatch Briefing</span>
                  </div>
                  <p className="rc-copilot__text" style={{ fontSize: "12px", lineHeight: "1.45" }}>{copilot.briefing}</p>
                  {copilot.atc_script && (
                    <div className="rc-copilot__atc">
                      <span className="rc-copilot__atc-label">ATC script:</span>
                      <code className="rc-copilot__atc-code" style={{ fontSize: "11px" }}>"{copilot.atc_script}"</code>
                    </div>
                  )}
                </div>
              )}

              {/* Collapsible Agent Reasoning Log */}
              <div className="reroute-card__log-section" style={{ borderTop: "1px solid rgba(148, 163, 184, 0.12)", paddingTop: "12px" }}>
                <button
                  className="reroute-card__log-toggle"
                  onClick={() => setLogExpanded(v => !v)}
                  style={{ width: "100%", justifyContent: "flex-start", padding: "2px 0" }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                    style={{ transform: logExpanded ? "rotate(90deg)" : "none", transition: "transform 0.2s" }}>
                    <path d="M9 18l6-6-6-6"/>
                  </svg>
                  Agent Reasoning Log ({agentLog.length} steps)
                </button>

                {logExpanded && (
                  <div className="reroute-card__log" style={{ maxHeight: "none" }}>
                    {agentLog.map((entry, idx) => (
                      <div key={idx} className="log-entry">
                        <div className="log-entry__header">
                          <span className="log-entry__agent" style={{ color: AGENT_COLOR[entry.agent] || "#94a3b8" }}>{entry.agent}</span>
                          <span className="log-entry__type" style={{ color: LOG_TYPE_COLOR[entry.type] || "#94a3b8" }}>[{entry.type}]</span>
                        </div>
                        <p className="log-entry__msg" style={{ fontSize: "11px" }}>{entry.message}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Granular Action CTA Buttons */}
              {focusedResult.status === "active" && (
                <div className="swarm-actions" style={{ marginTop: "auto", paddingTop: "16px" }}>
                  <button className="swarm-btn swarm-btn--approve" onClick={() => onApproveFlight && onApproveFlight(focusedResult.id)}>
                    Approve Reroute
                  </button>
                  <button className="swarm-btn swarm-btn--reject" onClick={() => onRejectFlight && onRejectFlight(focusedResult.id)}>
                    Maintain Original
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </section>
    );
  }

  // Fallback: Default aggregated fleet statistics view
  const done = swarmResults.filter(r => r.metrics);
  const totalFuelDelta = done.reduce((s, r) => s + (r.metrics?.fuelDelta ?? 0), 0);
  const totalTimeDelta = done.reduce((s, r) => s + (r.metrics?.timeDelta ?? 0), 0);
  const avgSafety = done.length
    ? Math.round(done.reduce((s, r) => s + (r.metrics?.safetyScore ?? 0), 0) / done.length)
    : 0;
  const affected = swarmResults.length;
  const resolved = done.length;
  const allApproved = swarmResults.length > 0 && swarmResults.every(r => r.status === "approved");
  const anyActive  = swarmResults.some(r => r.status === "active");

  const COLORS = ["#22d3ee", "#a78bfa", "#34d399", "#fb923c", "#f472b6"];

  return (
    <section className="panel swarm-impact-panel">
      {/* Header */}
      <div className="panel__header">
        <p className="panel__eyebrow">⚡ Swarm Mode</p>
        <h2 className="panel__title">Fleet Impact Summary</h2>
      </div>

      <div className="panel__body">
        {/* Aggregate KPI strip */}
        <div className="swarm-kpi-strip">
          <div className="swarm-kpi">
            <span className="swarm-kpi__val" style={{ color: totalFuelDelta < 0 ? "#34d399" : "#f87171" }}>
              {totalFuelDelta > 0 ? "+" : ""}{totalFuelDelta.toLocaleString()} kg
            </span>
            <span className="swarm-kpi__label">Total Fuel Δ</span>
          </div>
          <div className="swarm-kpi">
            <span className="swarm-kpi__val" style={{ color: "#22d3ee" }}>
              {resolved}/{affected}
            </span>
            <span className="swarm-kpi__label">Flights Routed</span>
          </div>
          <div className="swarm-kpi">
            <span className="swarm-kpi__val" style={{ color: avgSafety >= 75 ? "#34d399" : "#f59e0b" }}>
              {avgSafety || "—"}{avgSafety ? "/100" : ""}
            </span>
            <span className="swarm-kpi__label">Avg Safety</span>
          </div>
          <div className="swarm-kpi">
            <span className="swarm-kpi__val" style={{ color: totalTimeDelta < 0 ? "#34d399" : "#f59e0b" }}>
              {totalTimeDelta > 0 ? "+" : ""}{totalTimeDelta} min
            </span>
            <span className="swarm-kpi__label">Total Time Δ</span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="swarm-progress-wrap">
          <div className="swarm-progress-bar" style={{ width: `${affected ? (resolved / affected) * 100 : 0}%` }} />
          <span className="swarm-progress-label">{resolved} of {affected} routes computed</span>
        </div>

        {/* Per-flight rows */}
        <div className="swarm-flight-list">
          {swarmResults.map((result, i) => (
            <FleetFlightRow
              key={result.id || i}
              result={result}
              index={i}
              color={COLORS[i % COLORS.length]}
              isHighlighted={(hoveredFlightId || selectedFlightId) === result.id}
              isSelected={selectedFlightId === result.id}
              onHover={onHoverFlight}
              onClick={() => onSelectFlight && onSelectFlight(result.id)}
            />
          ))}
        </div>

        {/* Action strip */}
        {anyActive && !allApproved && (
          <div className="swarm-actions" style={{ marginTop: "16px" }}>
            <button className="swarm-btn swarm-btn--approve" onClick={onApproveAll}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M20 6L9 17l-5-5"/>
              </svg>
              Approve All Routes
            </button>
            <button className="swarm-btn swarm-btn--reject" onClick={onRejectAll}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
              Reject All
            </button>
          </div>
        )}

        {allApproved && (
          <div className="swarm-approved-banner" style={{ marginTop: "16px" }}>
            ✓ All fleet routes approved and active
          </div>
        )}
      </div>
    </section>
  );
}
