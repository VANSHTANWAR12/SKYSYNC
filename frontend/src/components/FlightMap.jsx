import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const DELHI = [28.6139, 77.209];
const MUMBAI = [19.076, 72.8777];

function FlightMap({ flights = [], weatherThreats = [], trafficZones = [], weatherLoading = false, weatherError = "" }) {
  const mapContainer = useRef(null);
  const mapInstanceRef = useRef(null);
  const [mapInstance, setMapInstance] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  const markersGroupRef = useRef(null);
  const zonesGroupRef = useRef(null);
  const weatherGroupRef = useRef(null);

  // Initialize Map
  useEffect(() => {
    const containerElement = mapContainer.current;
    if (!containerElement || mapInstanceRef.current) return undefined;

    let map;
    try {
      // Create Leaflet Map instance
      map = L.map(containerElement, {
        center: [22.9, 79.2],
        zoom: 5,
        zoomControl: false, // Add it manually to position it on the top-right
      });

      // Add CartoDB Dark Matter Tiles (matches the original dark aesthetic perfectly)
      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: "abcd",
        maxZoom: 20,
      }).addTo(map);

      // Add zoom control in top-right
      L.control.zoom({ position: "topright" }).addTo(map);

      // Initialize feature groups for dynamic layers
      markersGroupRef.current = L.featureGroup().addTo(map);
      zonesGroupRef.current = L.featureGroup().addTo(map);
      weatherGroupRef.current = L.featureGroup().addTo(map);

      // Draw Route Line from Delhi to Mumbai
      L.polyline([DELHI, MUMBAI], {
        color: "#67d9ff",
        weight: 3.4,
        opacity: 0.92,
      }).addTo(map);

      // Draw Delhi/Mumbai Station Markers
      const createStationIcon = (label, modifier) => {
        return L.divIcon({
          className: `map-marker map-marker--${modifier}`,
          html: `<span class="map-marker__label" style="position: absolute; top: 20px; left: 50%; transform: translateX(-50%); padding: 5px 8px; border-radius: 999px; background: rgba(6, 10, 19, 0.92); color: #f5f9ff; border: 1px solid rgba(148, 163, 184, 0.16); font-size: 11px; white-space: nowrap; letter-spacing: 0.08em;">${label}</span>`,
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        });
      };

      L.marker(DELHI, { icon: createStationIcon("DEL", "delhi") })
        .bindPopup("<strong>Delhi</strong><br/>Dispatch sector uplink active")
        .addTo(map);

      L.marker(MUMBAI, { icon: createStationIcon("BOM", "mumbai") })
        .bindPopup("<strong>Mumbai</strong><br/>Arrival corridor monitored")
        .addTo(map);

      // Fit bounds to the route
      map.fitBounds([DELHI, MUMBAI], {
        padding: [80, 80],
      });

      mapInstanceRef.current = map;
      setMapInstance(map);
    } catch (err) {
      console.error("Leaflet initialization failed:", err);
      setError("Failed to initialize Leaflet Map.");
    }

    return () => {
      if (map) {
        map.remove();
      }
      mapInstanceRef.current = null;
      setMapInstance(null);
    };
  }, []);

  // Update Flight Markers
  useEffect(() => {
    if (!mapInstance || !markersGroupRef.current) return;

    markersGroupRef.current.clearLayers();

    flights.forEach((flight) => {
      if (flight.latitude == null || flight.longitude == null) return;

            const flightIcon = L.divIcon({
        className: "flight-marker-leaflet",
        html: `
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#56c7ff" width="24" height="24" style="transform: rotate(45deg); filter: drop-shadow(0px 0px 6px #56c7ff);">
            <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>
          </svg>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      L.marker([flight.latitude, flight.longitude], { icon: flightIcon })
        .bindPopup(`<strong>${flight.flightNumber}</strong><br/>Airline: ${flight.airline}<br/>Origin: ${flight.origin}<br/>Destination: ${flight.destination}<br/>Altitude: ${flight.altitude}<br/>Speed: ${flight.speed}`)
        .addTo(markersGroupRef.current);
    });

    // Fit bounds to visible flights if they exist
    const coords = flights
      .filter((f) => f.latitude != null && f.longitude != null)
      .map((f) => [f.latitude, f.longitude]);

    if (coords.length > 0) {
      mapInstance.fitBounds(coords, { padding: [50, 50], maxZoom: 6 });
    }
  }, [mapInstance, flights]);

  // Update Traffic Zones
  useEffect(() => {
    if (!mapInstance || !zonesGroupRef.current) return;

    zonesGroupRef.current.clearLayers();

    trafficZones.forEach((zone) => {
      if (zone.latitude == null || zone.longitude == null) return;

      const color =
        zone.congestionLevel === "HIGH"
          ? "#ef4444"
          : zone.congestionLevel === "MEDIUM"
          ? "#fb923c"
          : "#facc15";

      const radius = Math.max(18000, (zone.aircraftCount || 0) * 15000); // Scale radius in meters

      L.circle([zone.latitude, zone.longitude], {
        color: color,
        fillColor: color,
        fillOpacity: 0.18,
        weight: 2,
        opacity: 0.75,
        radius: radius,
      })
        .bindPopup(`<strong>${zone.region || "Traffic Zone"}</strong><br/>Aircraft Count: ${zone.aircraftCount ?? 0}<br/>Congestion: ${zone.congestionLevel || "LOW"}`)
        .addTo(zonesGroupRef.current);
    });
  }, [mapInstance, trafficZones]);

  // Update Weather Threats
  useEffect(() => {
    if (!mapInstance || !weatherGroupRef.current) return;

    weatherGroupRef.current.clearLayers();

    weatherThreats.forEach((threat) => {
      if (threat.latitude == null || threat.longitude == null) return;

      const color =
        threat.riskLevel === "CRITICAL"
          ? "#ef4444"
          : threat.riskLevel === "HIGH"
          ? "#fb923c"
          : "#facc15";

      const radius = Math.max(20000, (threat.precipitation || 0) * 8000);

      L.circle([threat.latitude, threat.longitude], {
        color: color,
        fillColor: color,
        fillOpacity: 0.22,
        weight: 2,
        opacity: 0.65,
        radius: radius,
      })
        .bindPopup(`<strong>${threat.flightNumber || threat.name || "Weather Zone"}</strong><br/>Threat Level: ${threat.riskLevel || "LOW"}<br/>Wind Speed: ${threat.windSpeed ?? "N/A"} km/h<br/>Precipitation: ${threat.precipitation ?? "N/A"} mm`)
        .addTo(weatherGroupRef.current);
    });
  }, [mapInstance, weatherThreats]);

  return (
    <section className="panel map-panel">
      <div className="panel__header">
        <p className="panel__eyebrow">Center Panel</p>
        <h2 className="panel__title">Interactive Route Map (Leaflet)</h2>
      </div>
      <div className="panel__body">
        <div className="map-shell">
          <div className="map-shell__status">
            <p className="map-shell__status-title">India Corridor</p>
            <p className="map-shell__status-copy">
              {weatherLoading ? "Loading live weather intelligence..." : weatherError ? weatherError : "Delhi to Mumbai reroute window is live."}
            </p>
          </div>
          <div className="map-shell__legend">
            <p className="map-shell__legend-title">Live Aircraft Feed</p>
            <p className="map-shell__legend-copy">Route line, live aircraft markers, and congestion overlays are enabled.</p>
          </div>
          
          <div ref={mapContainer} className="map-canvas" style={{ width: "100%", height: "100%", zIndex: 1 }} />

          {loading ? <div className="map-shell__overlay">Initializing Map...</div> : null}
          {error ? <div className="map-shell__overlay map-shell__overlay--error">{error}</div> : null}
        </div>
      </div>
    </section>
  );
}

export default FlightMap;