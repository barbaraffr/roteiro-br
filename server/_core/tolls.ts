/**
 * Toll plaza detection along a route using OpenStreetMap data (Overpass API).
 *
 * OSM tags toll plazas as barrier=toll_booth, often carrying a `charge` tag
 * such as "5.50BRL/motorcar;2.75BRL/motorcycle". We query booths within a
 * corridor around the route geometry and sum the car fare.
 */

const USER_AGENT =
  "RoteiroBR/1.0 (https://github.com/roteiro-br; travel cost calculator)";

/**
 * Overpass returns every booth in the route's bounding box; the local distance
 * filter is what keeps plazas from neighbouring highways out.
 */
const BBOX_MARGIN_DEG = 0.02;
const MAX_BBOXES = 25;
const MAX_ROUTE_DISTANCE_M = 80;

/** How far a booth's tagged direction may differ from our travel bearing. */
const MAX_DIRECTION_DIFF_DEG = 90;

/** Booths closer than this are cabins of the same plaza (both directions). */
const PLAZA_CLUSTER_M = 1500;

/** Same-named booths this close are the same plaza mapped as separate nodes. */
const SAME_NAME_CLUSTER_M = 6000;

/** Overpass rejects very long queries, so cap the polyline we send. */
const MAX_POLYLINE_POINTS = 400;
const MIN_POINT_SPACING_M = 400;

/** Used when a booth exists but OSM has no usable `charge` tag. */
export const FALLBACK_TOLL_PRICE = 10.0;

export type TollPlaza = {
  name: string;
  price: number;
  /** false when the price came from FALLBACK_TOLL_PRICE */
  priceFromOsm: boolean;
  lat: number;
  lng: number;
};

export type TollSummary = {
  plazas: TollPlaza[];
  total: number;
  /** true when every plaza had a price in OSM */
  allPricesFromOsm: boolean;
  /** true when Overpass was unreachable and this summary is a graceful empty fallback */
  lookupFailed?: boolean;
};

type OverpassElement = {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

type OverpassResponse = { elements?: OverpassElement[] };

/**
 * Overpass mirrors can hang under load, so every attempt is bounded and the
 * whole lookup gives up rather than holding the user's request open.
 *
 * IMPORTANT: MIRROR_TIMEOUT_MS (client-side abort) must stay comfortably
 * above the `[timeout:N]` we declare inside the Overpass QL query itself.
 * If the client aborts before the server's own timeout fires, every request
 * fails as a client-side TimeoutError even when Overpass would have answered
 * (with data or a clean error) shortly after. Keep OVERPASS_QUERY_TIMEOUT_S
 * a few seconds below MIRROR_TIMEOUT_MS.
 */
const MIRROR_TIMEOUT_MS = 14_000;
const OVERPASS_QUERY_TIMEOUT_S = 11;
const TOTAL_TIMEOUT_MS = 32_000;
const MIRROR_ATTEMPTS = 2;
const RETRY_DELAY_MS = 1_500;

/** Public Overpass mirrors, tried in parallel — they rate-limit aggressively. */
const DEFAULT_OVERPASS_URLS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];

function getOverpassUrls(): string[] {
  const configured = process.env.OVERPASS_URL;
  const urls = configured ? configured.split(",") : DEFAULT_OVERPASS_URLS;
  return urls.map((url) => url.trim().replace(/\/+$/, "")).filter(Boolean);
}

/** Routes rarely change; caching spares the public mirrors on repeat lookups. */
const tollCache = new Map<string, TollSummary>();
const TOLL_CACHE_MAX_ENTRIES = 200;

function cacheKey(points: Array<{ lat: number; lng: number }>): string {
  const first = points[0]!;
  const last = points[points.length - 1]!;
  return [
    "v2-order", // bump when plaza list shape/order semantics change
    first.lat.toFixed(4),
    first.lng.toFixed(4),
    last.lat.toFixed(4),
    last.lng.toFixed(4),
    points.length,
  ].join(":");
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Single mirror request. Throws on non-OK response, timeout, or network error. */
async function fetchFromMirror(
  url: string,
  query: string,
  timeoutMs: number
): Promise<OverpassResponse> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": USER_AGENT,
    },
    body: new URLSearchParams({ data: query }).toString(),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `Overpass ${response.status}: ${body.slice(0, 120) || response.statusText}`
    );
  }

  return (await response.json()) as OverpassResponse;
}

/**
 * Races all configured mirrors against each other rather than trying them
 * one after another. A sequential loop of N mirrors at T seconds each can
 * cost up to N*T seconds for a single pass; racing them costs roughly the
 * time of whichever mirror answers first.
 */
