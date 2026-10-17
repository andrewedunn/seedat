// ABOUTME: Tests for hundred-block identifiers used by 311 and police data, which must never carry a street number.
// ABOUTME: Covers city addresses, NOPD block addresses ("011XX Gravier St") and intersections.
import { describe, expect, it } from "vitest";
import { blockIdFor, blockIdForText } from "../../src/block";
import { parseAddress } from "../../src/normalize";

describe("blockIdFor", () => {
  it("rounds down to the hundred", () => {
    expect(blockIdFor(parseAddress("1123 Gravier St"))).toBe("1100 GRAVIER ST");
    expect(blockIdFor(parseAddress("3210 Gravier Street"))).toBe("3200 GRAVIER ST");
    expect(blockIdFor(parseAddress("99 Canal St"))).toBe("0 CANAL ST");
  });
  it("reads NOPD block addresses", () => {
    expect(blockIdForText("011XX Gravier St")).toBe("1100 GRAVIER ST");
    expect(blockIdForText("003XX Canal St")).toBe("300 CANAL ST");
    expect(blockIdForText("064XX Blk Pontchartrain Blvd")).toBe("6400 PONTCHARTRAIN BLVD");
    expect(blockIdForText("007XX S Dupre St")).toBe("700 S DUPRE ST");
  });
  it("returns null for intersections and junk", () => {
    expect(blockIdForText("Terpsichore St & Baronne St")).toBeNull();
    expect(blockIdForText("")).toBeNull();
    expect(blockIdForText(null)).toBeNull();
    expect(blockIdFor(null)).toBeNull();
    expect(blockIdForText("Gravier St")).toBeNull();
  });
});
