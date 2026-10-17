// ABOUTME: Tests for the match ladder: each rung, ambiguity fall-through, and the match_type it reports.
// ABOUTME: Uses a small in-memory index built from fixture address points and parcels.
import { describe, expect, it } from "vitest";
import { MemoryIndex } from "../src/memory-index";
import { matchRecord } from "../src/match";

const index = new MemoryIndex({
  addresses: [
    { addressId: 1, geopin: 41036019, fullAddress: "3210 Gravier Street", unitType: null, unitId: null, lat: 29.96308, lon: -90.09739 },
    { addressId: 2, geopin: 41036020, fullAddress: "3212 Gravier Street", unitType: null, unitId: null, lat: 29.96310, lon: -90.09760 },
    { addressId: 3, geopin: 41200001, fullAddress: "2115 Saint Thomas Street", unitType: "Apartment", unitId: "409", lat: 29.92, lon: -90.07 },
    { addressId: 4, geopin: 41200001, fullAddress: "2115 Saint Thomas Street", unitType: null, unitId: null, lat: 29.92, lon: -90.07 },
    { addressId: 5, geopin: 41300001, fullAddress: "1724 North Villeré Street", unitType: null, unitId: null, lat: 29.97, lon: -90.06 },
    { addressId: 6, geopin: 41300002, fullAddress: "4100 Hollygrove Street", unitType: null, unitId: null, lat: 29.97, lon: -90.12 },
    { addressId: 7, geopin: 41300002, fullAddress: "4102 Hollygrove Street", unitType: null, unitId: null, lat: 29.97, lon: -90.12 },
    { addressId: 8, geopin: 41400001, fullAddress: "500 Allen Toussaint Boulevard", unitType: null, unitId: null, lat: 30.0, lon: -90.08 },
    { addressId: 9, geopin: 41500001, fullAddress: "2000 Tchoupitoulas Street", unitType: null, unitId: null, lat: 29.92, lon: -90.08 },
  ],
  parcels: [
    { geopin: 41036019, situs: "3210 GRAVIER ST" }, { geopin: 41036020, situs: "3212 GRAVIER ST" },
    { geopin: 41200001, situs: "2115 ST THOMAS ST" }, { geopin: 41300001, situs: "1724 N VILLERE ST" },
    { geopin: 41300002, situs: "4100 HOLLYGROVE ST" }, { geopin: 41400001, situs: "500 ALLEN TOUSSAINT BLVD" },
    { geopin: 41500001, situs: "2000 TCHOUPITOULAS ST" },
    { geopin: 41600001, situs: "832 ROYAL ST" },                       // parcel exists, no address point
    { geopin: 41700001, situs: "100 SECOND ST" },
  ],
  aliases: [{ alias: "ROBERT E LEE BLVD", street: "ALLEN TOUSSAINT BLVD", origin: "rename" }],
  taxBills: [{ taxBill: "39W401319", geopin: 41036020 }],
});

describe("MemoryIndex from pre-normalized rows (as prefetched from D1)", () => {
  const prefetched = new MemoryIndex({
    addresses: [{ addressId: 1, geopin: 41036019, fullAddress: "", streetKey: "GRAVIER ST", number: 3210, unitType: null, unitId: null, lat: 29.96308, lon: -90.09739 }],
    parcels: [],
    knownParcels: [41036019, 41600001],
    situs: [{ streetKey: "ROYAL ST", number: 832, geopin: 41600001 }],
    streets: ["GRAVIER ST", "ROYAL ST", "TCHOUPITOULAS ST"],
  });
  it("matches exactly, by situs, and knows the full street dictionary", () => {
    expect(matchRecord({ address: "3210 Gravier St" }, prefetched)).toMatchObject({ geopin: 41036019, matchType: "exact" });
    expect(matchRecord({ address: "832 Royal St" }, prefetched)).toMatchObject({ geopin: 41600001, matchType: "parcel_situs" });
    expect(matchRecord({ address: "1 Tchoupitoulas St" }, prefetched)).toMatchObject({ matchType: "unmatched", reason: "number_not_found" });
    expect(matchRecord({ address: "", geopin: "41600001" }, prefetched)).toMatchObject({ matchType: "source_geopin" });
  });
});