async function queryOverpass(query: string): Promise<OverpassResponse> {
  const urls = getOverpassUrls();
  const deadline = Date.now() + TOTAL_TIMEOUT_MS;
  let lastError: unknown;

  for (let attempt = 0; attempt < MIRROR_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      const remaining = deadline - Date.now();
      if (remaining <= RETRY_DELAY_MS) break;
      await sleep(RETRY_DELAY_MS);
    }

    const remaining = deadline - Date.now();
    if (remaining <= 0) break;

    const perMirrorTimeout = Math.min(MIRROR_TIMEOUT_MS, remaining);

    const requests = urls.map((url) =>
      fetchFromMirror(url, query, perMirrorTimeout).catch((error) => {
        lastError = error;
        console.warn(`[Tolls] mirror failed (${url}):`, error);
        throw error;
      })
    );

    try {
      return await Promise.any(requests);
    } catch {
      // Every mirror failed this pass; loop will retry or exit below.
    }
  }

  throw new Error(`Overpass toll lookup failed: ${lastError}`);
}

const EARTH_RADIUS_M = 6371000;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** Great-circle distance in meters. */
export function haversineMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Shortest distance in meters from a point to a polyline, using a local
 * equirectangular projection (accurate enough at these scales).
 */
export function distanceToPolylineMeters(
  point: { lat: number; lng: number },
  polyline: Array<{ lat: number; lng: number }>
): number {
  return nearestSegment(point, polyline).distance;
}

/** Compass bearing (0-360, clockwise from north) from `a` to `b`. */
export function bearingDegrees(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const dLng = toRadians(b.lng - a.lng);

  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);

  return (Math.atan2(y, x) * (180 / Math.PI) + 360) % 360;
}

/** Smallest angle between two bearings, 0-180. */
export function angleDifference(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360;
  return diff > 180 ? 360 - diff : diff;
}

/** Closest segment of the polyline, with the travel bearing along it. */
export function nearestSegment(
  point: { lat: number; lng: number },
  polyline: Array<{ lat: number; lng: number }>
): {
  distance: number;
  bearing: number | null;
  segmentIndex: number;
  t: number;
} {
  if (polyline.length === 0) {
    return { distance: Infinity, bearing: null, segmentIndex: 0, t: 0 };
  }
  if (polyline.length === 1) {
    return {
      distance: haversineMeters(point, polyline[0]!),
      bearing: null,
      segmentIndex: 0,
      t: 0,
    };
  }

  const latScale = Math.cos(toRadians(point.lat));
  const toXY = (p: { lat: number; lng: number }) => ({
    x: toRadians(p.lng - point.lng) * latScale * EARTH_RADIUS_M,
    y: toRadians(p.lat - point.lat) * EARTH_RADIUS_M,
  });

  let best = Infinity;
  let bestIndex = 0;
  let bestT = 0;

  for (let i = 0; i < polyline.length - 1; i++) {
    const a = toXY(polyline[i]!);
    const b = toXY(polyline[i + 1]!);

    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lengthSq = dx * dx + dy * dy;

    // Point is at the origin, so distance is just the projection's magnitude.
    let t = lengthSq === 0 ? 0 : -(a.x * dx + a.y * dy) / lengthSq;
    t = Math.max(0, Math.min(1, t));

    const px = a.x + t * dx;
    const py = a.y + t * dy;
    const distance = Math.sqrt(px * px + py * py);

    if (distance < best) {
      best = distance;
      bestIndex = i;
      bestT = t;
    }
  }

  return {
    distance: best,
    bearing: bearingDegrees(polyline[bestIndex]!, polyline[bestIndex + 1]!),
    segmentIndex: bestIndex,
    t: bestT,
  };
}

/** Cumulative meters from the start of the polyline to each vertex. */
export function cumulativeDistancesMeters(
  polyline: Array<{ lat: number; lng: number }>
): number[] {
  const distances = [0];
  for (let i = 1; i < polyline.length; i++) {
    distances.push(
      distances[i - 1]! + haversineMeters(polyline[i - 1]!, polyline[i]!)
    );
  }
  return distances;
}

/**
 * Distance along the route from the origin to the point's nearest projection.
 * Used to list toll plazas in travel order.
 */
export function progressAlongPolylineMeters(
  point: { lat: number; lng: number },
  polyline: Array<{ lat: number; lng: number }>,
  cumulative?: number[]
): number {
  if (polyline.length === 0) return 0;
  if (polyline.length === 1) return 0;

  const { segmentIndex, t } = nearestSegment(point, polyline);
  const prefix = cumulative ?? cumulativeDistancesMeters(polyline);
  const segmentLength = haversineMeters(
    polyline[segmentIndex]!,
    polyline[segmentIndex + 1]!
  );
  return prefix[segmentIndex]! + t * segmentLength;
}

