/**
 * SkySync — Header
 * Top bar with brand, mode toggle, system status and UTC clock.
 */
function Header({ utcTime, systemStatus, swarmMode, onToggleSwarm }) {
  return (
    <header className="dashboard-header">
      <div className="brand">
        <div className="brand__mark" aria-hidden="true">SY</div>
        <div className="brand__text">
          <p className="brand__name">SkySync</p>
          <p className="brand__tagline">Autonomous rerouting control</p>
        </div>
      </div>

      {/* ── Mode Toggle ── */}
      <div className="mode-toggle-wrap" title={swarmMode ? "Switch to Single Flight Mode" : "Switch to Swarm Mode"}>
        <span className={`mode-toggle-label ${!swarmMode ? "mode-toggle-label--active" : ""}`}>Single</span>

        <button
          id="mode-toggle-btn"
          className={`mode-toggle-btn ${swarmMode ? "mode-toggle-btn--swarm" : ""}`}
          onClick={onToggleSwarm}
          aria-pressed={swarmMode}
          aria-label="Toggle between Single Flight and Swarm Mode"
        >
          <span className="mode-toggle-btn__track">
            <span className="mode-toggle-btn__thumb" />
          </span>
        </button>

        <span className={`mode-toggle-label ${swarmMode ? "mode-toggle-label--active mode-toggle-label--swarm" : ""}`}>
          ⚡ Swarm
        </span>
      </div>

      <div className="header-meta">
        <div className="status-pill">
          <span className="status-dot" aria-hidden="true" />
          {systemStatus}
        </div>
        <div className="time-pill">UTC {utcTime}</div>
        <h1 className="dashboard-title">Airline Operations Dashboard</h1>
      </div>
    </header>
  );
}

export default Header;
