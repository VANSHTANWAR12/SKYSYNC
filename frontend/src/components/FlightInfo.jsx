

function FlightInfo({
  flight,
  loading,
  error,
  flights = [],
  onSelectFlight,
  swarmMode = false,
  hoveredFlightId = null,
  onHoverFlight = null,
  swarmSelectedFlightIds = [],
  onToggleSwarmFlight = null,
}) {
  const details = flight
    ? [
        ["Flight Number", flight.flightNumber],
        ["Airline", flight.airline],
        ["Origin", flight.origin],
        ["Destination", flight.destination],
        ["Status", flight.status],
        ["Altitude", `${flight.altitude} ft`],
        ["Speed", `${flight.speed} km/h`],
      ]
    : [];

  return (
    <article className="panel">
      <div className="panel__header">
        <p className="panel__eyebrow">Left Panel</p>
        <h2 className="panel__title">Flight Information</h2>
      </div>
      <div className="panel__body">
        <div className="flight-card">
          <div className="flight-card__summary">
            {loading ? (
              <>
                <h3 className="flight-card__number">Syncing...</h3>
                <p className="flight-card__route">Initializing satellite swarm feed...</p>
                <div className="flight-card__status flight-card__status--loading">Connecting</div>
              </>
            ) : error ? (
              <>
                <h3 className="flight-card__number">Offline</h3>
                <p className="flight-card__route">{error}</p>
                <div className="flight-card__status flight-card__status--error">Data Error</div>
              </>
            ) : flight ? (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
                  <h3 className="flight-card__number">{flight.flightNumber}</h3>
                  <button 
                     className="clear-selection-btn"
                     onClick={() => onSelectFlight(null)}
                  >
                    Deselect
                  </button>
                </div>
                <p className="flight-card__route">
                  {flight.airline} · {flight.origin} to {flight.destination}
                </p>
                <div className="flight-card__status">Active Tracking</div>
              </>
            ) : swarmMode ? (
              <>
                <h3 className="flight-card__number" style={{ color: "#22d3ee" }}>⚡ Swarm Fleet</h3>
                <p className="flight-card__route">{swarmSelectedFlightIds.length}/5 flights armed · Inject Storm to trigger fleet-wide rerouting</p>
                <div className="flight-card__status" style={{ color: "#22d3ee", borderColor: "rgba(34,211,238,0.3)" }}>Swarm Active</div>
              </>
            ) : (
              <>
                <h3 className="flight-card__number">Select a Flight</h3>
                <p className="flight-card__route">Click a dot on the map or select from the fleet switcher below.</p>
                <div className="flight-card__status">Standby</div>
              </>
            )}
          </div>

          <div className="flight-switcher">
            <p className="flight-switcher__label">
              {swarmMode ? `⚡ Swarm Selection (${swarmSelectedFlightIds.length}/5)` : `Active Fleet (${flights.length})`}
            </p>
            <div className="flight-switcher__list">
              {flights.map((f) => {
                const isSwarmSelected = swarmMode && swarmSelectedFlightIds.includes(f.id);
                return (
                  <div
                    key={f.id}
                    className={`flight-tab-wrapper ${swarmMode ? "flight-tab-wrapper--swarm" : ""}`}
                    onMouseEnter={() => onHoverFlight && onHoverFlight(f.id)}
                    onMouseLeave={() => onHoverFlight && onHoverFlight(null)}
                  >
                    {swarmMode && (
                      <button
                        className={`flight-tab-checkbox ${isSwarmSelected ? "flight-tab-checkbox--selected" : ""}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleSwarmFlight && onToggleSwarmFlight(f.id);
                        }}
                        title={isSwarmSelected ? "Remove from swarm" : "Add to swarm"}
                      >
                        {isSwarmSelected ? "✓" : ""}
                      </button>
                    )}
                    <button
                      className={`flight-tab ${f.id === flight?.id ? "flight-tab--active" : ""} ${f.id === hoveredFlightId ? "flight-tab--hovered" : ""}`}
                      onClick={() => onSelectFlight(f.id)}
                      style={{ flex: 1 }}
                    >
                      <span className="flight-tab__name">{f.flightNumber}</span>
                      <span className="flight-tab__airline">{f.airline}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="telemetry-grid">
            {details.map(([label, value]) => (
              <div className="telemetry-item" key={label}>
                <span className="telemetry-item__label">{label}</span>
                <span className="telemetry-item__value">{value || "N/A"}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </article>
  );
}

export default FlightInfo;
