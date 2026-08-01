import { MapView } from "@/components/Map";
import { cn } from "@/lib/utils";

interface TripMapProps {
  /** GeoJSON coordinates [lng, lat][] as JSON string (OSRM outbound) */
  polyline?: string | null;
  /** Optional return-leg geometry for round trips */
  returnPolyline?: string | null;
  className?: string;
}

export function TripMap({ polyline, returnPolyline, className }: TripMapProps) {
  return (
    <MapView
      className={cn("w-full h-[400px] rounded-xl overflow-hidden", className)}
      initialCenter={{ lat: -14.235, lng: -51.9253 }}
      initialZoom={4}
      routeGeometryJson={polyline}
      returnGeometryJson={returnPolyline}
    />
  );
}
