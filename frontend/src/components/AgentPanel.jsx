function AgentPanel({ agentData = {} }) {
  const weatherAgent = agentData.weatherAgent;
  const trafficAgent = agentData.trafficAgent;

  return (
    <section className="panel">
      <div className="panel__header">
        <p className="panel__eyebrow">Right Panel</p>
        <h2 className="panel__title">Agent Monitoring</h2>
      </div>
      <div className="panel__body">
        {weatherAgent || trafficAgent ? (
          <div className="agent-summary">
            <div className="detail-item">
              <span className="detail-item__label">Risk Summary</span>
              <span className="detail-item__value">{weatherAgent?.riskScore ?? 0}/100</span>
            </div>
            <div className="detail-item">
              <span className="detail-item__label">Threat Zones</span>
              <span className="detail-item__value">{weatherAgent?.threatCount ?? 0}</span>
            </div>
          </div>
        ) : null}

        <div className="agent-list">
          {weatherAgent ? (
            <article className="agent-card">
              <div className="agent-card__top">
                <h3 className="agent-card__name">Weather Agent</h3>
                <span className="health-chip health-chip--amber">
                  <span className="health-chip__dot" aria-hidden="true" />
                  {weatherAgent.riskScore}%
                </span>
              </div>

              <div className="agent-card__meta">
                <span className="agent-state agent-state--monitoring">
                  <span className="agent-state__indicator" aria-hidden="true" />
                  {weatherAgent.status || "Online"}
                </span>
                <span>Last scan {weatherAgent.lastScan ? new Date(weatherAgent.lastScan).toLocaleTimeString("en-GB", { hour12: false, timeZone: "UTC" }) : "N/A"}</span>
              </div>
              <div className="agent-card__meta">
                <span>Threat Count: {weatherAgent.threatCount ?? 0}</span>
                <span>State: {weatherAgent.state || "Monitoring"}</span>
              </div>
            </article>
          ) : null}

          {trafficAgent ? (
            <article className="agent-card">
              <div className="agent-card__top">
                <h3 className="agent-card__name">Traffic Agent</h3>
                <span className={`health-chip health-chip--${trafficAgent.congestionLevel === "HIGH" ? "red" : trafficAgent.congestionLevel === "MEDIUM" ? "amber" : "green"}`}>
                  <span className="health-chip__dot" aria-hidden="true" />
                  {trafficAgent.congestionLevel}
                </span>
              </div>

              <div className="agent-card__meta">
                <span className="agent-state agent-state--monitoring">
                  <span className="agent-state__indicator" aria-hidden="true" />
                  {trafficAgent.status || "Online"}
                </span>
                <span>Last scan {trafficAgent.lastScan ? new Date(trafficAgent.lastScan).toLocaleTimeString("en-GB", { hour12: false, timeZone: "UTC" }) : "N/A"}</span>
              </div>
              <div className="agent-card__meta">
                <span>Aircraft Count: {trafficAgent.aircraftCount ?? 0}</span>
                <span>Region: {trafficAgent.region || "India Airspace"}</span>
              </div>
            </article>
          ) : null}

          {!weatherAgent && !trafficAgent ? (
            <div className="feed-item">
              <div className="feed-item__text">Agent telemetry is not available yet.</div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export default AgentPanel;
