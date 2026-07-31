import { MapView } from "@/components/Map";
import { cn } from "@/lib/utils";

interface TripMapProps {
  /** GeoJSON coordinates [lng, lat][] as JSON string (OSRM) */
  polyline?: string | null;
  className?: string;
}

export function TripMap({ polyline, className }: TripMapProps) {
  return (
    <MapView
      className={cn("w-full h-[400px] rounded-xl overflow-hidden", className)}
      initialCenter={{ lat: -14.235, lng: -51.9253 }}
      initialZoom={4}
      routeGeometryJson={polyline}
    />
  );
}
