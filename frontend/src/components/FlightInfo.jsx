function FlightInfo({ flight, flights = [], selectedFlightId, onSelectFlight, loading, error, flightCount }) {
  const details = flight
    ? [
        ["Flight Number", flight.flightNumber],
        ["Airline", flight.airline],
        ["Origin", flight.origin],
        ["Destination", flight.destination],
        ["Status", flight.status],
        ["Altitude", flight.altitude],
        ["Speed", flight.speed],
        ["Fuel Remaining", flight.fuelRemaining],
      ]
    : [];

  return (
    <section className="panel" style={{ display: "flex", flexDirection: "column", height: "100%", maxHeight: "calc(100vh - 120px)" }}>
      <div className="panel__header">
        <p className="panel__eyebrow">Left Panel</p>
        <h2 className="panel__title">Flight Information</h2>
      </div>
      <div className="panel__body" style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "18px", paddingRight: "4px" }}>
          
          <div className="flight-card">
            <div className="flight-card__summary">
              {loading ? (
                <>
                  <h3 className="flight-card__number">Loading flights...</h3>
                  <p className="flight-card__route">Fetching live flight data from the backend.</p>
                  <div className="flight-card__status">Synchronizing</div>
                </>
              ) : error ? (
                <>
                  <h3 className="flight-card__number">Live data unavailable</h3>
                  <p className="flight-card__route">{error}</p>
                  <div className="flight-card__status">Data Error</div>
                </>
              ) : flight ? (
                <>
                  <h3 className="flight-card__number">{flight.flightNumber}</h3>
                  <p className="flight-card__route">
                    {flight.airline} · {flight.origin} to {flight.destination}
                  </p>
                  <div className="flight-card__status">{flight.status}</div>
                </>
              ) : (
                <>
                  <h3 className="flight-card__number">No live flights</h3>
                  <p className="flight-card__route">The backend returned no active flight records.</p>
                  <div className="flight-card__status">Awaiting feed</div>
                </>
              )}
            </div>

            <div className="detail-list">
              <div className="detail-item">
                <span className="detail-item__label">Active Flights</span>
                <span className="detail-item__value">{flightCount}</span>
              </div>

              {details.map(([label, value]) => (
                <div className="detail-item" key={label}>
                  <span className="detail-item__label">{label}</span>
                  <span className="detail-item__value">{value || "N/A"}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Active Flights List */}
          {flights.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", borderTop: "1px solid rgba(148, 163, 184, 0.12)", paddingTop: "14px" }}>
              <h3 style={{ fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.14em", color: "var(--muted)", margin: "0 0 6px" }}>
                Active Flights Feed
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {flights.map((f) => {
                  const isSelected = selectedFlightId === f.id || (!selectedFlightId && flights[0]?.id === f.id);
                  return (
                    <div
                      key={f.id}
                      onClick={() => onSelectFlight && onSelectFlight(f.id)}
                      style={{
                        padding: "12px 14px",
                        borderRadius: "16px",
                        background: isSelected ? "rgba(86, 199, 255, 0.1)" : "rgba(255, 255, 255, 0.02)",
                        border: isSelected ? "1px solid rgba(86, 199, 255, 0.3)" : "1px solid rgba(148, 163, 184, 0.12)",
                        cursor: "pointer",
                        transition: "all 0.2s ease",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontWeight: "700", color: "var(--text-strong)", fontSize: "14px" }}>{f.flightNumber}</span>
                        <span style={{ fontSize: "11px", color: "var(--blue)", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                          {f.airline}
                        </span>
                      </div>
                      <div style={{ fontSize: "12px", color: "var(--muted-strong)", marginTop: "4px", display: "flex", justifyContent: "space-between" }}>
                        <span>{f.origin} ➔ {f.destination}</span>
                        <span style={{ color: "var(--muted)", fontSize: "11px" }}>{f.altitude} ft</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>
      </div>
    </section>
  );
}

export default FlightInfo;
