import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import WeatherThreatLayer from "./WeatherThreatLayer";

const DELHI = [77.209, 28.6139];
const MUMBAI = [72.8777, 19.076];
const rawMapToken = (import.meta.env.VITE_MAPBOX_TOKEN || "").trim();
const mapToken = rawMapToken.toLowerCase() === "your_mapbox_token_here" ? "" : rawMapToken;
const browserSupported = typeof window === "undefined" ? true : mapboxgl.supported();
const initialMapError = !mapToken
  ? "Mapbox token missing. Add VITE_MAPBOX_TOKEN to frontend/.env to enable the live map."
  : !browserSupported
    ? "Mapbox GL JS is not supported in this browser."
    : "";


function buildMarker(label, modifier) {
  const marker = document.createElement("div");
  marker.className = `map-marker map-marker--${modifier}`;

  const markerLabel = document.createElement("span");
  markerLabel.className = "map-marker__label";
  markerLabel.textContent = label;
  marker.appendChild(markerLabel);

  return marker;
}

function FlightMap({ flights = [], weatherThreats = [], trafficZones = [], weatherLoading = false, weatherError = "" }) {
  const mapContainer = useRef(null);
  const mapInstanceRef = useRef(null);
  const [mapInstance, setMapInstance] = useState(null);
  const [loading, setLoading] = useState(() => !initialMapError);
  const [error, setError] = useState(() => initialMapError);
  const flightMarkersRef = useRef([]);

  useEffect(() => {
    const containerElement = mapContainer.current;

    if (!containerElement || mapInstanceRef.current) {
      return undefined;
    }

    if (initialMapError) {
      setLoading(false);
      return undefined;
    }

    let map;

    try {
      mapboxgl.accessToken = mapToken;
      containerElement.innerHTML = "";
      map = new mapboxgl.Map({
        container: containerElement,
        style: "mapbox://styles/mapbox/dark-v11",
        center: [79.2, 22.9],
        zoom: 4.3,
        pitch: 24,
        bearing: -8,
        antialias: true,
        cooperativeGestures: true,
      });
    } catch (initializationError) {
      console.error("Mapbox initialization failed:", initializationError);
      window.setTimeout(() => {
        setError(initializationError instanceof Error ? initializationError.message : "Failed to initialize the map.");
        setLoading(false);
      }, 0);
      return undefined;
    }

    mapInstanceRef.current = map;

    map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), "top-right");

    const onLoad = () => {
      map.addSource("route", {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: [DELHI, MUMBAI],
          },
        },
      });

      map.addLayer({
        id: "route-glow",
        type: "line",
        source: "route",
        paint: {
          "line-color": "#56c7ff",
          "line-width": 8,
          "line-opacity": 0.14,
          "line-blur": 3,
        },
      });

      map.addLayer({
        id: "route-line",
        type: "line",
        source: "route",
        layout: {
          "line-cap": "round",
          "line-join": "round",
        },
        paint: {
          "line-color": "#67d9ff",
          "line-width": 3.4,
          "line-opacity": 0.92,
        },
      });

      new mapboxgl.Marker(buildMarker("DEL", "delhi"))
        .setLngLat(DELHI)
        .setPopup(
          new mapboxgl.Popup({ offset: 18, closeButton: false }).setHTML(
            "<strong>Delhi</strong><br/>Dispatch sector uplink active",
          ),
        )
        .addTo(map);

      new mapboxgl.Marker(buildMarker("BOM", "mumbai"))
        .setLngLat(MUMBAI)
        .setPopup(
          new mapboxgl.Popup({ offset: 18, closeButton: false }).setHTML(
            "<strong>Mumbai</strong><br/>Arrival corridor monitored",
          ),
        )
        .addTo(map);

      map.fitBounds([DELHI, MUMBAI], {
        padding: { top: 110, bottom: 90, left: 90, right: 90 },
        duration: 2600,
        essential: true,
      });

      setMapInstance(map);
      setLoading(false);
    };

    const onError = (event) => {
      const mapError = event?.error || new Error("Mapbox reported an unknown runtime error.");
      console.error("Mapbox runtime error:", mapError);
      setError(mapError.message || "Mapbox runtime error.");
      setLoading(false);
    };

    map.on("load", onLoad);
    map.on("error", onError);

    const handleResize = () => map.resize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      map.off("load", onLoad);
      map.off("error", onError);
      map.remove();
      if (containerElement) {
        containerElement.innerHTML = "";
      }
      mapInstanceRef.current = null;
      setMapInstance(null);
    };
  }, []);

  useEffect(() => {
    if (!mapInstance) {
      return undefined;
    }

    flightMarkersRef.current.forEach((marker) => marker.remove());
    flightMarkersRef.current = [];

    flights.forEach((flight) => {
      if (flight.latitude == null || flight.longitude == null) {
        return;
      }

      const markerElement = document.createElement("div");
      markerElement.className = "flight-marker";
      markerElement.title = flight.flightNumber;

      const marker = new mapboxgl.Marker(markerElement)
        .setLngLat([flight.longitude, flight.latitude])
        .setPopup(
          new mapboxgl.Popup({ offset: 18, closeButton: true }).setHTML(
            `<strong>${flight.flightNumber}</strong><br/>Airline: ${flight.airline}<br/>Origin: ${flight.origin}<br/>Destination: ${flight.destination}<br/>Altitude: ${flight.altitude}<br/>Speed: ${flight.speed}`,
          ),
        )
        .addTo(mapInstance);

      flightMarkersRef.current.push(marker);
    });

    const visibleCoordinates = flights
      .filter((flight) => flight.latitude != null && flight.longitude != null)
      .map((flight) => [Number(flight.longitude), Number(flight.latitude)]);

    if (visibleCoordinates.length > 0) {
      const bounds = visibleCoordinates.reduce((boundBox, coordinate) => boundBox.extend(coordinate), new mapboxgl.LngLatBounds(visibleCoordinates[0], visibleCoordinates[0]));
      mapInstance.fitBounds(bounds, {
        padding: { top: 100, bottom: 80, left: 80, right: 80 },
        duration: 1600,
        essential: true,
      });
    }

    return () => {
      flightMarkersRef.current.forEach((marker) => marker.remove());
      flightMarkersRef.current = [];
    };
  }, [mapInstance, flights]);

  useEffect(() => {
    if (!mapInstance) {
      return undefined;
    }

    const sourceId = "traffic-zones";
    const circleLayerId = "traffic-zones-circle";
    const labelLayerId = "traffic-zones-label";
    const handleClick = (event) => {
      const feature = event.features?.[0];
      if (!feature) {
        return;
      }

      const { properties } = feature;
      new mapboxgl.Popup({ offset: 18, closeButton: true })
        .setLngLat(event.lngLat)
        .setHTML(
          `<strong>${properties?.region || "Traffic Zone"}</strong><br/>Aircraft Count: ${properties?.aircraftCount ?? 0}<br/>Congestion: ${properties?.congestionLevel || "LOW"}`,
        )
        .addTo(mapInstance);
    };

    const zoneFeatures = trafficZones.map((zone) => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [zone.longitude, zone.latitude],
      },
      properties: {
        region: zone.region,
        congestionLevel: zone.congestionLevel,
        aircraftCount: zone.aircraftCount,
      },
    }));

    const data = {
      type: "FeatureCollection",
      features: zoneFeatures,
    };

    const cleanup = () => {
      if (!mapInstance.isStyleLoaded()) {
        return;
      }
      if (mapInstance.getLayer(labelLayerId)) {
        mapInstance.removeLayer(labelLayerId);
      }
      if (mapInstance.getLayer(circleLayerId)) {
        mapInstance.removeLayer(circleLayerId);
      }
      if (mapInstance.getSource(sourceId)) {
        mapInstance.removeSource(sourceId);
      }
    };

    mapInstance.off("click", circleLayerId, handleClick);
    cleanup();

    if (zoneFeatures.length === 0 || !mapInstance.isStyleLoaded()) {
      return cleanup;
    }

    mapInstance.addSource(sourceId, { type: "geojson", data });
    mapInstance.addLayer({
      id: circleLayerId,
      type: "circle",
      source: sourceId,
      paint: {
        "circle-color": [
          "match",
          ["get", "congestionLevel"],
          "HIGH",
          "#ef4444",
          "MEDIUM",
          "#fb923c",
          "LOW",
          "#facc15",
          "#facc15",
        ],
        "circle-opacity": 0.18,
        "circle-radius": ["interpolate", ["linear"], ["get", "aircraftCount"], 0, 18, 30, 60],
        "circle-blur": 0.18,
        "circle-stroke-color": "#ffffff",
        "circle-stroke-opacity": 0.75,
        "circle-stroke-width": 2,
      },
    });

    mapInstance.addLayer({
      id: labelLayerId,
      type: "symbol",
      source: sourceId,
      layout: {
        "text-field": ["concat", ["get", "region"], " - ", ["get", "aircraftCount"], " aircraft"],
        "text-size": 12,
        "text-offset": [0, 1.2],
        "text-anchor": "top",
        "text-allow-overlap": true,
      },
      paint: {
        "text-color": "#f5f9ff",
        "text-halo-color": "#06101d",
        "text-halo-width": 1.5,
      },
    });

    mapInstance.on("click", circleLayerId, handleClick);

    return () => {
      mapInstance.off("click", circleLayerId, handleClick);
      if (!mapInstance.isStyleLoaded()) {
        return;
      }
      if (mapInstance.getLayer(labelLayerId)) {
        mapInstance.removeLayer(labelLayerId);
      }
      if (mapInstance.getLayer(circleLayerId)) {
        mapInstance.removeLayer(circleLayerId);
      }
      if (mapInstance.getSource(sourceId)) {
        mapInstance.removeSource(sourceId);
      }
    };
  }, [mapInstance, trafficZones]);

  return (
    <section className="panel map-panel">
      <div className="panel__header">
        <p className="panel__eyebrow">Center Panel</p>
        <h2 className="panel__title">Interactive Route Map</h2>
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
          <div ref={mapContainer} className="map-canvas" style={{ width: "100%", height: "100%" }} />

          {loading ? <div className="map-shell__overlay">Initializing Mapbox...</div> : null}
          {error ? <div className="map-shell__overlay map-shell__overlay--error">{error}</div> : null}

          <WeatherThreatLayer map={mapInstance} threats={weatherThreats} />
        </div>
      </div>
    </section>
  );
}

export default FlightMap;
