import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import { cn } from "@/lib/utils";

const routeMarkerIcon = L.icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

interface MapViewProps {
  className?: string;
  initialCenter?: { lat: number; lng: number };
  initialZoom?: number;
  /** GeoJSON coordinates [lng, lat][] as JSON string (outbound) */
  routeGeometryJson?: string | null;
  /** Optional return leg geometry */
  returnGeometryJson?: string | null;
}

function parseRouteLatLngs(geometryJson: string): L.LatLngExpression[] {
  const coords = JSON.parse(geometryJson) as [number, number][];
  if (!Array.isArray(coords) || coords.length === 0) return [];
  return coords.map(([lng, lat]) => [lat, lng] as [number, number]);
}

export function MapView({
  className,
  initialCenter = { lat: -14.235, lng: -51.9253 },
  initialZoom = 4,
  routeGeometryJson,
  returnGeometryJson,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const routeLayerRef = useRef<L.FeatureGroup | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [initialCenter.lat, initialCenter.lng],
      zoom: initialZoom,
      scrollWheelZoom: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    routeLayerRef.current = L.featureGroup().addTo(map);
    mapRef.current = map;

    requestAnimationFrame(() => map.invalidateSize());

    return () => {
      map.remove();
      mapRef.current = null;
      routeLayerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = routeLayerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();

    if (!routeGeometryJson) {
      map.setView([initialCenter.lat, initialCenter.lng], initialZoom);
      return;
    }

    try {
      const outbound = parseRouteLatLngs(routeGeometryJson);
      if (outbound.length === 0) return;

      const outboundLine = L.polyline(outbound, {
        color: "#0d9488",
        weight: 5,
        opacity: 0.9,
      }).addTo(layer);

      L.marker(outbound[0]!, { icon: routeMarkerIcon }).addTo(layer);
      L.marker(outbound[outbound.length - 1]!, { icon: routeMarkerIcon }).addTo(
        layer
      );

      if (returnGeometryJson) {
        const inbound = parseRouteLatLngs(returnGeometryJson);
        if (inbound.length > 0) {
          L.polyline(inbound, {
            color: "#0369a1",
            weight: 4,
            opacity: 0.75,
            dashArray: "8 6",
          }).addTo(layer);
        }
      }

      map.fitBounds(layer.getBounds(), { padding: [48, 48] });
      requestAnimationFrame(() => map.invalidateSize());

      // Keep a reference so the linter doesn't treat outboundLine as unused.
      void outboundLine;
    } catch (e) {
      console.error("Failed to render OSM route:", e);
    }
  }, [
    routeGeometryJson,
    returnGeometryJson,
    initialCenter.lat,
    initialCenter.lng,
    initialZoom,
  ]);

  return (
    <div
      ref={containerRef}
      className={cn("w-full h-[400px] rounded-xl overflow-hidden z-0", className)}
    />
  );
}
