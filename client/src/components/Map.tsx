import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { cn } from "@/lib/utils";

// Default marker assets (bundlers break Leaflet's relative icon paths)
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

interface MapViewProps {
  className?: string;
  initialCenter?: { lat: number; lng: number };
  initialZoom?: number;
  /** GeoJSON coordinates [lng, lat][] as JSON string */
  routeGeometryJson?: string | null;
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
    // Map instance is created once; center/zoom apply on first mount only.
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
      const latlngs = parseRouteLatLngs(routeGeometryJson);
      if (latlngs.length === 0) return;

      const polyline = L.polyline(latlngs, {
        color: "#0d9488",
        weight: 5,
        opacity: 0.85,
      }).addTo(layer);

      L.marker(latlngs[0]!).addTo(layer);
      L.marker(latlngs[latlngs.length - 1]!).addTo(layer);

      map.fitBounds(polyline.getBounds(), { padding: [48, 48] });
      requestAnimationFrame(() => map.invalidateSize());
    } catch (e) {
      console.error("Failed to render OSM route:", e);
    }
  }, [routeGeometryJson, initialCenter.lat, initialCenter.lng, initialZoom]);

  return (
    <div
      ref={containerRef}
      className={cn("w-full h-[400px] rounded-xl overflow-hidden z-0", className)}
    />
  );
}
