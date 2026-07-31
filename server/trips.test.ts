import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };

  return { ctx };
}

function createUnauthContext(): { ctx: TrpcContext } {
  const ctx: TrpcContext = {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };

  return { ctx };
}

describe("trips router", () => {
  describe("trips.save (protected)", () => {
    it("rejects unauthenticated users", async () => {
      const { ctx } = createUnauthContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.trips.save({
          originName: "São Paulo, SP",
          originPlaceId: "place_id_1",
          destinationName: "Rio de Janeiro, RJ",
          destinationPlaceId: "place_id_2",
          distanceKm: 430,
          durationText: "4 horas 30 min",
          durationSeconds: 16200,
          fuelConsumption: 10,
          fuelPrice: 5.89,
          fuelCost: 253.27,
          tollCost: 80,
          totalCost: 333.27,
          polyline: "encoded_polyline",
        })
      ).rejects.toThrow();
    });

    it("accepts authenticated users", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      // Mock the saveTrip function
      vi.doMock("./db", () => ({
        saveTrip: vi.fn().mockResolvedValue(undefined),
        getTripsByUserId: vi.fn().mockResolvedValue([]),
        deleteTripById: vi.fn().mockResolvedValue(true),
      }));

      // The save procedure should call saveTrip and return success
      // Since we can't easily mock the db module in this setup,
      // we just verify the procedure doesn't throw on auth
      await expect(
        caller.trips.save({
          originName: "São Paulo, SP",
          originPlaceId: "place_id_1",
          destinationName: "Rio de Janeiro, RJ",
          destinationPlaceId: "place_id_2",
          distanceKm: 430,
          durationText: "4 horas 30 min",
          durationSeconds: 16200,
          fuelConsumption: 10,
          fuelPrice: 5.89,
          fuelCost: 253.27,
          tollCost: 80,
          totalCost: 333.27,
          polyline: "encoded_polyline",
        })
      ).resolves.toEqual({ success: true });
    });
  });

  describe("trips.list (protected)", () => {
    it("rejects unauthenticated users", async () => {
      const { ctx } = createUnauthContext();
      const caller = appRouter.createCaller(ctx);

      await expect(caller.trips.list()).rejects.toThrow();
    });
  });

  describe("trips.delete (protected)", () => {
    it("rejects unauthenticated users", async () => {
      const { ctx } = createUnauthContext();
      const caller = appRouter.createCaller(ctx);

      await expect(caller.trips.delete({ tripId: 1 })).rejects.toThrow();
    });
  });

  describe("trips.autocomplete (public)", () => {
    it("accepts unauthenticated users without auth error", async () => {
      const { ctx } = createUnauthContext();
      const caller = appRouter.createCaller(ctx);

      // This may fail on network/API, but it should NOT fail with UNAUTHORIZED
      try {
        await caller.trips.autocomplete({ query: "São Paulo" });
      } catch (e: any) {
        // Should NOT be UNAUTHORIZED
        expect(e?.data?.code).not.toBe("UNAUTHORIZED");
      }
    });
  });
});
