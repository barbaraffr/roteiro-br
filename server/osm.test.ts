import { describe, expect, it } from "vitest";
import {
  decodePlaceId,
  encodePlaceId,
  formatDuration,
} from "./_core/osm";

describe("osm helpers", () => {
  it("encodes and decodes placeId as lat,lng", () => {
    const placeId = encodePlaceId(-23.55052, -46.633308);
    expect(placeId).toBe("-23.550520,-46.633308");
    expect(decodePlaceId(placeId)).toEqual({
      lat: -23.55052,
      lng: -46.633308,
    });
  });

  it("rejects invalid placeId", () => {
    expect(() => decodePlaceId("abc")).toThrow(/inválido/);
  });

  it("formats duration in Portuguese short form", () => {
    expect(formatDuration(90)).toBe("2 min");
    expect(formatDuration(3600)).toBe("1 h");
    expect(formatDuration(5400)).toBe("1 h 30 min");
  });
});
