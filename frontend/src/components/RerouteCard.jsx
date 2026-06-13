/**
 * SkySync — RerouteCard
 * Glassmorphism floating card shown when a reroute simulation is active.
 * Displays: route comparison metrics, agent reasoning log, approve/reject CTA.
 */
import { useState } from "react";

/** Map agent log entry type → colour token */
const LOG_TYPE_COLOR = {
  SCAN:     "#60a5fa",   // blue
  ANALYSIS: "#f59e0b",  // amber
  COMPUTE:  "#a78bfa",  // purple
  DECISION: "#34d399",  // green
  METRICS:  "#22d3ee",  // cyan
  INFO:     "#94a3b8",  // muted
};

/** Map severity → colour */
const AGENT_COLOR = {
  "Weather Agent":    "#f59e0b",
  "Traffic Agent":    "#60a5fa",
  "Navigation Agent": "#34d399",
  "Captain":          "#22d3ee",
  "System":           "#ef4444",
};

const AGENT_BG = {
  "Weather Agent":    "rgba(245, 158, 11, 0.15)",
  "Traffic Agent":    "rgba(96, 165, 250, 0.15)",
  "Navigation Agent": "rgba(52, 211, 153, 0.15)",
};

const AGENT_BORDER = {
  "Weather Agent":    "rgba(245, 158, 11, 0.3)",
  "Traffic Agent":    "rgba(96, 165, 250, 0.3)",
  "Navigation Agent": "rgba(52, 211, 153, 0.3)",
};

function getAgentIcon(agentName, isFinal) {
  if (isFinal) {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
        <polyline points="22 4 12 14.01 9 11.01"/>
      </svg>
    );
  }
  if (agentName.includes("Weather")) {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17.5 19A3.5 3.5 0 0 0 21 15.5c0-2.79-2.54-4.5-5-4.5-.42-1.04-1.21-1.88-2.2-2.4A5.5 5.5 0 0 0 4 11.5c0 2.21 1.79 4 4 4h9.5M13 22l-2-4h4l-2 4"/>
      </svg>
    );
  }
  if (agentName.includes("Traffic")) {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 12a10 10 0 0 1 18-6M6 12a6 6 0 0 1 10.8-3.6M10 12a2 2 0 0 1 3.6-1.2"/>
      </svg>
    );
  }
  if (agentName.includes("Navigation")) {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="3 11 22 2 13 21 11 13 3 11"/>
      </svg>
    );
  }
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="16" x2="12" y2="12"/>
      <line x1="12" y1="8" x2="12.01" y2="8"/>
    </svg>
  );
}

function MetricRow({ label, orig, alt, unit = "", better = "lower" }) {
  const delta = alt - orig;
  const pct   = orig !== 0 ? Math.abs(delta / orig * 100).toFixed(1) : 0;
  const improved = better === "lower" ? delta < 0 : delta > 0;
  const sign = delta > 0 ? "+" : "";
  return (
    <div className="rc-metric">
      <span className="rc-metric__label">{label}</span>
      <div className="rc-metric__values">
        <span className="rc-metric__orig">{orig.toLocaleString()}{unit}</span>
        <svg className="rc-metric__arrow" width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.5">
          <path d="M5 12h14M12 5l7 7-7 7"/>
        </svg>
        <span className="rc-metric__alt">{alt.toLocaleString()}{unit}</span>
        <span className={`rc-metric__delta ${improved ? "rc-metric__delta--good" : "rc-metric__delta--bad"}`}>
          {sign}{delta.toLocaleString()}{unit} ({improved ? "-" : "+"}{pct}%)
        </span>
      </div>
    </div>
  );
}

