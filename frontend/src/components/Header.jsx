function Header({ utcTime, systemStatus }) {
  return (
    <header className="dashboard-header">
      <div className="brand">
        <div className="brand__mark" aria-hidden="true">
          SY
        </div>
        <div className="brand__text">
          <p className="brand__name">SkySync</p>
          <p className="brand__tagline">Autonomous rerouting control</p>
        </div>
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
