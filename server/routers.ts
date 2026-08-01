import { publicProcedure, router } from "./_core/trpc";
import {
  decodePlaceId,
  formatDuration,
  getDrivingRoute,
  searchCities,
  type LatLng,
} from "./_core/osm";
import { findTollsAlongRoute, type TollSummary } from "./_core/tolls";
import { z } from "zod";

type LegResult = {
  originAddress: string;
  destinationAddress: string;
  distanceKm: number;
  durationText: string;
  durationSeconds: number;
  fuelCost: number;
  tollCost: number;
  totalCost: number;
  estimatedTollPlazas: number;
  tollPlazas: Array<{
    name: string;
    price: number;
    priceFromOsm: boolean;
    direction: "ida" | "volta";
  }>;
  tollPricesFromOsm: boolean;
  tollLookupFailed: boolean;
  polyline: string;
};

async function calculateLeg(params: {
  origin: LatLng;
  destination: LatLng;
  originLabel?: string;
  destinationLabel?: string;
  fuelConsumption: number;
  fuelPrice: number;
  direction: "ida" | "volta";
}): Promise<LegResult> {
  const route = await getDrivingRoute(params.origin, params.destination, {
    originLabel: params.originLabel,
    destinationLabel: params.destinationLabel,
  });

  const distanceKm = route.distanceMeters / 1000;
  const durationSeconds = route.durationSeconds;
  const fuelCost = (distanceKm / params.fuelConsumption) * params.fuelPrice;

  let tolls: TollSummary = { plazas: [], total: 0, allPricesFromOsm: true };
  let tollLookupFailed = false;
  try {
    tolls = await findTollsAlongRoute(
      JSON.parse(route.geometryJson) as [number, number][]
    );
  } catch (error) {
    tollLookupFailed = true;
    console.warn("[Tolls] lookup failed:", error);
  }

  const tollCost = tolls.total;

  return {
    originAddress: route.originLabel,
    destinationAddress: route.destinationLabel,
    distanceKm: Math.round(distanceKm * 100) / 100,
    durationText: formatDuration(durationSeconds),
    durationSeconds,
    fuelCost: Math.round(fuelCost * 100) / 100,
    tollCost: Math.round(tollCost * 100) / 100,
    totalCost: Math.round((fuelCost + tollCost) * 100) / 100,
    estimatedTollPlazas: tolls.plazas.length,
    tollPlazas: tolls.plazas.map((p) => ({
      name: p.name,
      price: p.price,
      priceFromOsm: p.priceFromOsm,
      direction: params.direction,
    })),
    tollPricesFromOsm: tolls.allPricesFromOsm,
    tollLookupFailed,
    polyline: route.geometryJson,
  };
}

export const appRouter = router({
  trips: router({
    /**
     * Autocomplete for Brazilian cities via Photon (OpenStreetMap).
     */
    autocomplete: publicProcedure
      .input(z.object({ query: z.string().min(1) }))
      .query(async ({ input }) => {
        const predictions = await searchCities(input.query);
        return {
          predictions: predictions.map((p) => ({
            placeId: p.placeId,
            description: p.description,
            mainText: p.mainText,
            secondaryText: p.secondaryText,
          })),
        };
      }),

    /**
     * Calculate route (one-way or round-trip): distance, duration, fuel, tolls.
     */
    calculate: publicProcedure
      .input(
        z.object({
          originPlaceId: z.string().min(1),
          destinationPlaceId: z.string().min(1),
          originName: z.string().optional(),
          destinationName: z.string().optional(),
          fuelConsumption: z.number().positive(),
          fuelPrice: z.number().positive(),
          /** When true, also calculates the return leg and sums both. */
          roundTrip: z.boolean().optional().default(false),
        })
      )
      .mutation(async ({ input }) => {
        const origin = decodePlaceId(input.originPlaceId);
        const destination = decodePlaceId(input.destinationPlaceId);

        const outbound = await calculateLeg({
          origin,
          destination,
          originLabel: input.originName,
          destinationLabel: input.destinationName,
          fuelConsumption: input.fuelConsumption,
          fuelPrice: input.fuelPrice,
          direction: "ida",
        });

        let returnLeg: LegResult | null = null;
        if (input.roundTrip) {
          returnLeg = await calculateLeg({
            origin: destination,
            destination: origin,
            originLabel: input.destinationName,
            destinationLabel: input.originName,
            fuelConsumption: input.fuelConsumption,
            fuelPrice: input.fuelPrice,
            direction: "volta",
          });
        }

        const legs = returnLeg ? [outbound, returnLeg] : [outbound];
        const distanceKm =
          Math.round(legs.reduce((s, l) => s + l.distanceKm, 0) * 100) / 100;
        const durationSeconds = legs.reduce((s, l) => s + l.durationSeconds, 0);
        const fuelCost =
          Math.round(legs.reduce((s, l) => s + l.fuelCost, 0) * 100) / 100;
        const tollCost =
          Math.round(legs.reduce((s, l) => s + l.tollCost, 0) * 100) / 100;
        const tollPlazas = legs.flatMap((l) => l.tollPlazas);

        return {
          roundTrip: Boolean(input.roundTrip),
          originAddress: outbound.originAddress,
          destinationAddress: outbound.destinationAddress,
          distanceKm,
          durationText: formatDuration(durationSeconds),
          durationSeconds,
          fuelConsumption: input.fuelConsumption,
          fuelPrice: input.fuelPrice,
          fuelCost,
          tollCost,
          totalCost: Math.round((fuelCost + tollCost) * 100) / 100,
          estimatedTollPlazas: tollPlazas.length,
          tollPlazas,
          tollPricesFromOsm: legs.every((l) => l.tollPricesFromOsm),
          tollLookupFailed: legs.some((l) => l.tollLookupFailed),
          polyline: outbound.polyline,
          returnPolyline: returnLeg?.polyline ?? null,
          outbound,
          return: returnLeg,
        };
      }),
  }),
});

export type AppRouter = typeof appRouter;
