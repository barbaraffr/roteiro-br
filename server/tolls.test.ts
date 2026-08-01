import { describe, expect, it } from "vitest";
import {
  angleDifference,
  bearingDegrees,
  distanceToPolylineMeters,
  haversineMeters,
  parseChargeForCar,
  samplePolyline,
} from "./_core/tolls";

describe("parseChargeForCar", () => {
  it("reads the motorcar fare from a multi-vehicle charge tag", () => {
    expect(
      parseChargeForCar({
        charge: "5.50BRL/motorcar;2.75BRL/motorcycle;5.50BRL/hgv/axle",
      })
    ).toBe(5.5);
  });

  it("accepts a single value with comma decimals", () => {
    expect(parseChargeForCar({ charge: "R$ 12,40" })).toBe(12.4);
  });

  it("falls back to toll:motorcar", () => {
    expect(parseChargeForCar({ "toll:motorcar": "8.10 BRL" })).toBe(8.1);
  });

  it("returns null when there is no usable price", () => {
    expect(parseChargeForCar({})).toBeNull();
    expect(parseChargeForCar({ charge: "yes" })).toBeNull();
  });
});

describe("geometry helpers", () => {
  it("measures distance between known points", () => {
    // Roughly 1 degree of latitude ~ 111 km
    const d = haversineMeters({ lat: 0, lng: 0 }, { lat: 1, lng: 0 });
    expect(d).toBeGreaterThan(110_000);
    expect(d).toBeLessThan(112_000);
  });

  it("finds a point's distance to a route", () => {
    const route = [
      { lat: -18.8, lng: -48.25 },
      { lat: -18.7, lng: -48.25 },
    ];
    const onRoute = distanceToPolylineMeters({ lat: -18.75, lng: -48.25 }, route);
    const offRoute = distanceToPolylineMeters({ lat: -18.75, lng: -48.2 }, route);

    expect(onRoute).toBeLessThan(10);
    expect(offRoute).toBeGreaterThan(4000);
  });

  it("computes bearings and their difference", () => {
    const north = bearingDegrees({ lat: 0, lng: 0 }, { lat: 1, lng: 0 });
    expect(north).toBeCloseTo(0, 1);

    // Opposite cabins of a plaza are ~180 degrees apart
    expect(angleDifference(48, 228)).toBeCloseTo(180, 5);
    expect(angleDifference(46.8, 48)).toBeCloseTo(1.2, 5);
  });
});

describe("samplePolyline", () => {
  it("keeps endpoints and thins dense points", () => {
    const coordinates: [number, number][] = Array.from({ length: 500 }, (_, i) => [
      -48.25,
      -18.9 + i * 0.0001,
    ]);

    const sampled = samplePolyline(coordinates, 400, 400);

    expect(sampled.length).toBeLessThan(coordinates.length);
    expect(sampled[0]).toEqual({ lat: -18.9, lng: -48.25 });
    expect(sampled[sampled.length - 1]).toEqual({
      lat: coordinates[coordinates.length - 1]![1],
      lng: -48.25,
    });
  });

  it("passes through very short routes untouched", () => {
    const coordinates: [number, number][] = [
      [-48.25, -18.9],
      [-48.24, -18.89],
    ];
    expect(samplePolyline(coordinates)).toHaveLength(2);
  });
});
