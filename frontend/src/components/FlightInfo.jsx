function FlightInfo({ flight, loading, error, flightCount }) {
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
    <section className="panel">
      <div className="panel__header">
        <p className="panel__eyebrow">Left Panel</p>
        <h2 className="panel__title">Flight Information</h2>
      </div>
      <div className="panel__body">
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
      </div>
    </section>
  );
}

export default FlightInfo;