/**
 * Thin out a route so Overpass receives a manageable polyline while keeping
 * its shape. Always preserves the first and last points.
 */
export function samplePolyline(
  coordinates: [number, number][],
  maxPoints = MAX_POLYLINE_POINTS,
  minSpacingM = MIN_POINT_SPACING_M
): Array<{ lat: number; lng: number }> {
  const points = coordinates
    .filter(
      ([lng, lat]) => Number.isFinite(lat) && Number.isFinite(lng)
    )
    .map(([lng, lat]) => ({ lat, lng }));

  if (points.length <= 2) return points;

  const sampled: Array<{ lat: number; lng: number }> = [points[0]!];
  let lastKept = points[0]!;

  for (let i = 1; i < points.length - 1; i++) {
    const point = points[i]!;
    if (haversineMeters(lastKept, point) >= minSpacingM) {
      sampled.push(point);
      lastKept = point;
    }
  }
  sampled.push(points[points.length - 1]!);

  if (sampled.length <= maxPoints) return sampled;

  // Still too dense: keep evenly spaced points plus the endpoints.
  const step = Math.ceil(sampled.length / maxPoints);
  const reduced = sampled.filter((_, index) => index % step === 0);
  const last = sampled[sampled.length - 1]!;
  if (reduced[reduced.length - 1] !== last) reduced.push(last);
  return reduced;
}

/**
 * Read the car fare from an OSM `charge` tag.
 * Handles "5.50BRL/motorcar;2.75BRL/motorcycle", "R$ 5,50" and "5.50 BRL".
 */
export function parseChargeForCar(tags: Record<string, string>): number | null {
  const candidates = [tags["charge"], tags["toll:motorcar"], tags["fee"]];

  for (const raw of candidates) {
    if (!raw) continue;

    const parts = raw.split(";").map((p) => p.trim());
    const carPart =
      parts.find((p) => /motorcar|car\b/i.test(p)) ??
      (parts.length === 1 ? parts[0] : undefined);
    if (!carPart) continue;

    // Match "5.50" or "5,50", ignoring any currency/vehicle suffix.
    const match = carPart.match(/(\d+(?:[.,]\d+)?)/);
    if (!match) continue;

    const price = Number(match[1]!.replace(",", "."));
    if (Number.isFinite(price) && price > 0) return price;
  }

  return null;
}

/**
 * Approximate the route with a chain of small bounding boxes.
 *
 * A single bbox spanning an interstate route covers a huge irrelevant area and
 * makes public mirrors return 504; `around` with a long polyline is just as
 * expensive. A union of small boxes hugs the route and stays fast. Precision
 * comes from the local distance filter afterwards.
 */
export function buildRouteBboxes(
  points: Array<{ lat: number; lng: number }>,
  maxBoxes = MAX_BBOXES
): string[] {
  if (points.length === 0) return [];

  const pointsPerBox = Math.max(2, Math.ceil(points.length / maxBoxes));
  const boxes: string[] = [];

  for (let start = 0; start < points.length; start += pointsPerBox) {
    // Overlap by one point so booths on a box seam are not missed.
    const chunk = points.slice(start, start + pointsPerBox + 1);
    if (chunk.length === 0) continue;

    const lats = chunk.map((p) => p.lat);
    const lngs = chunk.map((p) => p.lng);

    boxes.push(
      [
        Math.min(...lats) - BBOX_MARGIN_DEG,
        Math.min(...lngs) - BBOX_MARGIN_DEG,
        Math.max(...lats) + BBOX_MARGIN_DEG,
        Math.max(...lngs) + BBOX_MARGIN_DEG,
      ]
        .map((v) => v.toFixed(4))
        .join(",")
    );
  }

  return boxes;
}

function buildOverpassQuery(points: Array<{ lat: number; lng: number }>): string {
  const clauses = buildRouteBboxes(points)
    .map((bbox) => `node["barrier"="toll_booth"](${bbox});`)
    .join("\n  ");

  return `[out:json][timeout:${OVERPASS_QUERY_TIMEOUT_S}];
(
  ${clauses}
);
out body;`;
}

type TollBooth = TollPlaza & {
  /** Meters from route origin to this booth's projection on the polyline. */
  progressM: number;
};

