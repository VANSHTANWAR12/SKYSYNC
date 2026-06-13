/**
 * SkySync — FlightMap
 * Leaflet-based live airspace map with:
 *  - Live aircraft markers (plane SVG icons, heading-rotated)
 *  - Faint background route lines for all flights
 *  - Custom marker clustering for aircraft icons when zoomed out (zoom <= 6)
 *  - Dynamic route highlighting (thicker + glowing) and dimming on hover/click
 *  - Stronger route glow and pulsing animations for alternate routes
 *  - Map legend in the bottom-left explaining colors
 *  - Threat zone circles (pulsing red/orange)
 *  - Fullscreen toggle
 *  - Floating RerouteCard overlay
 */
import { useEffect, useRef, useState, useCallback } from "react";
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

function threatColor(severity) {
  return severity === "high" ? "#ec4899" : severity === "medium" ? "#a855f7" : "#c084fc";
}

/** Distance-based marker clustering algorithm */
function getClusters(flightsList, zoomLevel, activeHighlightId) {
  if (zoomLevel > 6) {
    return flightsList.map(f => ({ isCluster: false, flight: f }));
  }

  // Keep highlighted/selected flights separate so they never hide inside a cluster
  const individual = [];
  const toCluster = [];

  flightsList.forEach(f => {
    const fId = f.id || f.flightNumber;
    if (fId === activeHighlightId) {
      individual.push({ isCluster: false, flight: f });
    } else {
      toCluster.push(f);
    }
  });

  // Calculate degree threshold based on zoom level
  const threshold = 120 / Math.pow(2, zoomLevel);
  const clusters = [];

  toCluster.forEach(flight => {
    if (flight.latitude == null || flight.longitude == null) return;
    
    let found = false;
    for (let c of clusters) {
      const dist = Math.sqrt(
        Math.pow(c.lat - flight.latitude, 2) + 
        Math.pow(c.lng - flight.longitude, 2)
      );
      if (dist < threshold) {
        c.flights.push(flight);
        c.lat = c.flights.reduce((sum, fl) => sum + fl.latitude, 0) / c.flights.length;
        c.lng = c.flights.reduce((sum, fl) => sum + fl.longitude, 0) / c.flights.length;
        found = true;
        break;
      }
    }

    if (!found) {
      clusters.push({
        isCluster: true,
        lat: flight.latitude,
        lng: flight.longitude,
        flights: [flight]
      });
    }
  });

  const processedClusters = clusters.map(c => {
    if (c.flights.length === 1) {
      return { isCluster: false, flight: c.flights[0] };
    }
    return c;
  });

  return [...individual, ...processedClusters];
}

// ── Component ────────────────────────────────────────────────────────────────

