// ABOUTME: Tests for learning street aliases from address points and parcels that share a GEOPIN.
// ABOUTME: Covers vote thresholds and the majority rule that filters corner-lot noise.
import { describe, expect, it } from "vitest";
import { learnStreetAliases } from "../src/aliases";

const pair = (geopin: number, addrStreet: string, situsStreet: string, n = 100) => ({
  geopin, addressStreet: addrStreet, situs: `${n} ${situsStreet}`,
});

describe("learnStreetAliases", () => {
  it("learns an alias when enough parcels agree", () => {
    const rows = Array.from({ length: 5 }, (_, i) => pair(i, "Interstate 10 Service Road North", "I 10 W SERVICE RD"));
    expect(learnStreetAliases(rows, { minVotes: 3, minShare: 0.8 })).toEqual([
      { alias: "I 10 W SERVICE RD", street: "INTERSTATE 10 SERVICE RD N", origin: "parcel-situs", votes: 5 },
    ]);
  });

  it("ignores pairs that already normalize to the same street", () => {
    const rows = Array.from({ length: 5 }, (_, i) => pair(i, "Second Street", "2ND ST"));
    expect(learnStreetAliases(rows, { minVotes: 3, minShare: 0.8 })).toEqual([]);
  });

  it("drops aliases below the vote threshold", () => {
    const rows = [pair(1, "Fats Domino Avenue", "CAFFIN AVE"), pair(2, "Fats Domino Avenue", "CAFFIN AVE")];
    expect(learnStreetAliases(rows, { minVotes: 3, minShare: 0.8 })).toEqual([]);
  });

  it("drops a variant that maps to several streets (corner lots)", () => {
    const rows = [
      ...Array.from({ length: 6 }, (_, i) => pair(i, "Lake Kenilworth Drive", "MARTIN DR")),
      ...Array.from({ length: 6 }, (_, i) => pair(100 + i, "Martin Drive", "MARTIN DR")),
    ];
    expect(learnStreetAliases(rows, { minVotes: 3, minShare: 0.8 })).toEqual([]);
  });

  it("never aliases a variant that is itself a canonical street", () => {
    const rows = [
      ...Array.from({ length: 6 }, (_, i) => pair(i, "Elysian Fields Avenue", "GENTILLY BLVD")),
      pair(50, "Gentilly Boulevard", "GENTILLY BLVD"),
    ];
    expect(learnStreetAliases(rows, { minVotes: 3, minShare: 0.8 })).toEqual([]);
  });
});
