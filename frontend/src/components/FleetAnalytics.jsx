import { useMemo } from "react";
import { computeFlightMetrics, summarizeFleetMetrics } from "../utils/metrics";

export default function FleetAnalytics({ 
  approvedReroutes = [], 
  simParams, 
  setSimParams 
}) {
  
  // Calculate summary metrics dynamically
  const fleetSummary = useMemo(() => {
    return summarizeFleetMetrics(approvedReroutes, simParams);
  }, [approvedReroutes, simParams]);

  // Handler for slider inputs
  const handleSliderChange = (param, value) => {
    setSimParams(prev => ({
      ...prev,
      [param]: parseFloat(value)
    }));
  };

  const resetParams = () => {
    setSimParams({
      fuelPrice: 1.10,
      carbonTax: 85,
      delayCost: 75,
      holdingTimeMin: 25,
      holdingFuelRate: 25
    });
  };

  // Compute breakdowns for SVG chart
  const breakdown = useMemo(() => {
    let fuelSavingsDollars = 0;
    let carbonSavingsDollars = 0;
    let delaySavingsDollars = 0;

    approvedReroutes.forEach(reroute => {
      const m = computeFlightMetrics(reroute.originalRoute, reroute.alternateRoute, simParams);
      
      // Fuel cost avoided (cruise + hold saved vs detour cruise)
      fuelSavingsDollars += m.netFuelSaved * simParams.fuelPrice;

      // Carbon offset savings
      carbonSavingsDollars += m.netCO2Saved * simParams.carbonTax;

      // Delay cost avoided
      delaySavingsDollars += simParams.holdingTimeMin * simParams.delayCost;
    });

    const total = fuelSavingsDollars + carbonSavingsDollars + delaySavingsDollars;
    
    return {
      fuel: Math.max(0, Math.round(fuelSavingsDollars)),
      carbon: Math.max(0, Math.round(carbonSavingsDollars)),
      delay: Math.max(0, Math.round(delaySavingsDollars)),
      total: total > 0 ? Math.round(total) : 1
    };
  }, [approvedReroutes, simParams]);

  // Donut chart stroke calculations
  const chartPercentages = useMemo(() => {
    const { fuel, carbon, delay, total } = breakdown;
    const pFuel = (fuel / total) * 100;
    const pCarbon = (carbon / total) * 100;
    const pDelay = (delay / total) * 100;

    // SVG Circumference of radius 50 is 2 * PI * 50 = 314.16
    const circ = 314.16;
    const strokeFuel = (pFuel / 100) * circ;
    const strokeCarbon = (pCarbon / 100) * circ;
    const strokeDelay = (pDelay / 100) * circ;

    return {
      pFuel: Math.round(pFuel),
      pCarbon: Math.round(pCarbon),
      pDelay: Math.round(pDelay),
      strokeFuel,
      strokeCarbon,
      strokeDelay,
      circ
    };
  }, [breakdown]);

  return (
    <div className="fleet-analytics">
      {/* ── Metric KPIs Header Grid ── */}
      <div className="analytics-kpis">
        <div className="kpi-card kpi-card--savings glow-cyan">
          <div className="kpi-card__badge">B2B ROI</div>
          <p className="kpi-card__label">Total Net Savings</p>
          <h2 className="kpi-card__value">
            ${fleetSummary.totalSavings.toLocaleString()}
          </h2>
          <div className="kpi-card__footer">
            Across {fleetSummary.flightsCount} optimized path approvals
          </div>
        </div>

        <div className="kpi-card glow-green">
          <p className="kpi-card__label">Jet Fuel Optimized</p>
          <h2 className="kpi-card__value text-green">
            {fleetSummary.totalFuelSaved.toLocaleString()} kg
          </h2>
          <div className="kpi-card__footer">
            Equivalent to ${Math.round(fleetSummary.totalFuelSaved * simParams.fuelPrice).toLocaleString()} saved
          </div>
        </div>

        <div className="kpi-card glow-blue">
          <p className="kpi-card__label">CO2 Carbon Offsets</p>
          <h2 className="kpi-card__value text-blue">
            {fleetSummary.totalCO2Saved.toFixed(2)} Tons
          </h2>
          <div className="kpi-card__footer">
            Tax savings: ${Math.round(fleetSummary.totalCO2Saved * simParams.carbonTax).toLocaleString()}
          </div>
        </div>

        <div className="kpi-card glow-amber">
          <p className="kpi-card__label">Total Hold Delay Avoided</p>
          <h2 className="kpi-card__value text-amber">
            {fleetSummary.totalTimeSaved.toLocaleString()} mins
          </h2>
          <div className="kpi-card__footer">
            ~{(fleetSummary.totalTimeSaved / 60).toFixed(1)} flight hours holding prevented
          </div>
        </div>
      </div>

      {/* ── Main Layout: Controls & Charts ── */}
      <div className="analytics-grid">
        
        {/* Left Side: Simulation Parameters Controls */}
        <div className="panel simulation-controls-panel">
          <div className="panel__header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <p className="panel__eyebrow">Enterprise Parameters</p>
              <h2 className="panel__title">Live Control Room</h2>
            </div>
            <button className="reset-params-btn" onClick={resetParams}>
              Reset Defaults
            </button>
          </div>

          <div className="panel__body">
            <p className="controls-description">
              Tweak market variables and operational penalties below. Fleet ROI calculations, savings, and individual flight metrics will update in real-time.
            </p>

            <div className="sliders-container">
              <div className="slider-group">
                <div className="slider-header">
                  <span className="slider-label">Jet Fuel Cost</span>
                  <span className="slider-val">${simParams.fuelPrice.toFixed(2)} / kg</span>
                </div>
                <input 
                  type="range" 
                  min="0.50" 
                  max="3.00" 
                  step="0.05"
                  value={simParams.fuelPrice} 
                  onChange={(e) => handleSliderChange('fuelPrice', e.target.value)}
                  className="custom-range"
                />
                <span className="slider-subtext">Current market average for Jet A-1 fuel</span>
              </div>

              <div className="slider-group">
                <div className="slider-header">
                  <span className="slider-label">CO2 Carbon Tax Rate</span>
                  <span className="slider-val">${simParams.carbonTax} / Ton</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="200" 
                  step="5"
                  value={simParams.carbonTax} 
                  onChange={(e) => handleSliderChange('carbonTax', e.target.value)}
                  className="custom-range"
                />
                <span className="slider-subtext">Tax penalty per metric ton of emitted carbon dioxide</span>
              </div>

              <div className="slider-group">
                <div className="slider-header">
                  <span className="slider-label">Holding Penalty</span>
                  <span className="slider-val">${simParams.delayCost} / min</span>
                </div>
                <input 
                  type="range" 
                  min="20" 
                  max="150" 
                  step="5"
                  value={simParams.delayCost} 
                  onChange={(e) => handleSliderChange('delayCost', e.target.value)}
                  className="custom-range"
                />
                <span className="slider-subtext">Overtime costs, scheduling penalties, & gate fees</span>
              </div>

              <div className="slider-group">
                <div className="slider-header">
                  <span className="slider-label">Avg Weather Hold Time</span>
                  <span className="slider-val">{simParams.holdingTimeMin} minutes</span>
                </div>
                <input 
                  type="range" 
                  min="10" 
                  max="60" 
                  step="1"
                  value={simParams.holdingTimeMin} 
                  onChange={(e) => handleSliderChange('holdingTimeMin', e.target.value)}
                  className="custom-range"
                />
                <span className="slider-subtext">Holding pattern wait time if flying directly through storm</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Charts & Approved List */}
        <div className="analytics-details">
          
          {/* Charts Row */}
          <div className="panel chart-panel">
            <div className="panel__header">
              <p className="panel__eyebrow">Financial Visualizer</p>
              <h2 className="panel__title">Savings Breakdown</h2>
            </div>
            
            <div className="panel__body chart-body-row">
              {/* Donut Chart Container */}
              <div className="donut-chart-container">
                <svg width="220" height="220" viewBox="0 0 140 140" className="donut-svg">
                  <circle cx="70" cy="70" r="50" fill="transparent" stroke="rgba(255,255,255,0.03)" strokeWidth="12" />
                  
                  {/* Fuel Savings Segment */}
                  {chartPercentages.strokeFuel > 0 && (
                    <circle 
                      cx="70" cy="70" r="50" 
                      fill="transparent" 
                      stroke="var(--green)" 
                      strokeWidth="12" 
                      strokeDasharray={`${chartPercentages.strokeFuel} ${chartPercentages.circ}`}
                      strokeDashoffset="0"
                      transform="rotate(-90 70 70)"
                    />
                  )}

                  {/* Carbon Tax Savings Segment */}
                  {chartPercentages.strokeCarbon > 0 && (
                    <circle 
                      cx="70" cy="70" r="50" 
                      fill="transparent" 
                      stroke="var(--blue)" 
                      strokeWidth="12" 
                      strokeDasharray={`${chartPercentages.strokeCarbon} ${chartPercentages.circ}`}
                      strokeDashoffset={-chartPercentages.strokeFuel}
                      transform="rotate(-90 70 70)"
                    />
                  )}

                  {/* Delay Savings Segment */}
                  {chartPercentages.strokeDelay > 0 && (
                    <circle 
                      cx="70" cy="70" r="50" 
                      fill="transparent" 
                      stroke="var(--amber)" 
                      strokeWidth="12" 
                      strokeDasharray={`${chartPercentages.strokeDelay} ${chartPercentages.circ}`}
                      strokeDashoffset={-(chartPercentages.strokeFuel + chartPercentages.strokeCarbon)}
                      transform="rotate(-90 70 70)"
                    />
                  )}

                  <text x="70" y="66" className="donut-text-title" textAnchor="middle">SAVED</text>
                  <text x="70" y="84" className="donut-text-val" textAnchor="middle">${breakdown.total.toLocaleString()}</text>
                </svg>

                {/* Donut Legend */}
                <div className="donut-legend">
                  <div className="legend-item">
                    <span className="legend-dot bg-green"></span>
                    <span className="legend-label">Fuel Cost Avoided ({chartPercentages.pFuel}%)</span>
                    <span className="legend-val">${breakdown.fuel.toLocaleString()}</span>
                  </div>
                  <div className="legend-item">
                    <span className="legend-dot bg-blue"></span>
                    <span className="legend-label">Carbon Tax Offset ({chartPercentages.pCarbon}%)</span>
                    <span className="legend-val">${breakdown.carbon.toLocaleString()}</span>
                  </div>
                  <div className="legend-item">
                    <span className="legend-dot bg-amber"></span>
                    <span className="legend-label">Holding Penalty Saved ({chartPercentages.pDelay}%)</span>
                    <span className="legend-val">${breakdown.delay.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Table: Fleet Optimization Ledger */}
          <div className="panel ledger-panel">
            <div className="panel__header">
              <p className="panel__eyebrow">Audit Log</p>
              <h2 className="panel__title">Optimization Ledger</h2>
            </div>
            
            <div className="panel__body" style={{ padding: 0 }}>
              {approvedReroutes.length === 0 ? (
                <div className="empty-ledger">
                  <p>No optimization reroutes approved yet.</p>
                  <p className="sub">Switch to Tactical Flight Deck and select a flight to inject a storm and approve a path optimization!</p>
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="ledger-table">
                    <thead>
                      <tr>
                        <th>Flight</th>
                        <th>Carrier</th>
                        <th>Sector</th>
                        <th>Fuel Impact</th>
                        <th>CO2 Offset</th>
                        <th>Net B2B Return</th>
                        <th>Safety</th>
                      </tr>
                    </thead>
                    <tbody>
                      {approvedReroutes.map((reroute, idx) => {
                        const m = computeFlightMetrics(reroute.originalRoute, reroute.alternateRoute, simParams);
                        return (
                          <tr key={reroute.flightId + "-" + idx}>
                            <td className="text-strong font-mono">{reroute.flightNumber}</td>
                            <td>{reroute.airline}</td>
                            <td>{reroute.origin.split(" ")[0]} → {reroute.destination.split(" ")[0]}</td>
                            <td className={m.netFuelSaved >= 0 ? "text-green" : "text-red"}>
                              {m.netFuelSaved > 0 ? "+" : ""}{m.netFuelSaved.toLocaleString()} kg
                            </td>
                            <td>{m.netCO2Saved.toFixed(2)} T</td>
                            <td className="text-cyan font-bold">${m.netSavings.toLocaleString()}</td>
                            <td>
                              <span className="table-safety-pill">
                                {reroute.metrics?.safetyScore || 92}%
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