const SWARM_COLORS = ["#22d3ee", "#a78bfa", "#34d399", "#fb923c", "#f472b6"];

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
  selectedFlight = null,
  // Swarm props
  swarmMode = false,
  swarmRerouteDataList = [],
  isStormLoading = false,
  hoveredFlightId = null,
  onHoverFlight = null,
  focusMode = false,
  swarmSelectedFlightIds = [],
  customStormCell = null,
  onCustomStormPlaced = null,
  onClearStorm = null,
}) {
  // ── Refs ──────────────────────────────────────────────────────────────────
  const mapContainer    = useRef(null);
  const mapShellRef     = useRef(null);
  const mapInstanceRef  = useRef(null);
  const [mapInstance, setMapInstance] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [zoom, setZoom] = useState(5);

  const flightMarkersRef  = useRef({});
  const zoneLayersRef     = useRef([]);
  const weatherLayersRef  = useRef([]);
  const routeLayersRef    = useRef([]);
  const rerouteLayersRef  = useRef([]);
  const swarmLayersRef    = useRef([]);
  const hasFittedBoundsRef = useRef(false);
  const hasFittedSwarmBoundsRef = useRef(false);
  const altAnimFrameRef   = useRef(null);
  const [drawStormMode, setDrawStormMode] = useState(false);
  const customStormLayerRef = useRef(null);

  // ── derived state ─────────────────────────────────────────────────────────
  const activeHighlightId = hoveredFlightId || selectedFlightId;

  // ── Sync zoom changes ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapInstance) return;
    const onZoom = () => setZoom(mapInstance.getZoom());
    mapInstance.on("zoomend", onZoom);
    return () => {
      mapInstance.off("zoomend", onZoom);
    };
  }, [mapInstance]);

  // ── Draw Storm Click Listener ─────────────────────────────────────────────
  useEffect(() => {
    if (!mapInstance || !onCustomStormPlaced) return;

    const onMapClick = (e) => {
      if (!drawStormMode) return;
      const { lat, lng } = e.latlng;
      onCustomStormPlaced(lat, lng);
      setDrawStormMode(false); // turn off draw mode after placement
    };

    mapInstance.on("click", onMapClick);
    return () => {
      mapInstance.off("click", onMapClick);
    };
  }, [mapInstance, drawStormMode, onCustomStormPlaced]);

  // ── Render Custom Storm Cell ──────────────────────────────────────────────
  useEffect(() => {
    if (!mapInstance) return;

    // Clear old custom storm layer
    if (customStormLayerRef.current) {
      customStormLayerRef.current.remove();
      customStormLayerRef.current = null;
    }

    if (!customStormCell) return;

    const [lat, lng] = customStormCell;
    
    // Auto-center map on the custom storm coordinates
    mapInstance.setView([lat, lng], 5, { animate: true, duration: 1.0 });

    const color = "#ec4899";
    const radiusM = 150000; // default 150km radius

    const group = L.layerGroup();

    const pulseIcon = L.divIcon({
      className: "threat-pulse-icon",
      html: `<div class="threat-pulse-ring" style="--tc:${color}"></div>`,
      iconSize: [0, 0],
      iconAnchor: [0, 0],
    });
    const pulseMarker = L.marker([lat, lng], { icon: pulseIcon, interactive: false });
    pulseMarker.addTo(group);

    const threatCircle = L.circle([lat, lng], {
      className: "threat-circle-dramatic",
      color,
      fillColor: color,
      fillOpacity: 0.25,
      radius: radiusM,
      weight: 3,
      dashArray: "6, 6",
    }).addTo(group);
    
    threatCircle.bindPopup(`<strong style="color:#ef4444">🌩 Custom Convective Cell</strong><br/>Position: ${lat.toFixed(3)}°N, ${lng.toFixed(3)}°E<br/>Status: ACTIVE INTENSITY`);

    group.addTo(mapInstance);
    customStormLayerRef.current = group;
  }, [mapInstance, customStormCell]);

  // Reset swarm bounds ref when swarmMode disables or resets
  useEffect(() => {
    if (!swarmMode || !swarmRerouteDataList.length) {
      hasFittedSwarmBoundsRef.current = false;
    }
  }, [swarmMode, swarmRerouteDataList]);

  // Centering on selected flight in any mode
  useEffect(() => {
    if (!mapInstance || !selectedFlightId) return;
    const selected = flights.find(f => (f.id || f.flightNumber) === selectedFlightId);
    if (selected && selected.latitude != null && selected.longitude != null) {
      mapInstance.setView([selected.latitude, selected.longitude], Math.max(mapInstance.getZoom(), 7), { animate: true, duration: 0.8 });
    }
  }, [mapInstance, selectedFlightId, flights]);

  // ── Fullscreen ────────────────────────────────────────────────────────────
  const toggleFullscreen = () => {
    if (!mapShellRef.current) return;
    if (!document.fullscreenElement) {
      mapShellRef.current.requestFullscreen().catch(err => {
        console.error("Fullscreen error:", err);
      });
    } else {
      document.exitFullscreen();
    }
  };

  useEffect(() => {
    const handler = () => {
      setIsFullscreen(!!document.fullscreenElement);
      if (mapInstanceRef.current) {
        setTimeout(() => mapInstanceRef.current.invalidateSize(), 100);
      }
    };
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
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

    // Clear all previous markers to support dynamic clustering changes
    Object.keys(flightMarkersRef.current).forEach(key => {
      flightMarkersRef.current[key].remove();
    });
    flightMarkersRef.current = {};

    const filteredFlights = (focusMode && activeHighlightId)
      ? flights.filter(f => (f.id || f.flightNumber) === activeHighlightId)
      : flights;

    const displayItems = getClusters(filteredFlights, zoom, activeHighlightId);

    displayItems.forEach((item, idx) => {
      if (item.isCluster) {
        // Draw cluster marker
        const count = item.flights.length;
        const clusterHtml = `
          <div class="flight-cluster-marker">
            <span class="flight-cluster-badge">${count}</span>
            <div class="flight-cluster-ring"></div>
          </div>
        `;
        const marker = L.marker([item.lat, item.lng], {
          icon: L.divIcon({
            className: "flight-cluster-wrap",
            html: clusterHtml,
            iconSize: [36, 36],
            iconAnchor: [18, 18],
          })
        })
          .addTo(mapInstance)
          .on("click", () => {
            const bounds = L.latLngBounds(item.flights.map(f => [f.latitude, f.longitude]));
            mapInstance.fitBounds(bounds.pad(0.5), { animate: true, duration: 0.8 });
          });
        flightMarkersRef.current[`cluster_${idx}`] = marker;
      } else {
        // Draw single flight marker
        const { flight } = item;
        const { latitude, longitude, flightNumber, id } = flight;
        if (latitude == null || longitude == null) return;

        const fId = id || flightNumber;
        const pos = [latitude, longitude];
        const isSelected = fId === activeHighlightId;
        const isAnySelected = !!activeHighlightId;
        const isInSwarm = swarmMode && swarmSelectedFlightIds.includes(fId);

        const markerClass = `flight-marker ${
          isSelected ? "flight-marker--selected" : isAnySelected ? "flight-marker--faded" : ""
        } ${isInSwarm ? "flight-marker--in-swarm" : ""}`;

        const heading = flight.heading || 0;
        const planeSvg = `<svg viewBox="0 0 24 24" fill="currentColor" width="100%" height="100%"
          style="transform:rotate(${heading}deg);transition:transform 0.3s ease">
          <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>
        </svg>`;

        const marker = L.marker(pos, {
          icon: L.divIcon({ className: markerClass, html: planeSvg, iconSize: isSelected ? [24, 24] : [16, 16] }),
        })
          .addTo(mapInstance)
          .on("click", () => onSelectFlight(fId))
          .on("mouseover", () => onHoverFlight && onHoverFlight(fId))
          .on("mouseout", () => onHoverFlight && onHoverFlight(null));

        flightMarkersRef.current[fId] = marker;

        // Background route line
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
      }
    });

    // Fit bounds on first load
    if (Object.keys(flightMarkersRef.current).length > 0 && !hasFittedBoundsRef.current) {
      const group = new L.featureGroup(Object.values(flightMarkersRef.current).filter(m => m.getLatLng));
      if (group.getBounds().isValid()) {
        mapInstance.fitBounds(group.getBounds().pad(0.3));
        hasFittedBoundsRef.current = true;
      }
    }
  }, [mapInstance, flights, activeHighlightId, onSelectFlight, rerouteData, rerouteStatus, zoom, focusMode, swarmMode, swarmSelectedFlightIds]);

  // ── Reroute Route Layers ──────────────────────────────────────────────────
  useEffect(() => {
    if (!mapInstance) return;

    if (altAnimFrameRef.current) {
      cancelAnimationFrame(altAnimFrameRef.current);
      altAnimFrameRef.current = null;
    }

    rerouteLayersRef.current.forEach(l => l.remove());
    rerouteLayersRef.current = [];

    const isVisible = rerouteData && (rerouteStatus === "active" || rerouteStatus === "approved");
    if (!isVisible) return;

    const { originalRoute, alternateRoute, threatZones: zones = [] } = rerouteData;

    // ── 1. Original Route ──────────────────────────────────────────────
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

    // ── 2. Alternate Route ─────────────────────────────────────────────
    if (alternateRoute?.points?.length) {
      const altLatLngs = alternateRoute.points.map(p => [p.lat, p.lng]);

      const glowLine = L.polyline([], {
        className: "route-glow-line route-glow-line--pulsing route-glow-line--highlighted",
        color:       "#22d3ee",
        weight:      26,
        opacity:     0.4,
        smoothFactor: 1,
        interactive: false,
      }).addTo(mapInstance);

      const altLine = L.polyline([], {
        className: "route-alt-line route-alt-line--highlighted",
        color:       "#22d3ee",
        weight:      8,
        opacity:     1.0,
        smoothFactor: 1,
        interactive: false,
      }).addTo(mapInstance);

      rerouteLayersRef.current.push(glowLine, altLine);

      let step = 0;
      const totalSteps = altLatLngs.length;
      const speed = 2;

      function drawStep() {
        step = Math.min(step + speed, totalSteps);
        const visible = altLatLngs.slice(0, step);
        altLine.setLatLngs(visible);
        glowLine.setLatLngs(visible);
        if (step < totalSteps) {
          altAnimFrameRef.current = requestAnimationFrame(drawStep);
        } else {
          altAnimFrameRef.current = null;
          for (let i = 1; i < altLatLngs.length - 1; i += 3) {
            const pt = altLatLngs[i];
            const nextPt = altLatLngs[i + 1];
            if (!pt || !nextPt) continue;
            const dy = nextPt[0] - pt[0];
            const dx = nextPt[1] - pt[1];
            const angle = Math.atan2(dy, dx) * 180 / Math.PI;

            const arrowIcon = L.divIcon({
              className: "route-arrow-icon",
              html: `<div class="route-arrow-chevron" style="transform:rotate(${-angle}deg)">➤</div>`,
              iconSize: [14, 14],
              iconAnchor: [7, 7]
            });
            const arrowMarker = L.marker(pt, { icon: arrowIcon, interactive: false, zIndexOffset: 700 }).addTo(mapInstance);
            rerouteLayersRef.current.push(arrowMarker);
          }
        }
      }
      setTimeout(() => { altAnimFrameRef.current = requestAnimationFrame(drawStep); }, 400);
    }

    // ── 3. Threat Zones ───────────────────────────────────────────────────
    zones.forEach(zone => {
      const [lat, lng] = zone.center;
      const radiusM = zone.radiusKm * 1000;
      const color   = threatColor(zone.severity);

      const pulseIcon = L.divIcon({
        className: "threat-pulse-icon",
        html: `<div class="threat-pulse-ring" style="--tc:${color}"></div>`,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });
      const pulseMarker = L.marker([lat, lng], { icon: pulseIcon, interactive: false, zIndexOffset: 600 }).addTo(mapInstance);

      const threatCircle = L.circle([lat, lng], {
        className: "threat-circle-dramatic",
        color,
        fillColor: color,
        fillOpacity: 0.22,
        radius: radiusM,
        weight: 2.5,
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

    if (alternateRoute?.points?.length) {
      if (customStormCell) {
        mapInstance.setView(customStormCell, 5, { animate: true, duration: 1 });
      } else {
        const bounds = L.latLngBounds(alternateRoute.points.map(p => [p.lat, p.lng]));
        mapInstance.fitBounds(bounds.pad(0.25), { animate: true, duration: 1 });
      }
    }
  }, [mapInstance, rerouteData, rerouteStatus, showOriginal, customStormCell]);

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
      const color  = threat.riskLevel === "CRITICAL" ? "#ec4899" : threat.riskLevel === "HIGH" ? "#a855f7" : "#c084fc";
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

  // ── Swarm routes rendering ────────────────────────────────────────────────
  useEffect(() => {
    if (!mapInstance) return;
    swarmLayersRef.current.forEach(l => l.remove());
    swarmLayersRef.current = [];

    if (!swarmMode || !swarmRerouteDataList.length) return;

    const filteredSwarmRoutes = (focusMode && activeHighlightId)
      ? swarmRerouteDataList.filter(d => (d.flightId || d.id) === activeHighlightId)
      : swarmRerouteDataList;

    filteredSwarmRoutes.forEach((data, i) => {
      const color = SWARM_COLORS[i % SWARM_COLORS.length];
      const { alternateRoute, threatZones: zones = [] } = data;

      const fId = data.flightId || data.id;
      const isHighlighted = activeHighlightId ? fId === activeHighlightId : false;
      const hasAnyHighlight = !!activeHighlightId;

      const lineWeight = isHighlighted ? 8 : (hasAnyHighlight ? 3.5 : 5);
      const lineOpacity = isHighlighted ? 1.0 : (hasAnyHighlight ? 0.25 : 0.9);
      const glowWeight = isHighlighted ? 26 : 18;
      const glowOpacity = isHighlighted ? 0.45 : (hasAnyHighlight ? 0.08 : 0.18);

      const glowClass = `route-glow-line route-glow-line--pulsing ${
        isHighlighted ? "route-glow-line--highlighted" : hasAnyHighlight ? "route-glow-line--dimmed" : ""
      }`;
      const lineClass = `route-alt-line ${
        isHighlighted ? "route-alt-line--highlighted" : hasAnyHighlight ? "route-alt-line--dimmed" : ""
      }`;

      if (alternateRoute?.points?.length) {
        const altLatLngs = alternateRoute.points.map(p => [p.lat, p.lng]);
        
        // glow
        const glow = L.polyline(altLatLngs, {
          className: glowClass,
          color,
          weight: glowWeight,
          opacity: glowOpacity,
          smoothFactor: 1,
          interactive: false
        }).addTo(mapInstance);

        // main line
        const line = L.polyline(altLatLngs, {
          className: lineClass,
          color,
          weight: lineWeight,
          opacity: lineOpacity,
          smoothFactor: 1,
          interactive: false
        }).addTo(mapInstance);
        swarmLayersRef.current.push(glow, line);

        // Destination label
        const endPt = altLatLngs[altLatLngs.length - 1];
        const labelOpacity = isHighlighted ? 1.0 : (hasAnyHighlight ? 0.35 : 0.9);
        const labelIcon = L.divIcon({
          className: "",
          html: `<div style="background:${color};color:#000;font-size:9px;font-weight:800;padding:2px 6px;border-radius:20px;white-space:nowrap;opacity:${labelOpacity};transition:opacity 0.2s">${data.flightNumber || "FLT"}</div>`,
          iconAnchor: [20, 8],
        });
        const label = L.marker(endPt, { icon: labelIcon, interactive: false, zIndexOffset: isHighlighted ? 900 : 800 }).addTo(mapInstance);
        swarmLayersRef.current.push(label);
      }

      // Threat zones per flight
      zones.forEach(zone => {
        const [lat, lng] = zone.center;
        const zColor = threatColor(zone.severity);
        const zoneOpacity = isHighlighted ? 0.22 : (hasAnyHighlight ? 0.05 : 0.15);
        const circle = L.circle([lat, lng], {
          className: `threat-circle-dramatic ${isHighlighted ? "" : hasAnyHighlight ? "threat-circle--dimmed" : ""}`,
          color: zColor,
          fillColor: zColor,
          fillOpacity: zoneOpacity,
          radius: zone.radiusKm * 1000,
          weight: isHighlighted ? 2.5 : 1.5,
          dashArray: "5,5",
        }).addTo(mapInstance);
        swarmLayersRef.current.push(circle);
      });
    });

    // Fit all swarm routes
    const allPts = swarmRerouteDataList.flatMap(d => (d.alternateRoute?.points || []).map(p => [p.lat, p.lng]));
    if (allPts.length && !hasFittedSwarmBoundsRef.current) {
      if (customStormCell) {
        mapInstance.setView(customStormCell, 5, { animate: true, duration: 1 });
      } else {
        mapInstance.fitBounds(L.latLngBounds(allPts).pad(0.2), { animate: true, duration: 1 });
      }
      hasFittedSwarmBoundsRef.current = true;
    }
  }, [mapInstance, swarmMode, swarmRerouteDataList, activeHighlightId, focusMode, customStormCell]);

  const hasSelectedFlight = swarmMode || !!selectedFlightId;
  const stormBtnTitle = swarmMode
    ? "Inject Storm across entire fleet (Swarm Mode)"
    : (!!selectedFlightId ? "Simulate a storm and compute an alternate route" : "Select a flight from the fleet list first");

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
          {/* Custom Storm Draw Mode Button */}
          <button
            className={`draw-storm-btn ${drawStormMode ? "draw-storm-btn--active" : ""}`}
            onClick={() => setDrawStormMode(prev => !prev)}
            title="Place custom convective storm cell on map"
            style={{
              background: drawStormMode ? "rgba(239, 68, 68, 0.25)" : "rgba(255, 255, 255, 0.05)",
              border: drawStormMode ? "1px solid #ef4444" : "1px solid rgba(255, 255, 255, 0.12)",
              color: drawStormMode ? "#ef4444" : "var(--text)",
              textShadow: drawStormMode ? "0 0 5px #ef4444" : "none",
            }}
          >
            ⛈ {drawStormMode ? "Cancel Draw" : "Draw Storm"}
          </button>

          {/* Clear Custom Storm Button */}
          {customStormCell && (
            <button
              className="clear-storm-btn"
              onClick={onClearStorm}
              title="Clear custom storm cell and restore normal routing"
              style={{
                background: "rgba(236, 72, 153, 0.12)",
                border: "1px solid rgba(236, 72, 153, 0.4)",
                color: "#ec4899",
                cursor: "pointer",
                padding: "6px 12px",
                borderRadius: "10px",
                fontSize: "12px",
                fontWeight: "bold",
                display: "flex",
                alignItems: "center",
                gap: "4px",
                transition: "all 0.2s"
              }}
            >
              ✕ Clear Storm
            </button>
          )}

          {/* Inject Storm Button */}
          <div style={{ position: "relative" }} className="inject-storm-wrap">
            <button
              id="inject-storm-btn"
              className={`inject-storm-btn ${swarmMode ? "inject-storm-btn--swarm" : ""} ${!hasSelectedFlight ? "inject-storm-btn--disabled" : ""} ${isStormLoading ? "inject-storm-btn--loading" : ""}`}
              onClick={() => !isStormLoading && onInjectStorm && onInjectStorm()}
              disabled={isStormLoading}
              title={stormBtnTitle}
            >
              {isStormLoading ? (
                <>
                  <span className="inject-storm-btn__spinner" />
                  {swarmMode ? `Computing fleet…` : "Simulating…"}
                </>
              ) : (
                <>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: "5px" }}>
                    <path d="M7 2v11h3v9l7-12h-4l4-8z"/>
                  </svg>
                  {swarmMode ? "⚡ Inject Swarm Storm" : "Inject Storm"}
                </>
              )}
            </button>
            {!hasSelectedFlight && !swarmMode && (
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
        <div ref={mapShellRef} className={`map-shell ${drawStormMode ? "map-shell--draw-mode" : ""}`}>
          {/* Status badge */}
          <div className="map-shell__status">
            <p className="map-shell__status-title">{swarmMode ? "⚡ Swarm Airspace" : "OpenStreetMap Engine"}</p>
            <p className="map-shell__status-copy">
              {isStormLoading
                ? (swarmMode ? "Computing fleet-wide reroutes…" : "Computing alternate route…")
                : swarmMode && swarmRerouteDataList.length
                  ? `${swarmRerouteDataList.length} fleet routes active`
                  : weatherLoading
                    ? "Syncing weather intelligence…"
                    : "Active Airspace Tracking"}
            </p>
          </div>

          {/* Map Legend */}
          <div className="map-shell__legend">
            <p className="map-shell__legend-title">Airspace Legend</p>
            <div className="map-legend-items">
              <div className="map-legend-item">
                <span className="map-legend-color" style={{ background: "#22d3ee" }} />
                <span>Active Reroute</span>
              </div>
              <div className="map-legend-item">
                <span className="map-legend-color map-legend-color--pulsing" style={{ background: "rgba(236, 72, 153, 0.35)", border: "1px dashed #ec4899" }} />
                <span>Storm Cell</span>
              </div>
              {swarmMode && (
                <div className="map-legend-item" style={{ marginTop: "4px" }}>
                  <span className="map-legend-color" style={{ background: "linear-gradient(90deg, #22d3ee, #a78bfa, #34d399, #fb923c, #f472b6)" }} />
                  <span>Fleet Routes</span>
                </div>
              )}
            </div>
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

          {/* Instruction overlay when custom storm is active but no flight is selected */}
          {customStormCell && !selectedFlightId && !swarmMode && (
            <div
              className="map-instruction-overlay"
              style={{
                position: "absolute",
                top: "20px",
                right: "20px",
                background: "rgba(6, 16, 29, 0.85)",
                backdropFilter: "blur(12px)",
                border: "1px solid rgba(236, 72, 153, 0.3)",
                borderRadius: "14px",
                padding: "16px 20px",
                maxWidth: "320px",
                zIndex: 1000,
                boxShadow: "0 8px 32px 0 rgba(0, 0, 0, 0.37)",
                animation: "consoleMsgSlideIn 0.3s ease-out both"
              }}
            >
              <h3 style={{ margin: "0 0 6px 0", color: "#ec4899", fontSize: "13px", display: "flex", alignItems: "center", gap: "6px" }}>
                🌩 Custom Weather Active
              </h3>
              <p style={{ margin: 0, fontSize: "11px", color: "var(--text)", lineHeight: "1.45" }}>
                Convective cell placed at <strong>{customStormCell[0].toFixed(2)}°N, {customStormCell[1].toFixed(2)}°E</strong>.
              </p>
              <div style={{ marginTop: "12px", borderTop: "1px solid rgba(255, 255, 255, 0.08)", paddingTop: "10px", fontSize: "11px", color: "#22d3ee", display: "flex", alignItems: "center", gap: "5px", fontWeight: "bold" }}>
                <span>➔ Select a flight from the left panel to calculate dynamic weather avoidance.</span>
              </div>
            </div>
          )}

          {/* Floating RerouteCard */}
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
