import mapboxgl from "mapbox-gl";
import { useEffect } from "react";

const SOURCE_ID = "weather-threats";
const STORM_LAYER_ID = "weather-threat-storm";
const WARNING_LAYER_ID = "weather-threat-warning";
const LABEL_LAYER_ID = "weather-threat-labels";

function cleanupLayer(map, layerId) {
  if (map.isStyleLoaded() && map.getLayer(layerId)) {
    map.removeLayer(layerId);
  }
}

function cleanupSource(map, sourceId) {
  if (map.isStyleLoaded() && map.getSource(sourceId)) {
    map.removeSource(sourceId);
  }
}

function buildCollection(threats) {
  return {
    type: "FeatureCollection",
    features: threats.map((threat) => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [threat.longitude, threat.latitude],
      },
      properties: {
        id: threat.id,
        name: threat.flightNumber || threat.name || threat.airline || "Weather Zone",
        riskLevel: threat.riskLevel || threat.severity || "LOW",
        weatherThreat: threat.weatherThreat || threat.label || "Clear",
        precipitation: threat.precipitation ?? 0,
        windSpeed: threat.windSpeed ?? 0,
        recommendation: threat.recommendation || threat.description || "Continue Monitoring",
      },
    })),
  };
}

function addOrUpdateThreatLayers(map, threats) {
  const collection = buildCollection(threats);
  const source = map.getSource(SOURCE_ID);

  if (!source) {
    map.addSource(SOURCE_ID, {
      type: "geojson",
      data: collection,
    });

    map.addLayer({
      id: STORM_LAYER_ID,
      type: "circle",
      source: SOURCE_ID,
      filter: ["in", ["get", "riskLevel"], "LOW", "HIGH", "CRITICAL"],
      paint: {
        "circle-color": [
          "match",
          ["get", "riskLevel"],
          "LOW",
          "#facc15",
          "HIGH",
          "#fb923c",
          "CRITICAL",
          "#ef4444",
          "#facc15",
        ],
        "circle-opacity": 0.22,
        "circle-radius": ["interpolate", ["linear"], ["get", "precipitation"], 0, 16, 10, 42],
        "circle-blur": 0.2,
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 2,
        "circle-stroke-opacity": 0.65,
      },
    });

    map.addLayer({
      id: WARNING_LAYER_ID,
      type: "circle",
      source: SOURCE_ID,
      filter: ["in", ["get", "riskLevel"], "HIGH", "CRITICAL"],
      paint: {
        "circle-color": [
          "match",
          ["get", "riskLevel"],
          "HIGH",
          "#fb923c",
          "CRITICAL",
          "#ef4444",
          "#fb923c",
        ],
        "circle-opacity": 0.28,
        "circle-radius": ["interpolate", ["linear"], ["get", "windSpeed"], 0, 18, 80, 48],
        "circle-blur": 0.14,
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 2,
        "circle-stroke-opacity": 0.75,
      },
    });

    map.addLayer({
      id: LABEL_LAYER_ID,
      type: "symbol",
      source: SOURCE_ID,
      layout: {
        "text-field": ["concat", ["get", "weatherThreat"], " - ", ["get", "riskLevel"]],
        "text-font": ["Open Sans Regular", "Arial Unicode MS Regular"],
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

    const handleMouseEnter = () => {
      map.getCanvas().style.cursor = "pointer";
    };

    const handleMouseLeave = () => {
      map.getCanvas().style.cursor = "";
    };

    const handleClick = (event) => {
      const feature = event.features?.[0];
      if (!feature) {
        return;
      }

      const { properties } = feature;
      new mapboxgl.Popup({ offset: 18, closeButton: true })
        .setLngLat(event.lngLat)
        .setHTML(
          `<strong>${properties?.name || "Weather Zone"}</strong><br/>Wind Speed: ${properties?.windSpeed ?? "N/A"} km/h<br/>Rainfall: ${properties?.precipitation ?? "N/A"} mm<br/>Threat Level: ${properties?.riskLevel || "LOW"}`,
        )
        .addTo(map);
    };

    map.on("mouseenter", STORM_LAYER_ID, handleMouseEnter);
    map.on("mouseleave", STORM_LAYER_ID, handleMouseLeave);
    map.on("click", STORM_LAYER_ID, handleClick);
  } else {
    source.setData(collection);
  }
}

function WeatherThreatLayer({ map, threats = [] }) {
  useEffect(() => {
    if (!map) {
      return undefined;
    }

    const onLoad = () => addOrUpdateThreatLayers(map, threats);

    if (map.isStyleLoaded()) {
      addOrUpdateThreatLayers(map, threats);
    } else {
      map.once("load", onLoad);
    }

    return () => {
      map.off("load", onLoad);
      cleanupLayer(map, LABEL_LAYER_ID);
      cleanupLayer(map, WARNING_LAYER_ID);
      cleanupLayer(map, STORM_LAYER_ID);
      cleanupSource(map, SOURCE_ID);
    };
  }, [map, threats]);

  return null;
}

export default WeatherThreatLayer;
