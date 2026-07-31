import { useRef, useEffect } from "react";
import { MapView } from "@/components/Map";
import { cn } from "@/lib/utils";

declare global {
  interface Window {
    google?: typeof google;
  }
}

interface TripMapProps {
  polyline?: string | null;
  className?: string;
}

export function TripMap({ polyline, className }: TripMapProps) {
  const mapRef = useRef<google.maps.Map | null>(null);
  const directionsRendererRef = useRef<google.maps.DirectionsRenderer | null>(null);

  useEffect(() => {
    if (!mapRef.current || !polyline) return;

    const map = mapRef.current;

    // Clear previous renderer
    if (directionsRendererRef.current) {
      directionsRendererRef.current.setMap(null);
      directionsRendererRef.current = null;
    }

    // Decode polyline and display as a path
    try {
      const path = google.maps.geometry.encoding.decodePath(polyline);
      const bounds = new google.maps.LatLngBounds();
      path.forEach((point) => bounds.extend(point));

      const renderer = new google.maps.DirectionsRenderer({
        map,
        suppressMarkers: false,
        polylineOptions: {
          strokeColor: "#0d9488",
          strokeWeight: 5,
          strokeOpacity: 0.8,
        },
      });

      // Construct a directions result from the polyline
      // Since we have the raw polyline, we'll use a Polyline instead
      const flightPath = new google.maps.Polyline({
        path,
        geodesic: true,
        strokeColor: "#0d9488",
        strokeWeight: 5,
        strokeOpacity: 0.8,
        map,
      });

      map.fitBounds(bounds, 60);

      // Store for cleanup
      directionsRendererRef.current = {
        setMap: (m: google.maps.Map | null) => flightPath.setMap(m),
      } as any;
    } catch (e) {
      console.error("Failed to decode polyline:", e);
    }
  }, [polyline]);

  return (
    <MapView
      className={cn("w-full h-[400px] rounded-xl overflow-hidden", className)}
      initialCenter={{ lat: -14.235, lng: -51.9553 }}
      initialZoom={4}
      onMapReady={(map) => {
        mapRef.current = map;
        if (polyline) {
          // Trigger the effect manually on first load
          const path = google.maps.geometry.encoding.decodePath(polyline);
          const bounds = new google.maps.LatLngBounds();
          path.forEach((point) => bounds.extend(point));
          new google.maps.Polyline({
            path,
            geodesic: true,
            strokeColor: "#0d9488",
            strokeWeight: 5,
            strokeOpacity: 0.8,
            map,
          });
          map.fitBounds(bounds, 60);
        }
      }}
    />
  );
}
