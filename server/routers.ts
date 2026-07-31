import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc";
import {
  decodePlaceId,
  formatDuration,
  getDrivingRoute,
  searchCities,
} from "./_core/osm";
import { saveTrip, getTripsByUserId, deleteTripById } from "./db";
import { z } from "zod";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

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
     * Calculate route: distance, duration, fuel cost, and toll estimate (OSRM).
     */
    calculate: publicProcedure
      .input(
        z.object({
          originPlaceId: z.string().min(1),
          destinationPlaceId: z.string().min(1),
          originName: z.string().optional(),
          destinationName: z.string().optional(),
          fuelConsumption: z.number().positive(), // km per liter
          fuelPrice: z.number().positive(), // R$ per liter
        })
      )
      .mutation(async ({ input }) => {
        const origin = decodePlaceId(input.originPlaceId);
        const destination = decodePlaceId(input.destinationPlaceId);

        const route = await getDrivingRoute(origin, destination, {
          originLabel: input.originName,
          destinationLabel: input.destinationName,
        });

        const distanceKm = route.distanceMeters / 1000;
        const durationSeconds = route.durationSeconds;
        const durationText = formatDuration(durationSeconds);

        const fuelCost = (distanceKm / input.fuelConsumption) * input.fuelPrice;

        // Rough BR highway toll estimate (~R$10 / plaza every ~50 km).
        const estimatedTollPlazas = Math.floor(distanceKm / 50);
        const avgTollPrice = 10.0;
        const tollCost = distanceKm > 30 ? estimatedTollPlazas * avgTollPrice : 0;

        const totalCost = fuelCost + tollCost;

        return {
          originAddress: route.originLabel,
          destinationAddress: route.destinationLabel,
          distanceKm: Math.round(distanceKm * 100) / 100,
          durationText,
          durationSeconds,
          fuelConsumption: input.fuelConsumption,
          fuelPrice: input.fuelPrice,
          fuelCost: Math.round(fuelCost * 100) / 100,
          tollCost: Math.round(tollCost * 100) / 100,
          totalCost: Math.round(totalCost * 100) / 100,
          estimatedTollPlazas,
          /** GeoJSON coordinates [lng,lat][] as JSON string */
          polyline: route.geometryJson,
          summary: "",
        };
      }),

    /**
     * Save a trip to the user's history (requires authentication).
     */
    save: protectedProcedure
      .input(
        z.object({
          originName: z.string(),
          originPlaceId: z.string(),
          destinationName: z.string(),
          destinationPlaceId: z.string(),
          distanceKm: z.number(),
          durationText: z.string(),
          durationSeconds: z.number(),
          fuelConsumption: z.number(),
          fuelPrice: z.number(),
          fuelCost: z.number(),
          tollCost: z.number(),
          totalCost: z.number(),
          polyline: z.string().nullable().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        await saveTrip({
          userId: ctx.user.id,
          originName: input.originName,
          originPlaceId: input.originPlaceId,
          destinationName: input.destinationName,
          destinationPlaceId: input.destinationPlaceId,
          distanceKm: input.distanceKm.toString(),
          durationText: input.durationText,
          durationSeconds: input.durationSeconds,
          fuelConsumption: input.fuelConsumption.toString(),
          fuelPrice: input.fuelPrice.toString(),
          fuelCost: input.fuelCost.toString(),
          tollCost: input.tollCost.toString(),
          totalCost: input.totalCost.toString(),
          polyline: input.polyline ?? null,
        });
        return { success: true };
      }),

    /**
     * List all trips for the authenticated user.
     */
    list: protectedProcedure.query(async ({ ctx }) => {
      const result = await getTripsByUserId(ctx.user.id);
      return result.map((t) => ({
        id: t.id,
        originName: t.originName,
        originPlaceId: t.originPlaceId,
        destinationName: t.destinationName,
        destinationPlaceId: t.destinationPlaceId,
        distanceKm: parseFloat(t.distanceKm),
        durationText: t.durationText,
        durationSeconds: t.durationSeconds,
        fuelConsumption: parseFloat(t.fuelConsumption),
        fuelPrice: parseFloat(t.fuelPrice),
        fuelCost: parseFloat(t.fuelCost),
        tollCost: parseFloat(t.tollCost),
        totalCost: parseFloat(t.totalCost),
        polyline: t.polyline,
        createdAt: t.createdAt,
      }));
    }),

    /**
     * Delete a trip from the user's history.
     */
    delete: protectedProcedure
      .input(z.object({ tripId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const deleted = await deleteTripById(ctx.user.id, input.tripId);
        if (!deleted) {
          throw new Error("Viagem não encontrada ou não pertence ao usuário.");
        }
        return { success: true };
      }),
  }),
});

export type AppRouter = typeof appRouter;
