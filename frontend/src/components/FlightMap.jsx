/**
 * SkySync — FlightMap
 * Leaflet-based live airspace map with:
 *  - Live aircraft markers (plane SVG icons, heading-rotated)
 *  - Faint background route lines for all flights
 *  - Reroute visualization: original (dashed blue) + alternate (solid cyan + glow)
 *  - Threat zone circles (pulsing red/orange)
 *  - Inject Storm button (disabled when no flight is selected)
 *  - Fullscreen toggle
 *  - Floating RerouteCard overlay
 */
import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { resolveAirportCoords } from "../utils/airportCoords";
import RerouteCard from "./RerouteCard";

const DELHI  = [28.6139, 77.209];
const MUMBAI = [19.076, 72.8777];

// ── Helpers ─────────────────────────────────────────────────────────────────

function getAirportCoordinates(airportStr) {
  return resolveAirportCoords(airportStr);
}

/** Convert threat severity label → colour */
function threatColor(severity) {
  return severity === "high" ? "#ef4444" : severity === "medium" ? "#fb923c" : "#facc15";
}

// ── Component ────────────────────────────────────────────────────────────────

function FlightMap({
  flights = [],
  selectedFlightId,
  onSelectFlight,
  weatherThreats = [],
  trafficZones = [],
  weatherLoading = false,
  weatherError = "",
  // Reroute props
  rerouteData = null,
  rerouteStatus = "idle",
  agentLog = [],
  showOriginal = true,
  onToggleOriginal,
  onInjectStorm,
  onApproveReroute,
  onRejectReroute,
}) {
  // ── Refs ──────────────────────────────────────────────────────────────────
  const mapContainer    = useRef(null);
  const mapShellRef     = useRef(null);
  const mapInstanceRef  = useRef(null);
  const [mapInstance, setMapInstance] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const flightMarkersRef  = useRef({});
  const zoneLayersRef     = useRef([]);
  const weatherLayersRef  = useRef([]);
  const routeLayersRef    = useRef([]);
  const rerouteLayersRef  = useRef([]);   // [originalPolyline, alternatePolyline, ...threatCircles]
  const hasFittedBoundsRef = useRef(false);
  const altAnimFrameRef   = useRef(null); // requestAnimationFrame handle for alternate route animation

  // ── Fullscreen ────────────────────────────────────────────────────────────
  const toggleFullscreen = () => {
    if (!mapShellRef.current) return;
    const fsDoc = document;
    const fsElem = fsDoc.fullscreenElement || fsDoc.webkitFullscreenElement || fsDoc.mozFullScreenElement || fsDoc.msFullscreenElement;
    
    if (!fsElem) {
      const el = mapShellRef.current;
      if (el.requestFullscreen) {
        el.requestFullscreen().catch(err => console.error("Fullscreen error:", err));
      } else if (el.webkitRequestFullscreen) {
        el.webkitRequestFullscreen();
      } else if (el.mozRequestFullScreen) {
        el.mozRequestFullScreen();
      } else if (el.msRequestFullscreen) {
        el.msRequestFullscreen();
      }
    } else {
      if (fsDoc.exitFullscreen) {
        fsDoc.exitFullscreen();
      } else if (fsDoc.webkitExitFullscreen) {
        fsDoc.webkitExitFullscreen();
      } else if (fsDoc.mozCancelFullScreen) {
        fsDoc.mozCancelFullScreen();
      } else if (fsDoc.msExitFullscreen) {
        fsDoc.msExitFullscreen();
      }
    }
  };

  useEffect(() => {
    const handler = () => {
      const fsDoc = document;
      const fsElem = fsDoc.fullscreenElement || fsDoc.webkitFullscreenElement || fsDoc.mozFullscreenElement || fsDoc.msFullscreenElement;
      setIsFullscreen(!!fsElem);
      if (mapInstanceRef.current) {
        setTimeout(() => mapInstanceRef.current.invalidateSize(), 200);
      }
    };
    document.addEventListener("fullscreenchange", handler);
    document.addEventListener("webkitfullscreenchange", handler);
    document.addEventListener("mozfullscreenchange", handler);
    document.addEventListener("MSFullscreenChange", handler);
    return () => {
      document.removeEventListener("fullscreenchange", handler);
      document.removeEventListener("webkitfullscreenchange", handler);
      document.removeEventListener("mozfullscreenchange", handler);
      document.removeEventListener("MSFullscreenChange", handler);
    };
  }, []);

  // ── Map Initialisation ────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapContainer.current || mapInstanceRef.current) return;

    const map = L.map(mapContainer.current, {
      center: [22.9, 79.2],
      zoom: 5,
      zoomControl: false,
      attributionControl: false,
    });

    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      maxZoom: 19,
    }).addTo(map);

    L.control.zoom({ position: "topright" }).addTo(map);

    mapInstanceRef.current = map;
    setMapInstance(map);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // ── Flight Markers & Background Routes ───────────────────────────────────
  useEffect(() => {
    if (!mapInstance) return;

    // Clear old background route lines
    routeLayersRef.current.forEach(l => l.remove());
    routeLayersRef.current = [];

    // Prune stale markers
    const currentIds = new Set(flights.map(f => f.id || f.flightNumber));
    Object.keys(flightMarkersRef.current).forEach(fId => {
      if (!currentIds.has(fId)) {
        flightMarkersRef.current[fId].remove();
        delete flightMarkersRef.current[fId];
      }
    });

    flights.forEach(flight => {
      const { latitude, longitude, flightNumber, id } = flight;
      if (latitude == null || longitude == null) return;

      const fId = id || flightNumber;
      const pos = [latitude, longitude];
      const isSelected   = fId === selectedFlightId;
      const isAnySelected = !!selectedFlightId;

      const markerClass = `flight-marker ${
        isSelected ? "flight-marker--selected" : isAnySelected ? "flight-marker--faded" : ""
      }`;

      const heading = flight.heading || 0;
      const planeSvg = `<svg viewBox="0 0 24 24" fill="currentColor" width="100%" height="100%"
        style="transform:rotate(${heading}deg);transition:transform 0.3s ease">
        <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>
      </svg>`;

      if (flightMarkersRef.current[fId]) {
        flightMarkersRef.current[fId].setLatLng(pos);
        flightMarkersRef.current[fId].setIcon(L.divIcon({
          className: markerClass,
          html: planeSvg,
          iconSize: isSelected ? [24, 24] : [16, 16],
        }));
        flightMarkersRef.current[fId].setZIndexOffset(isSelected ? 2000 : isAnySelected ? 100 : 1000);
      } else {
        const marker = L.marker(pos, {
          icon: L.divIcon({ className: markerClass, html: planeSvg, iconSize: isSelected ? [24, 24] : [16, 16] }),
        })
          .addTo(mapInstance)
          .on("click", () => onSelectFlight(fId));
        flightMarkersRef.current[fId] = marker;
      }

      // Background route line (only for selected or when nothing selected)
      // Skip background route for selected flight when reroute is active — reroute layers take over
      const hasActiveReroute = rerouteData && (rerouteStatus === "active" || rerouteStatus === "approved");
      if ((!isAnySelected || isSelected) && !(isSelected && hasActiveReroute)) {
        const dest = getAirportCoordinates(flight.destination) || (flight.destination?.includes("MUMBAI") ? MUMBAI : DELHI);
        const mid  = [
          (pos[0] + dest[0]) / 2 + (pos[1] - dest[1]) * 0.1,
          (pos[1] + dest[1]) / 2 + (dest[0] - pos[0]) * 0.1,
        ];
        const polyline = L.polyline([pos, mid, dest], {
          color: isSelected
            ? "rgba(86,199,255,0.5)"
            : flight.airline === "IndiGo"
              ? "rgba(79,70,229,0.15)"
              : flight.airline === "Air India"
                ? "rgba(220,38,38,0.15)"
                : "rgba(86,199,255,0.08)",
          weight:      isSelected ? 3 : 1,
          dashArray:   isSelected ? "none" : "5,10",
          smoothFactor: 2,
          interactive: false,
        }).addTo(mapInstance);
        routeLayersRef.current.push(polyline);
      }
    });

    // Fit bounds on first load
    if (Object.keys(flightMarkersRef.current).length > 0 && !hasFittedBoundsRef.current) {
      const group = new L.featureGroup(Object.values(flightMarkersRef.current));
      mapInstance.fitBounds(group.getBounds().pad(0.3));
      hasFittedBoundsRef.current = true;
    }
  }, [mapInstance, flights, selectedFlightId, onSelectFlight, rerouteData, rerouteStatus]);

  // ── Reroute Route Layers ──────────────────────────────────────────────────
  useEffect(() => {
    if (!mapInstance) return;

    // Cancel any in-progress animation
    if (altAnimFrameRef.current) {
      cancelAnimationFrame(altAnimFrameRef.current);
      altAnimFrameRef.current = null;
    }

    // Remove previous reroute layers
    rerouteLayersRef.current.forEach(l => l.remove());
    rerouteLayersRef.current = [];

    const isVisible = rerouteData && (rerouteStatus === "active" || rerouteStatus === "approved");
    if (!isVisible) return;

    const { originalRoute, alternateRoute, threatZones: zones = [] } = rerouteData;

    // ── 1. Original Route — dashed lighter blue ──────────────────────────
    if (showOriginal && originalRoute?.points?.length) {
      const origLatLngs = originalRoute.points.map(p => [p.lat, p.lng]);
      const origLine = L.polyline(origLatLngs, {
        color:       "#60a5fa",
        weight:      4,
        opacity:     0.7,
        dashArray:   "10, 8",
        smoothFactor: 1,
        interactive: false,
      }).addTo(mapInstance);

      // Origin marker
      const origPt = origLatLngs[0];
      const origEndPt = origLatLngs[origLatLngs.length - 1];
      const airportIcon = (label, clr) => L.divIcon({
        className: "",
        html: `<div style="background:${clr};color:#000;font-size:10px;font-weight:700;padding:3px 7px;border-radius:20px;white-space:nowrap;border:1.5px solid rgba(255,255,255,0.3)">${label}</div>`,
        iconAnchor: [30, 10],
      });
      const originMarker = L.marker(origPt, { icon: airportIcon("ORIGIN", "#60a5fa"), interactive: false, zIndexOffset: 500 }).addTo(mapInstance);
      const destMarker   = L.marker(origEndPt, { icon: airportIcon("DEST", "#60a5fa"), interactive: false, zIndexOffset: 500 }).addTo(mapInstance);

      rerouteLayersRef.current.push(origLine, originMarker, destMarker);
    }

    // ── 2. Alternate Route — animated solid cyan glow ─────────────────────
    if (alternateRoute?.points?.length) {
      const altLatLngs = alternateRoute.points.map(p => [p.lat, p.lng]);

      // Glow base layer (wider, lower opacity)
      const glowLine = L.polyline([], {
        color:       "#22d3ee",
        weight:      14,
        opacity:     0.18,
        smoothFactor: 1,
        interactive: false,
      }).addTo(mapInstance);

      // Main bright line
      const altLine = L.polyline([], {
        color:       "#22d3ee",
        weight:      6,
        opacity:     1.0,
        smoothFactor: 1,
        interactive: false,
      }).addTo(mapInstance);

      rerouteLayersRef.current.push(glowLine, altLine);

      // Progressive draw animation
      let step = 0;
      const totalSteps = altLatLngs.length;
      const speed = 2; // points per frame

      function drawStep() {
        step = Math.min(step + speed, totalSteps);
        const visible = altLatLngs.slice(0, step);
        altLine.setLatLngs(visible);
        glowLine.setLatLngs(visible);
        if (step < totalSteps) {
          altAnimFrameRef.current = requestAnimationFrame(drawStep);
        } else {
          altAnimFrameRef.current = null;
        }
      }
      // Small delay so user sees the original route first
      setTimeout(() => { altAnimFrameRef.current = requestAnimationFrame(drawStep); }, 400);
    }

    // ── 3. Threat Zones ───────────────────────────────────────────────────
    zones.forEach(zone => {
      const [lat, lng] = zone.center;
      const radiusM = zone.radiusKm * 1000;
      const color   = threatColor(zone.severity);

      // Outer pulsing ring (divIcon)
      const pulseIcon = L.divIcon({
        className: "threat-pulse-icon",
        html: `<div class="threat-pulse-ring" style="--tc:${color}"></div>`,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });
      const pulseMarker = L.marker([lat, lng], { icon: pulseIcon, interactive: false, zIndexOffset: 600 }).addTo(mapInstance);

      // Main threat fill circle
      const threatCircle = L.circle([lat, lng], {
        color,
        fillColor: color,
        fillOpacity: 0.18,
        radius: radiusM,
        weight: 2,
        dashArray: "6, 6",
      })
        .addTo(mapInstance)
        .bindPopup(
          `<strong style="color:${color}">⚡ ${zone.label || "Storm Cell"}</strong>` +
          `<br/>Wind: ${zone.windSpeed ?? "N/A"} km/h` +
          `<br/>Rain: ${zone.precipitation ?? "N/A"} mm/hr` +
          `<br/>Severity: ${zone.severity?.toUpperCase()}`
        );

      rerouteLayersRef.current.push(threatCircle, pulseMarker);
    });

    // Pan map to show the reroute
    if (alternateRoute?.points?.length) {
      const bounds = L.latLngBounds(alternateRoute.points.map(p => [p.lat, p.lng]));
      mapInstance.fitBounds(bounds.pad(0.25), { animate: true, duration: 1 });
    }
  }, [mapInstance, rerouteData, rerouteStatus, showOriginal]);

  // ── Traffic Zones ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapInstance) return;
    zoneLayersRef.current.forEach(l => l.remove());
    zoneLayersRef.current = [];

    trafficZones.forEach(zone => {
      const color  = zone.congestionLevel === "HIGH" ? "#ef4444" : zone.congestionLevel === "MEDIUM" ? "#fb923c" : "#facc15";
      const radius = Math.max(20000, (zone.aircraftCount || 0) * 5000);
      const circle = L.circle([zone.latitude, zone.longitude], {
        color, fillColor: color, fillOpacity: 0.15, radius, weight: 1,
      })
        .addTo(mapInstance)
        .bindPopup(`<strong>${zone.region}</strong><br/>Aircraft: ${zone.aircraftCount}<br/>Status: ${zone.congestionLevel}`);
      zoneLayersRef.current.push(circle);
    });
  }, [mapInstance, trafficZones]);

  // ── Weather Threats ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapInstance) return;
    weatherLayersRef.current.forEach(l => l.remove());
    weatherLayersRef.current = [];

    weatherThreats.forEach(threat => {
      const color  = threat.riskLevel === "CRITICAL" ? "#ef4444" : threat.riskLevel === "HIGH" ? "#fb923c" : "#facc15";
      const radius = Math.max(15000, (threat.precipitation || 0) * 8000 + (threat.windSpeed || 0) * 1000);
      const circle = L.circle([threat.latitude, threat.longitude], {
        color, fillColor: color, fillOpacity: 0.25, radius, weight: 1.5, dashArray: "5,5",
      })
        .addTo(mapInstance)
        .bindPopup(
          `<strong>${threat.weatherThreat}</strong><br/>Risk: ${threat.riskLevel}` +
          `<br/>Wind: ${threat.windSpeed} km/h<br/>Rain: ${threat.precipitation} mm`
        );
      weatherLayersRef.current.push(circle);
    });
  }, [mapInstance, weatherThreats]);

  // ── Derived state ─────────────────────────────────────────────────────────
  const hasSelectedFlight = !!selectedFlightId;
  const isStormLoading = rerouteStatus === "loading";
  const stormBtnTitle = hasSelectedFlight
    ? "Simulate a storm and compute an alternate route"
    : "Select a flight from the fleet list first";

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <section className="panel map-panel">
      {/* Panel Header */}
      <div className="panel__header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px" }}>
        <div>
          <p className="panel__eyebrow">Center Panel</p>
          <h2 className="panel__title">Live Airspace Monitor</h2>
        </div>

        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          {/* Inject Storm Button */}
          <div style={{ position: "relative" }} className="inject-storm-wrap">
            <button
              id="inject-storm-btn"
              className={`inject-storm-btn ${!hasSelectedFlight ? "inject-storm-btn--disabled" : ""} ${isStormLoading ? "inject-storm-btn--loading" : ""}`}
              onClick={() => hasSelectedFlight && !isStormLoading && onInjectStorm && onInjectStorm()}
              disabled={!hasSelectedFlight || isStormLoading}
              title={stormBtnTitle}
            >
              {isStormLoading ? (
                <>
                  <span className="inject-storm-btn__spinner" />
                  Simulating…
                </>
              ) : (
                <>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: "5px" }}>
                    <path d="M7 2v11h3v9l7-12h-4l4-8z"/>
                  </svg>
                  Inject Storm
                </>
              )}
            </button>
            {!hasSelectedFlight && (
              <div className="inject-storm-tooltip">Select a flight first</div>
            )}
          </div>

          {/* Fullscreen Button */}
          <button className="fullscreen-btn" onClick={toggleFullscreen} title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}>
            {isFullscreen ? (
              <>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: "5px" }}>
                  <path d="M4 14h6v6M20 10h-6V4M14 10l7-7M10 14l-7 7"/>
                </svg>
                Minimize
              </>
            ) : (
              <>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: "5px" }}>
                  <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>
                </svg>
                Fullscreen
              </>
            )}
          </button>
        </div>
      </div>

      {/* Map Body */}
      <div className="panel__body">
        <div ref={mapShellRef} className="map-shell">
          {/* Status badge */}
          <div className="map-shell__status">
            <p className="map-shell__status-title">OpenStreetMap Engine</p>
            <p className="map-shell__status-copy">
              {isStormLoading
                ? "Computing alternate route…"
                : weatherLoading
                  ? "Syncing weather intelligence…"
                  : "Active Airspace Tracking"}
            </p>
          </div>

          {/* Leaflet canvas */}
          <div
            ref={mapContainer}
            className="map-canvas"
            style={{ width: "100%", height: "100%", background: "#06101d" }}
          />

          {/* Error overlay */}
          {weatherError && (
            <div className="map-shell__overlay map-shell__overlay--error">{weatherError}</div>
          )}

          {/* ── Floating RerouteCard ── */}
          <RerouteCard
            rerouteData={rerouteData}
            rerouteStatus={rerouteStatus}
            agentLog={agentLog}
            showOriginal={showOriginal}
            onToggleOriginal={onToggleOriginal}
            onApprove={onApproveReroute}
            onReject={onRejectReroute}
          />
        </div>
      </div>
    </section>
  );
}

export default FlightMap;
