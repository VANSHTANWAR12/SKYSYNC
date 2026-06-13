/**
 * SkySync — Flight Metrics Calculation Utility
 * Performs flight-level dynamic B2B ROI calculations.
 * Converts physical differences (fuel, time) into financial & environmental impact.
 */

export function computeFlightMetrics(originalRoute, alternateRoute, simParams) {
  const { 
    fuelPrice = 1.10, 
    carbonTax = 85, 
    delayCost = 75, 
    holdingTimeMin = 25, 
    holdingFuelRate = 25 // kg per min holding burn
  } = simParams;
  
  // Extract cruise values (fall back to estimates if empty)
  const origCruiseFuel = originalRoute.estimatedFuelKg || Math.round(originalRoute.totalDistanceKm * 3.5);
  const altCruiseFuel = alternateRoute.estimatedFuelKg || Math.round(alternateRoute.totalDistanceKm * 3.5);
  
  const origCruiseTime = originalRoute.estimatedTimeMin || Math.round(originalRoute.totalDistanceKm / 14.1);
  const altCruiseTime = alternateRoute.estimatedTimeMin || Math.round(alternateRoute.totalDistanceKm / 14.1);

  // Original Route runs into storm, incurring a holding pattern delay
  const holdingFuel = holdingTimeMin * holdingFuelRate;
  const origTotalFuel = Math.round(origCruiseFuel + holdingFuel);
  const origTotalTime = Math.round(origCruiseTime + holdingTimeMin);
  
  // Alternate Route bypasses storm (zero holding time)
  const altTotalFuel = Math.round(altCruiseFuel);
  const altTotalTime = Math.round(altCruiseTime);

  // Fuel Costs (fuel price is in $/kg)
  const origFuelCost = origTotalFuel * fuelPrice;
  const altFuelCost = altTotalFuel * fuelPrice;
  
  // Carbon Tax Costs (1 kg Jet A-1 = 3.16 kg CO2)
  const origCO2Tons = (origTotalFuel * 3.16) / 1000;
  const altCO2Tons = (altTotalFuel * 3.16) / 1000;
  
  const origCarbonTax = origCO2Tons * carbonTax;
  const altCarbonTax = altCO2Tons * carbonTax;
  
  // Delay Costs ($/minute delay)
  const origDelayCost = holdingTimeMin * delayCost;
  const altDelayCost = 0; // zero delay minutes since storm was avoided

  // Totals
  const origTotalCost = Math.round(origFuelCost + origCarbonTax + origDelayCost);
  const altTotalCost = Math.round(altFuelCost + altCarbonTax + altDelayCost);
  
  // Savings (positive is good/money saved)
  const netSavings = origTotalCost - altTotalCost;
  const netFuelSaved = origTotalFuel - altTotalFuel;
  const netCO2Saved = origCO2Tons - altCO2Tons;
  const netTimeSaved = origTotalTime - altTotalTime;

  return {
    origTotalFuel,
    origTotalTime,
    origTotalCost,
    origCO2Tons,
    altTotalFuel,
    altTotalTime,
    altTotalCost,
    altCO2Tons,
    netSavings,
    netFuelSaved,
    netCO2Saved,
    netTimeSaved,
  };
}

/**
 * Summarize metrics across a fleet of approved reroutes.
 */
export function summarizeFleetMetrics(approvedReroutes, simParams) {
  let totalSavings = 0;
  let totalFuelSaved = 0;
  let totalCO2Saved = 0;
  let totalTimeSaved = 0;
  let flightsCount = approvedReroutes.length;

  approvedReroutes.forEach(reroute => {
    const m = computeFlightMetrics(reroute.originalRoute, reroute.alternateRoute, simParams);
    totalSavings += m.netSavings;
    totalFuelSaved += m.netFuelSaved;
    totalCO2Saved += m.netCO2Saved;
    totalTimeSaved += m.netTimeSaved;
  });

  return {
    totalSavings,
    totalFuelSaved,
    totalCO2Saved,
    totalTimeSaved,
    flightsCount,
    averageSafetyScore: flightsCount 
      ? Math.round(approvedReroutes.reduce((acc, r) => acc + (r.metrics?.safetyScore || 90), 0) / flightsCount)
      : 95
  };
}
