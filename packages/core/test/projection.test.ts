// ABOUTME: Tests state-plane to WGS84 conversion against a known city address point.
// ABOUTME: Uses a real code case (345 10th St, xpos/ypos) and the centroid of its parcel, GEOPIN 41025540.
import { describe, expect, it } from "vitest";
import { metersBetween } from "../src/geo";
import { statePlaneToLatLon } from "../src/projection";

describe("statePlaneToLatLon", () => {
  it("rejects the city's not-geocoded placeholders", () => {
    expect(statePlaneToLatLon(-1, -1)).toBeNull();
    expect(statePlaneToLatLon(0, 0)).toBeNull();
    expect(statePlaneToLatLon(null, "5")).toBeNull();
  });

  it("lands a real code case on its own parcel", () => {
    const p = statePlaneToLatLon(3664764.5, 547610.09)!;
    expect(metersBetween(p.lat, p.lon, 30.0003729, -90.1203150)).toBeLessThan(30);
  });
});
