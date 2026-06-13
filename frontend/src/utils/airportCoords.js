/**
 * SkySync — Airport coordinate lookup utility
 * Shared between FlightMap.jsx and useReroute.js to avoid duplication.
 */

const DELHI  = [28.6139, 77.209];
const MUMBAI = [19.076,  72.8777];

export const AIRPORT_COORDINATES = {
  // India — Major Hubs
  "DEL": DELHI,   "VIDP": DELHI,
  "BOM": MUMBAI,  "VABB": MUMBAI,
  "BLR": [12.9716, 77.5946],  "VOBL": [12.9716, 77.5946],
  "CCU": [22.5726, 88.3639],  "VECC": [22.5726, 88.3639],
  "MAA": [13.0827, 80.2707],  "VOMM": [13.0827, 80.2707],
  "HYD": [17.3850, 78.4867],  "VOHS": [17.3850, 78.4867],
  "AMD": [23.0225, 72.5714],  "VAAH": [23.0225, 72.5714],
  "COK": [9.9312,  76.2673],  "VOCI": [9.9312,  76.2673],
  "GAU": [26.1445, 91.7362],  "VEGT": [26.1445, 91.7362],
  "SXR": [34.0837, 74.7973],  "VISR": [34.0837, 74.7973],
  "PNQ": [18.5204, 73.8567],  "VAPO": [18.5204, 73.8567],
  "LKO": [26.8467, 80.9462],  "VILK": [26.8467, 80.9462],
  "JAI": [26.9124, 75.7873],  "VIJP": [26.9124, 75.7873],
  "BBI": [20.2961, 85.8245],  "VEBS": [20.2961, 85.8245],
  "PAT": [25.5941, 85.1376],  "VEPT": [25.5941, 85.1376],
  "IDR": [22.7196, 75.8577],  "VAID": [22.7196, 75.8577],
  // Other Domestic
  "NAG": [21.1458, 79.0882],  "VANP": [21.1458, 79.0882],
  "TRZ": [10.7905, 78.7047],  "VOTR": [10.7905, 78.7047],
  "CCJ": [11.2588, 75.7804],  "VOCL": [11.2588, 75.7804],
  "IXM": [9.9252,  78.1198],  "VOMD": [9.9252,  78.1198],
  "GOP": [26.7606, 83.3732],  "VEGK": [26.7606, 83.3732],
  "AGR": [27.1767, 78.0081],  "VIAG": [27.1767, 78.0081],
  "IXU": [19.8762, 75.3433],  "VAPR": [19.8762, 75.3433],
  "RPR": [21.2514, 81.6296],  "VERC": [21.2514, 81.6296],
  "JRG": [21.8554, 84.0327],  "VEJH": [21.8554, 84.0327],
  "VGA": [16.5062, 80.6480],  "VOBZ": [16.5062, 80.6480],
  "TRV": [8.5241,  76.9366],  "VOTV": [8.5241,  76.9366],
  "ATQ": [31.6340, 74.8723],  "VIAR": [31.6340, 74.8723],
  "VNS": [25.3176, 82.9739],  "VIBN": [25.3176, 82.9739],
  "IXB": [26.6806, 88.3247],  "VECA": [26.6806, 88.3247], "VEBD": [26.6806, 88.3247],
  "IXE": [12.9141, 74.8560],  "VORY": [12.9141, 74.8560],
  // International
  "DXB": [25.2532, 55.3657],  "OMDB": [25.2532, 55.3657],
  "DOH": [25.2731, 51.5585],  "OTBD": [25.2731, 51.5585],
  "AUH": [24.4248, 54.6511],  "OMAA": [24.4248, 54.6511],
  "MCT": [23.5933, 58.2812],  "OOMS": [23.5933, 58.2812],
  "JED": [21.6796, 39.1565],  "OEJN": [21.6796, 39.1565],
  "RUH": [24.9576, 46.6988],  "OERK": [24.9576, 46.6988],
  "BAH": [26.2708, 50.6336],  "OBBI": [26.2708, 50.6336],
  "KWI": [29.2266, 47.9689],  "OKBK": [29.2266, 47.9689],
  "HKG": [22.3080, 113.9185], "VHHH": [22.3080, 113.9185],
  "SIN": [1.3644,  103.9915], "WSSS": [1.3644,  103.9915],
  "KUL": [2.7456,  101.7099], "WMKK": [2.7456,  101.7099],
  "BKK": [13.6900, 100.7501], "VTBS": [13.6900, 100.7501],
  "HND": [35.5494, 139.7798], "RJTT": [35.5494, 139.7798],
  "ICN": [37.4602, 126.4407], "RKSI": [37.4602, 126.4407],
  "PEK": [40.0799, 116.5946], "ZBAA": [40.0799, 116.5946],
  "PVG": [31.1443, 121.8083], "ZSSS": [31.1443, 121.8083],
  "MNL": [14.5086, 121.0194], "RPLL": [14.5086, 121.0194],
  "LHR": [51.4700, -0.4543],  "EGLL": [51.4700, -0.4543],
  "CDG": [49.0097,  2.5479],  "LFPG": [49.0097,  2.5479],
  "FRA": [50.0379,  8.5622],  "EDDF": [50.0379,  8.5622],
  "AMS": [52.3105,  4.7683],  "EHAM": [52.3105,  4.7683],
  "FCO": [41.8003, 12.2389],  "LIRF": [41.8003, 12.2389],
  "MAD": [40.4719, -3.5640],  "LEMD": [40.4719, -3.5640],
  "JFK": [40.6413, -73.7781], "KJFK": [40.6413, -73.7781],
  "LAX": [33.9416, -118.4085],"KLAX": [33.9416, -118.4085],
  "ORD": [41.9742, -87.9073], "KORD": [41.9742, -87.9073],
  "IAH": [29.9805, -95.3397], "KIAH": [29.9805, -95.3397],
  "YYZ": [43.6777, -79.6248], "CYYZ": [43.6777, -79.6248],
  "SYD": [-33.9461, 151.1772],"YSSY": [-33.9461, 151.1772],
  "MEL": [-37.6690, 144.8410],"YMML": [-37.6690, 144.8410],
};

/**
 * Resolve an airport display string like "KOCHI (COK)" or "VOMM" to [lat, lng].
 * @param {string|null|undefined} airportStr
 * @returns {[number,number]|null}
 */
export function resolveAirportCoords(airportStr) {
  if (!airportStr) return null;
  const upper = airportStr.toUpperCase();

  // Extract IATA/ICAO code from parentheses e.g. "KOCHI (COK)"
  const parenMatch = upper.match(/\(([^)]+)\)/);
  if (parenMatch?.[1]) {
    const code = parenMatch[1].trim();
    if (AIRPORT_COORDINATES[code]) return AIRPORT_COORDINATES[code];
  }

  // Direct key lookup
  if (AIRPORT_COORDINATES[upper.trim()]) return AIRPORT_COORDINATES[upper.trim()];

  // Substring scan as last resort
  for (const [key, coords] of Object.entries(AIRPORT_COORDINATES)) {
    if (upper.includes(key)) return coords;
  }

  return null;
}