/** Collapse booth cabins that belong to the same physical plaza. */
function clusterBooths(booths: TollBooth[]): TollBooth[] {
  const clusters: TollBooth[] = [];

  for (const booth of booths) {
    const existing = clusters.find((c) => {
      const gap = haversineMeters(c, booth);
      if (gap <= PLAZA_CLUSTER_M) return true;
      return c.name === booth.name && gap <= SAME_NAME_CLUSTER_M;
    });
    if (existing) {
      // Prefer a real OSM price over a fallback one.
      if (!existing.priceFromOsm && booth.priceFromOsm) {
        existing.price = booth.price;
        existing.priceFromOsm = true;
        existing.name = booth.name;
        existing.lat = booth.lat;
        existing.lng = booth.lng;
      }
      // Keep the earliest position along the route for travel order.
      existing.progressM = Math.min(existing.progressM, booth.progressM);
      continue;
    }
    clusters.push({ ...booth });
  }

  return clusters;
}

function boothName(tags: Record<string, string>, index: number): string {
  const raw = tags["name"] || tags["note"] || tags["operator"];
  if (!raw) return `Praça ${index + 1}`;

  return (
    raw
      // Cabin labels carry the direction ("Araguari 2 - Sul", "(sentido Norte)")
      .replace(/\s*\((?:sentido|sent\.?)[^)]*\)/gi, "")
      .split(" - ")[0]!
      .replace(/^Pedágio\s+/i, "")
      .trim() || `Praça ${index + 1}`
  );
}

/**
 * Find toll plazas along a route. Returns an empty summary (total 0) when the
 * route has none, or when Overpass is unreachable — in the latter case
 * `lookupFailed` is set so callers can surface a warning instead of failing
 * the whole route calculation.
 */
export async function findTollsAlongRoute(
  coordinates: [number, number][]
): Promise<TollSummary> {
  const fullRoute = coordinates
    .filter(([lng, lat]) => Number.isFinite(lat) && Number.isFinite(lng))
    .map(([lng, lat]) => ({ lat, lng }));

  const points = samplePolyline(coordinates);
  if (points.length < 2) {
    return { plazas: [], total: 0, allPricesFromOsm: true };
  }

  const key = cacheKey(points);
  const cached = tollCache.get(key);
  if (cached) return cached;

  let data: OverpassResponse;
  try {
    data = await queryOverpass(buildOverpassQuery(points));
  } catch (error) {
    console.error("[Tolls] lookup failed:", error);
    // Don't cache failures — a later request may hit a healthy mirror.
    return { plazas: [], total: 0, allPricesFromOsm: true, lookupFailed: true };
  }

  const elements = data.elements ?? [];
  const routeProgress = cumulativeDistancesMeters(fullRoute);

  const booths: TollBooth[] = [];
  elements.forEach((element, index) => {
    const lat = element.lat ?? element.center?.lat;
    const lng = element.lon ?? element.center?.lon;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    const position = { lat: lat as number, lng: lng as number };
    const { distance, bearing, segmentIndex, t } = nearestSegment(
      position,
      fullRoute
    );

    // Drop booths that Overpass' wide corridor picked up from nearby roads.
    if (distance > MAX_ROUTE_DISTANCE_M) return;

    const tags = element.tags ?? {};

    // Plazas have one booth per direction; only the one facing our way charges.
    const boothDirection = Number(tags["direction"]);
    if (
      bearing !== null &&
      Number.isFinite(boothDirection) &&
      angleDifference(bearing, boothDirection) > MAX_DIRECTION_DIFF_DEG
    ) {
      return;
    }

    const parsed = parseChargeForCar(tags);
    const segmentLength = haversineMeters(
      fullRoute[segmentIndex]!,
      fullRoute[segmentIndex + 1]!
    );

    booths.push({
      name: boothName(tags, index),
      price: parsed ?? FALLBACK_TOLL_PRICE,
      priceFromOsm: parsed !== null,
      ...position,
      progressM: routeProgress[segmentIndex]! + t * segmentLength,
    });
  });

  // Travel order: first plaza after the origin appears first in the list.
  const plazas = clusterBooths(booths)
    .sort((a, b) => a.progressM - b.progressM)
    .map(({ progressM: _progressM, ...plaza }) => plaza);
  const total = plazas.reduce((sum, plaza) => sum + plaza.price, 0);

  const summary: TollSummary = {
    plazas,
    total: Math.round(total * 100) / 100,
    allPricesFromOsm: plazas.every((p) => p.priceFromOsm),
  };

  if (tollCache.size >= TOLL_CACHE_MAX_ENTRIES) {
    tollCache.delete(tollCache.keys().next().value!);
  }
  tollCache.set(key, summary);

  return summary;
}