describe("matchRecord", () => {
  it("rung 0: trusts a GEOPIN the source already carries, if it exists", () => {
    expect(matchRecord({ address: "anything", geopin: "41036019" }, index)).toMatchObject({ geopin: 41036019, matchType: "source_geopin", score: 1 });
    expect(matchRecord({ address: "3210 Gravier St", geopin: "99999999" }, index)).toMatchObject({ geopin: 41036019, matchType: "exact" });
  });

  it("rung 0: an 8-digit permit pin that is a real GEOPIN counts as source_geopin", () => {
    expect(matchRecord({ address: "", taxBill: "41036019" }, index)).toMatchObject({ geopin: 41036019, matchType: "source_geopin" });
  });

  it("rung 1: exact address", () => {
    expect(matchRecord({ address: "3210 Gravier St" }, index)).toMatchObject({ geopin: 41036019, addressId: 1, matchType: "exact", score: 1 });
  });

  it("rung 1: exact address with unit", () => {
    expect(matchRecord({ address: "2115 Saint Thomas St Apt 409" }, index)).toMatchObject({ geopin: 41200001, addressId: 3, matchType: "exact" });
  });

  it("rung 2: unknown unit falls back to the building", () => {
    expect(matchRecord({ address: "2115 St Thomas St Unit 12" }, index)).toMatchObject({ geopin: 41200001, addressId: 4, matchType: "base_address" });
  });

  it("accent folding is part of normalization, so it is still exact", () => {
    expect(matchRecord({ address: "1724 N Villere St" }, index)).toMatchObject({ geopin: 41300001, matchType: "exact" });
  });

  it("rung 3: every number in a range agrees on one parcel", () => {
    expect(matchRecord({ address: "4100-4102 Hollygrove St" }, index)).toMatchObject({ geopin: 41300002, matchType: "range_member" });
  });

  it("rung 3: a range across parcels picks the first and lists the others", () => {
    const m = matchRecord({ address: "3210-3212 Gravier St" }, index);
    expect(m).toMatchObject({ geopin: 41036019, matchType: "range_member" });
    expect(m.otherGeopins).toEqual([41036020]);
  });

  it("rung 4: renamed street via alias", () => {
    expect(matchRecord({ address: "500 Robert E Lee Blvd" }, index)).toMatchObject({ geopin: 41400001, matchType: "alias" });
  });

  it("rung 4: a street written without its type resolves when the name is unique", () => {
    expect(matchRecord({ address: "3210 Gravier" }, index)).toMatchObject({ geopin: 41036019, matchType: "alias" });
  });

  it("rung 5: parcel situs when no address point has the number", () => {
    expect(matchRecord({ address: "832 Royal St" }, index)).toMatchObject({ geopin: 41600001, matchType: "parcel_situs" });
    expect(matchRecord({ address: "100 2nd St" }, index)).toMatchObject({ geopin: 41700001, matchType: "parcel_situs" });
  });

  it("rung 6: a one-letter typo in the street name", () => {
    const m = matchRecord({ address: "2000 Tchoupitulas St" }, index);
    expect(m).toMatchObject({ geopin: 41500001, matchType: "fuzzy_street" });
    expect(m.score).toBeLessThan(1);
  });

  it("rung 7: learned tax-bill crosswalk", () => {
    expect(matchRecord({ address: "Lot 4 Sq 210", taxBill: "39W401319" }, index)).toMatchObject({ geopin: 41036020, matchType: "tax_bill" });
  });

  it("rung 8: nearest address point within 30 m when the text fails", () => {
    expect(matchRecord({ address: "Gravier near Broad", lat: 29.96309, lon: -90.09741 }, index)).toMatchObject({ geopin: 41036019, matchType: "nearest_point" });
  });

  it("rung 8: no point within 30 m is unmatched", () => {
    expect(matchRecord({ address: "Gravier near Broad", lat: 29.97, lon: -90.0974 }, index)).toMatchObject({ geopin: null, matchType: "unmatched" });
  });

  it("nearest_point does not override a contradicting street name", () => {
    expect(matchRecord({ address: "9999 Gravier St", lat: 29.9631, lon: -90.0976 }, index)).toMatchObject({ geopin: 41036020, matchType: "nearest_point" });
    expect(matchRecord({ address: "9999 Magazine St", lat: 29.9631, lon: -90.0976 }, index)).toMatchObject({ geopin: null, matchType: "unmatched" });
  });

  it("reports why a record is unmatched", () => {
    expect(matchRecord({ address: "Clouet St and Marais St" }, index)).toMatchObject({ geopin: null, matchType: "unmatched", reason: "unparseable" });
    expect(matchRecord({ address: "77 Nowhere St" }, index)).toMatchObject({ geopin: null, matchType: "unmatched", reason: "unknown_street" });
    expect(matchRecord({ address: "9999 Gravier St" }, index)).toMatchObject({ geopin: null, matchType: "unmatched", reason: "number_not_found" });
  });
});
