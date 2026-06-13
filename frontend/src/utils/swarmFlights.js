/**
 * SkySync — Swarm Mode mock fleet data
 * 5 predefined flights covering diverse Indian air corridors.
 * Each entry mirrors the normalized flight object shape from opensky_service.
 */
export const SWARM_FLIGHTS = [
  {
    id: "swarm-AI3088",
    flightNumber: "AI-3088",
    airline: "Air India",
    origin: "DELHI (DEL)",
    destination: "MUMBAI (BOM)",
    status: "active",
    latitude: 23.9,
    longitude: 75.0,
    heading: 200,
    altitude: 36000,
    speed: 850,
  },
  {
    id: "swarm-6E741",
    flightNumber: "6E-741",
    airline: "IndiGo",
    origin: "BENGALURU (BLR)",
    destination: "KOLKATA (CCU)",
    status: "active",
    latitude: 17.8,
    longitude: 82.5,
    heading: 55,
    altitude: 34000,
    speed: 830,
  },
  {
    id: "swarm-SG204",
    flightNumber: "SG-204",
    airline: "SpiceJet",
    origin: "HYDERABAD (HYD)",
    destination: "CHENNAI (MAA)",
    status: "active",
    latitude: 15.2,
    longitude: 79.4,
    heading: 175,
    altitude: 32000,
    speed: 810,
  },
  {
    id: "swarm-UK985",
    flightNumber: "UK-985",
    airline: "Vistara",
    origin: "MUMBAI (BOM)",
    destination: "GUWAHATI (GAU)",
    status: "active",
    latitude: 22.3,
    longitude: 80.1,
    heading: 65,
    altitude: 38000,
    speed: 870,
  },
  {
    id: "swarm-QP114",
    flightNumber: "QP-114",
    airline: "Akasa Air",
    origin: "DELHI (DEL)",
    destination: "KOCHI (COK)",
    status: "active",
    latitude: 21.5,
    longitude: 76.8,
    heading: 195,
    altitude: 35000,
    speed: 840,
  },
];

/** Severity colours per flight index — gives each route a distinct hue */
export const SWARM_ROUTE_COLORS = [
  "#22d3ee", // cyan
  "#a78bfa", // violet
  "#34d399", // emerald
  "#fb923c", // orange
  "#f472b6", // pink
];
