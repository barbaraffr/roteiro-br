/**
 * OpenStreetMap integrations:
 * - Photon (Komoot) for city autocomplete / geocoding
 * - OSRM for driving directions
 *
 * Defaults use public demos (rate-limited). Override via PHOTON_URL / OSRM_URL.
 */

const USER_AGENT = "RoteiroBR/1.0 (https://github.com/roteiro-br; travel cost calculator)";

/** Brazil bounding box: minLon, minLat, maxLon, maxLat */
const BRAZIL_BBOX = "-74.0,-33.8,-34.0,5.3";

export type LatLng = { lat: number; lng: number };

export type CityPrediction = {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
  lat: number;
  lng: number;
};

export type RouteResult = {
  distanceMeters: number;
  durationSeconds: number;
  /** GeoJSON LineString coordinates [lng, lat][] serialized as JSON */
  geometryJson: string;
  originLabel: string;
  destinationLabel: string;
};

type PhotonFeature = {
  geometry: { coordinates: [number, number] };
  properties: {
    osm_id?: number;
    osm_type?: string;
    name?: string;
    city?: string;
    district?: string;
    state?: string;
    country?: string;
    countrycode?: string;
    type?: string;
    extent?: number[];
  };
};

type PhotonResponse = { features?: PhotonFeature[] };

type OsrmRouteResponse = {
  code: string;
  routes?: Array<{
    distance: number;
    duration: number;
    geometry: { coordinates: [number, number][]; type: string };
  }>;
};

function getPhotonUrl(): string {
  return (process.env.PHOTON_URL || "https://photon.komoot.io").replace(/\/+$/, "");
}

function getOsrmUrl(): string {
  return (process.env.OSRM_URL || "https://router.project-osrm.org").replace(
    /\/+$/,
    ""
  );
}

/** Encode coordinates as stable placeId used by autocomplete + calculate. */
export function encodePlaceId(lat: number, lng: number): string {
  return `${lat.toFixed(6)},${lng.toFixed(6)}`;
}

export function decodePlaceId(placeId: string): LatLng {
  const [latStr, lngStr] = placeId.split(",");
  const lat = Number(latStr);
  const lng = Number(lngStr);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error(`placeId inválido: ${placeId}`);
  }
  return { lat, lng };
}

function buildDescription(props: PhotonFeature["properties"]): {
  mainText: string;
  secondaryText: string;
  description: string;
} {
  const mainText = props.name || props.city || "Local";
  const parts = [
    props.city && props.city !== mainText ? props.city : undefined,
    props.state,
    props.country,
  ].filter(Boolean);
  const secondaryText = parts.join(", ");
  const description = secondaryText ? `${mainText}, ${secondaryText}` : mainText;
  return { mainText, secondaryText, description };
}

/**
 * Reverse-geocode coordinates via Photon into a city-like prediction.
 */
export async function reverseGeocode(
  lat: number,
  lng: number
): Promise<CityPrediction | null> {
  const url = new URL(`${getPhotonUrl()}/reverse`);
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lng));
  // The public Photon instance only supports default/de/en/fr — "pt" returns 400.
  url.searchParams.set("lang", "default");

  const response = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
      "User-Agent": USER_AGENT,
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `Photon reverse failed (${response.status}): ${body || response.statusText}`
    );
  }

  const data = (await response.json()) as PhotonResponse;
  const feature = data.features?.[0];
  if (!feature) return null;

  const props = feature.properties ?? {};
  const country = (props.countrycode || "").toUpperCase();
  if (country && country !== "BR") {
    throw new Error("LOCALIZACAO_FORA_DO_BRASIL");
  }

  // Prefer city-level labels for trip origin (reverse often returns street POIs).
  const mainText = props.city || props.name || props.district || "Localização atual";
  const parts = [
    props.district && props.district !== mainText ? props.district : undefined,
    props.state,
    props.country,
  ].filter(Boolean);
  const secondaryText = parts.join(", ");
  const description = secondaryText
    ? `${mainText}, ${secondaryText}`
    : mainText;

  return {
    placeId: encodePlaceId(lat, lng),
    lat,
    lng,
    mainText,
    secondaryText,
    description,
  };
}

/**
 * Search Brazilian places (cities/towns) via Photon.
 */
export async function searchCities(query: string): Promise<CityPrediction[]> {
  const url = new URL(`${getPhotonUrl()}/api/`);
  url.searchParams.set("q", query);
  // The public Photon instance only supports default/de/en/fr — "pt" returns 400.
  url.searchParams.set("lang", "default");
  url.searchParams.set("limit", "15");
  url.searchParams.set("bbox", BRAZIL_BBOX);
  for (const layer of ["city", "district", "locality"]) {
    url.searchParams.append("layer", layer);
  }

  const response = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
      "User-Agent": USER_AGENT,
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `Photon search failed (${response.status}): ${body || response.statusText}`
    );
  }

  const data = (await response.json()) as PhotonResponse;
  const features = data.features ?? [];

  const seen = new Set<string>();
  const predictions: CityPrediction[] = [];

  for (const feature of features) {
    const props = feature.properties ?? {};
    const country = (props.countrycode || "").toUpperCase();
    if (country && country !== "BR") continue;

    const [lng, lat] = feature.geometry.coordinates;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

    const placeId = encodePlaceId(lat, lng);
    if (seen.has(placeId)) continue;
    seen.add(placeId);

    const labels = buildDescription(props);
    predictions.push({
      placeId,
      lat,
      lng,
      ...labels,
    });

    if (predictions.length >= 8) break;
  }

  return predictions;
}

export function formatDuration(seconds: number): string {
  const totalMinutes = Math.round(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours} h`;
  return `${hours} h ${minutes} min`;
}

/**
 * Driving route between two coordinates via OSRM.
 */
export async function getDrivingRoute(
  origin: LatLng,
  destination: LatLng,
  labels?: { originLabel?: string; destinationLabel?: string }
): Promise<RouteResult> {
  const coords = `${origin.lng},${origin.lat};${destination.lng},${destination.lat}`;
  const url = new URL(`${getOsrmUrl()}/route/v1/driving/${coords}`);
  url.searchParams.set("overview", "full");
  url.searchParams.set("geometries", "geojson");

  const response = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
      "User-Agent": USER_AGENT,
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `OSRM route failed (${response.status}): ${body || response.statusText}`
    );
  }

  const data = (await response.json()) as OsrmRouteResponse;

  if (data.code !== "Ok" || !data.routes?.length) {
    throw new Error(
      data.code === "NoRoute"
        ? "Não foi encontrada nenhuma rota entre as cidades informadas."
        : `OSRM falhou: ${data.code}`
    );
  }

  const route = data.routes[0];
  return {
    distanceMeters: route.distance,
    durationSeconds: Math.round(route.duration),
    geometryJson: JSON.stringify(route.geometry.coordinates),
    originLabel: labels?.originLabel ?? encodePlaceId(origin.lat, origin.lng),
    destinationLabel:
      labels?.destinationLabel ?? encodePlaceId(destination.lat, destination.lng),
  };
}