export default function RerouteCard({
  rerouteData,
  rerouteStatus,
  agentLog,
  showOriginal,
  onToggleOriginal,
  onApprove,
  onReject,
}) {
  const [logExpanded, setLogExpanded] = useState(false);

  if (!rerouteData || (rerouteStatus !== "active" && rerouteStatus !== "approved")) return null;

  const { metrics, originalRoute, alternateRoute, flightNumber, airline } = rerouteData;
  const isApproved = rerouteStatus === "approved";

  return (
    <div className="reroute-card" role="dialog" aria-label="Reroute Comparison">
      {/* ── Header ── */}
      <div className="reroute-card__header">
        <div className="reroute-card__title-block">
          <span className="reroute-card__eyebrow">🌩 Storm Injection Active</span>
          <h3 className="reroute-card__title">{flightNumber} · {airline}</h3>
        </div>
        <div className={`reroute-card__status-pill ${isApproved ? "reroute-card__status-pill--approved" : ""}`}>
          {isApproved ? "✓ APPROVED" : "⏳ PENDING"}
        </div>
      </div>

      {/* ── Safety Score ── */}
      <div className="reroute-card__safety">
        <span className="reroute-card__safety-label">AI Safety Score</span>
        <div className="reroute-card__safety-bar-wrap">
          <div
            className="reroute-card__safety-bar"
            style={{ width: `${metrics.safetyScore}%` }}
          />
        </div>
        <span className="reroute-card__safety-score">{metrics.safetyScore}/100</span>
      </div>

      {/* ── Route Legend ── */}
      <div className="reroute-card__legend">
        <span className="reroute-card__legend-item reroute-card__legend-item--orig">
          <span className="reroute-card__legend-dash" />
          Original Route
        </span>
        <span className="reroute-card__legend-item reroute-card__legend-item--alt">
          <span className="reroute-card__legend-solid" />
          Alternate Route
        </span>
      </div>

      {/* ── Metrics ── */}
      <div className="reroute-card__metrics">
        <MetricRow
          label="Fuel"
          orig={metrics.originalFuelKg}
          alt={metrics.alternateFuelKg}
          unit=" kg"
          better="lower"
        />
        <MetricRow
          label="Flight Time"
          orig={metrics.originalTimeMin}
          alt={metrics.alternateTimeMin}
          unit=" min"
          better="lower"
        />
        <MetricRow
          label="Distance"
          orig={Math.round(originalRoute.totalDistanceKm)}
          alt={Math.round(alternateRoute.totalDistanceKm)}
          unit=" km"
          better="lower"
        />
      </div>

      {/* ── Toggle original route ── */}
      <label className="reroute-card__toggle">
        <input
          type="checkbox"
          checked={showOriginal}
          onChange={e => onToggleOriginal(e.target.checked)}
        />
        <span className="reroute-card__toggle-track">
          <span className="reroute-card__toggle-thumb" />
        </span>
        <span className="reroute-card__toggle-label">Show Original Route</span>
      </label>

      {/* ── Agent Log ── */}
      <div className="reroute-card__log-section">
        <button
          className="reroute-card__log-toggle"
          onClick={() => setLogExpanded(v => !v)}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
            style={{ transform: logExpanded ? "rotate(90deg)" : "none", transition: "transform 0.2s" }}>
            <path d="M9 18l6-6-6-6"/>
          </svg>
          Agent Reasoning Log ({agentLog.length} steps)
        </button>

        {logExpanded && (
          <div className="reroute-card__log-accordion">
            <div className="accordion-header">
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span className="accordion-logo">✈</span>
                <span className="accordion-title">{flightNumber}</span>
              </div>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M18 15l-6-6-6 6"/>
              </svg>
            </div>

            <div className="timeline-container">
              {agentLog.map((entry, i) => {
                const isFinal = entry.agent.toLowerCase().includes("final") || entry.type === "DECISION" || i === agentLog.length - 1;
                return (
                  <div key={i} className="timeline-item">
                    <div 
                      className="timeline-icon"
                      style={{ 
                        background: isFinal ? "rgba(239, 68, 68, 0.15)" : AGENT_BG[entry.agent] || "rgba(148, 163, 184, 0.15)",
                        color: isFinal ? "#ef4444" : AGENT_COLOR[entry.agent] || "#94a3b8",
                        border: `1px solid ${isFinal ? "rgba(239, 68, 68, 0.3)" : AGENT_BORDER[entry.agent] || "rgba(148, 163, 184, 0.3)"}`
                      }}
                    >
                      {getAgentIcon(entry.agent, isFinal)}
                    </div>
                    <div className="timeline-content">
                      <span className="timeline-agent">{entry.agent}:</span>
                      {entry.message}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Action Buttons ── */}
      {!isApproved && (
        <div className="reroute-card__actions">
          <button className="reroute-card__btn reroute-card__btn--approve" onClick={onApprove}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M20 6L9 17l-5-5"/>
            </svg>
            Approve Reroute
          </button>
          <button className="reroute-card__btn reroute-card__btn--reject" onClick={onReject}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
            Reject
          </button>
        </div>
      )}

      {isApproved && (
        <div className="reroute-card__approved-msg">
          ✓ Alternate route is now the active flight plan.
          <button className="reroute-card__dismiss" onClick={onReject}>Dismiss</button>
        </div>
      )}
    </div>
  );
}
