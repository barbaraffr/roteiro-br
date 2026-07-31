import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc";
import { makeRequest, type DirectionsResult, type TravelMode } from "./_core/map";
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
     * Autocomplete for Brazilian cities using Google Places Autocomplete API.
     */
    autocomplete: publicProcedure
      .input(z.object({ query: z.string().min(1) }))
      .query(async ({ input }) => {
        const result = await makeRequest<{
          predictions: Array<{
            description: string;
            place_id: string;
            structured_formatting: {
              main_text: string;
              secondary_text: string;
            };
          }>;
          status: string;
        }>("/maps/api/place/autocomplete/json", {
          input: input.query,
          components: "country:br",
          language: "pt-BR",
          types: "(cities)",
        });

        if (result.status !== "OK" && result.status !== "ZERO_RESULTS") {
          throw new Error(`Places Autocomplete failed: ${result.status}`);
        }

        return {
          predictions: (result.predictions || []).map((p) => ({
            placeId: p.place_id,
            description: p.description,
            mainText: p.structured_formatting?.main_text ?? p.description,
            secondaryText: p.structured_formatting?.secondary_text ?? "",
          })),
        };
      }),

    /**
     * Calculate route: distance, duration, fuel cost, and toll estimate.
     */
    calculate: publicProcedure
      .input(
        z.object({
          originPlaceId: z.string().min(1),
          destinationPlaceId: z.string().min(1),
          fuelConsumption: z.number().positive(), // km per liter
          fuelPrice: z.number().positive(), // R$ per liter
        })
      )
      .mutation(async ({ input }) => {
        const directions = await makeRequest<DirectionsResult>(
          "/maps/api/directions/json",
          {
            origin: `place_id:${input.originPlaceId}`,
            destination: `place_id:${input.destinationPlaceId}`,
            mode: "driving" as TravelMode,
            language: "pt-BR",
            region: "br",
            alternatives: false,
          }
        );

        if (directions.status !== "OK" || !directions.routes?.length) {
          throw new Error(
            directions.status === "ZERO_RESULTS"
              ? "Não foi encontrada nenhuma rota entre as cidades informadas."
              : `Google Directions falhou: ${directions.status}`
          );
        }

        const route = directions.routes[0];
        const leg = route.legs[0];

        const distanceKm = leg.distance.value / 1000;
        const durationSeconds = leg.duration.value;
        const durationText = leg.duration.text;

        // Fuel cost = (distance in km) / (km per liter) * (price per liter)
        const fuelCost = (distanceKm / input.fuelConsumption) * input.fuelPrice;

        // Toll cost estimate: Google Directions doesn't return toll data directly.
        // We estimate based on Brazilian highway toll patterns.
        // Average toll in Brazil: ~R$ 10.00 per toll plaza
        // Average distance between toll plazas: ~50 km on major highways
        // This is a rough estimate - actual tolls vary by route.
        const estimatedTollPlazas = Math.floor(distanceKm / 50);
        const avgTollPrice = 10.0;
        const tollCost = distanceKm > 30 ? estimatedTollPlazas * avgTollPrice : 0;

        const totalCost = fuelCost + tollCost;

        return {
          originAddress: leg.start_address,
          destinationAddress: leg.end_address,
          distanceKm: Math.round(distanceKm * 100) / 100,
          durationText,
          durationSeconds,
          fuelConsumption: input.fuelConsumption,
          fuelPrice: input.fuelPrice,
          fuelCost: Math.round(fuelCost * 100) / 100,
          tollCost: Math.round(tollCost * 100) / 100,
          totalCost: Math.round(totalCost * 100) / 100,
          estimatedTollPlazas,
          polyline: route.overview_polyline?.points ?? null,
          summary: route.summary ?? "",
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
