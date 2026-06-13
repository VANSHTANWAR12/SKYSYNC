/**
 * SkySync — RerouteCard
 * Glassmorphism floating card shown when a reroute simulation is active.
 * Displays: route comparison metrics, agent reasoning log, approve/reject CTA.
 */
import { useState, useRef, useEffect } from "react";

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
  const [logExpanded, setLogExpanded] = useState(true);
  const cardRef = useRef(null);

  // Position: initially null to let CSS handle it via top/right, then explicitly pixel coordinates
  const [position, setPosition] = useState({ x: null, y: null });
  // Size: default width is 310px
  const [size, setSize] = useState({ width: 310, height: null });
  const [isDragging, setIsDragging] = useState(false);

  // Reset positioning when data/status changes so it defaults back to top-right
  useEffect(() => {
    setPosition({ x: null, y: null });
    setSize({ width: 310, height: null });
  }, [rerouteData?.flightNumber, rerouteStatus]);

  if (!rerouteData || (rerouteStatus !== "active" && rerouteStatus !== "approved")) return null;

  const { metrics, originalRoute, alternateRoute, flightNumber, airline, copilot } = rerouteData;
  const isApproved = rerouteStatus === "approved";

  // Dragging logic
  const handleDragStart = (e) => {
    // Avoid dragging when clicking buttons, inputs, labels, scrollbars, etc.
    if (
      e.target.closest("button") ||
      e.target.closest("input") ||
      e.target.closest("label") ||
      e.target.closest("a") ||
      e.target.closest(".reroute-card__log")
    ) {
      return;
    }
    e.preventDefault();

    const card = cardRef.current;
    if (!card) return;

    const parent = card.parentElement;
    if (!parent) return;

    const cardRect = card.getBoundingClientRect();
    const parentRect = parent.getBoundingClientRect();

    const offsetX = e.clientX - cardRect.left;
    const offsetY = e.clientY - cardRect.top;

    setIsDragging(true);

    const handleMouseMove = (moveEvent) => {
      const nextLeft = moveEvent.clientX - parentRect.left - offsetX;
      const nextTop = moveEvent.clientY - parentRect.top - offsetY;

      // Clamp values so card stays inside the parent map-shell
      const clampedLeft = Math.max(0, Math.min(parentRect.width - cardRect.width, nextLeft));
      const clampedTop = Math.max(0, Math.min(parentRect.height - cardRect.height, nextTop));

      setPosition({ x: clampedLeft, y: clampedTop });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  // Resizing logic
  const handleResizeStart = (direction, e) => {
    e.preventDefault();
    e.stopPropagation();

    const card = cardRef.current;
    if (!card) return;

    const parent = card.parentElement;
    if (!parent) return;

    const cardRect = card.getBoundingClientRect();
    const parentRect = parent.getBoundingClientRect();

    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = cardRect.width;
    const startHeight = cardRect.height;

    // Resolve initial positions to current layout position relative to parent
    const initialLeft = position.x !== null ? position.x : (cardRect.left - parentRect.left);
    const initialTop = position.y !== null ? position.y : (cardRect.top - parentRect.top);

    const handleMouseMove = (moveEvent) => {
      let newWidth = startWidth;
      let newHeight = startHeight;

      if (direction === "e" || direction === "se") {
        newWidth = startWidth + (moveEvent.clientX - startX);
      }
      if (direction === "s" || direction === "se") {
        newHeight = startHeight + (moveEvent.clientY - startY);
      }

      // Size constraints
      const minWidth = 280;
      const maxWidth = Math.min(800, parentRect.width - initialLeft);
      const minHeight = 200;
      const maxHeight = Math.min(window.innerHeight - 40, parentRect.height - initialTop);

      newWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));
      newHeight = Math.max(minHeight, Math.min(maxHeight, newHeight));

      setSize({ width: newWidth, height: newHeight });

      // Lock position so card does not shift relative to left/top during resizing
      if (position.x === null || position.y === null) {
        setPosition({ x: initialLeft, y: initialTop });
      }
    };

    const handleMouseUp = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  const inlineStyle = {
    ...(position.x !== null ? { left: `${position.x}px`, right: "auto" } : {}),
    ...(position.y !== null ? { top: `${position.y}px` } : {}),
    width: `${size.width}px`,
    ...(size.height !== null ? { height: `${size.height}px` } : {}),
  };

  return (
    <div
      ref={cardRef}
      className={`reroute-card ${isDragging ? "reroute-card--dragging" : ""}`}
      style={inlineStyle}
      role="dialog"
      aria-label="Reroute Comparison"
    >
      {/* ── Header / Drag Handle ── */}
      <div className="reroute-card__header" onMouseDown={handleDragStart}>
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

      {/* ── GenAI Copilot Briefing ── */}
      {copilot && (
        <div className="reroute-card__copilot-panel">
          <div className="rc-copilot__header">
            <span className="rc-copilot__sparkle">✦</span>
            <span className="rc-copilot__title">AI Copilot Dispatch Briefing</span>
          </div>
          <p className="rc-copilot__text">{copilot.briefing}</p>
          {copilot.atc_script && (
            <div className="rc-copilot__atc">
              <span className="rc-copilot__atc-label">Suggested ATC Radio Call:</span>
              <code className="rc-copilot__atc-code">"{copilot.atc_script}"</code>
            </div>
          )}
        </div>
      )}

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
          <div className="reroute-card__log">
            {agentLog.map((entry, i) => (
              <div key={i} className="log-entry">
                <div className="log-entry__header">
                  <span
                    className="log-entry__agent"
                    style={{ color: AGENT_COLOR[entry.agent] || "#94a3b8" }}
                  >
                    {entry.agent}
                  </span>
                  <span
                    className="log-entry__type"
                    style={{ color: LOG_TYPE_COLOR[entry.type] || "#94a3b8" }}
                  >
                    [{entry.type}]
                  </span>
                  <span className="log-entry__time">
                    {new Date(entry.timestamp).toLocaleTimeString("en-GB", {
                      hour12: false, timeZone: "UTC"
                    })}
                  </span>
                </div>
                <p className="log-entry__msg">{entry.message}</p>
              </div>
            ))}
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

      {/* ── Resize Handles ── */}
      {!isApproved && (
        <>
          <div
            className="reroute-card__resize-handle reroute-card__resize-handle--e"
            onMouseDown={(e) => handleResizeStart("e", e)}
          />
          <div
            className="reroute-card__resize-handle reroute-card__resize-handle--s"
            onMouseDown={(e) => handleResizeStart("s", e)}
          />
          <div
            className="reroute-card__resize-handle reroute-card__resize-handle--se"
            onMouseDown={(e) => handleResizeStart("se", e)}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" className="resize-se-icon">
              <line x1="10" y1="0" x2="0" y2="10" stroke="rgba(34,211,238,0.4)" strokeWidth="1.5" />
              <line x1="10" y1="4" x2="4" y2="10" stroke="rgba(34,211,238,0.4)" strokeWidth="1.5" />
              <line x1="10" y1="8" x2="8" y2="10" stroke="rgba(34,211,238,0.4)" strokeWidth="1.5" />
            </svg>
          </div>
        </>
      )}
    </div>
  );
}

