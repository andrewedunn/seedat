// ABOUTME: Tests for learning the tax-bill -> GEOPIN crosswalk from permits placed by address.
// ABOUTME: Conflicting placements (condos, splits) must be dropped rather than guessed.
import { describe, expect, it } from "vitest";
import { learnTaxBills } from "../src/learn";
import { MemoryIndex } from "../src/memory-index";

const index = new MemoryIndex({
  addresses: [
    { addressId: 1, geopin: 41000001, fullAddress: "100 Royal Street", unitType: null, unitId: null, lat: null, lon: null },
    { addressId: 2, geopin: 41000002, fullAddress: "102 Royal Street", unitType: null, unitId: null, lat: null, lon: null },
  ],
  parcels: [{ geopin: 41000001, situs: "100 ROYAL ST" }, { geopin: 41000002, situs: "102 ROYAL ST" }],
});

describe("learnTaxBills", () => {
  it("links a tax bill to the parcel its permits land on", () => {
    const { links } = learnTaxBills(index, [
      { address: "100 Royal St", taxBill: "206101821" },
      { address: "100 Royal St Apt 2", taxBill: "206101821" },
    ]);
    expect(links).toEqual([{ taxBill: "206101821", geopin: 41000001, evidence: 2 }]);
  });

  it("drops a tax bill whose permits disagree", () => {
    const r = learnTaxBills(index, [
      { address: "100 Royal St", taxBill: "X1" },
      { address: "102 Royal St", taxBill: "X1" },
    ]);
    expect(r.links).toEqual([]);
    expect(r.conflicting).toBe(1);
  });

  it("ignores permits with several tax bills, and 8-digit pins that are really GEOPINs", () => {
    expect(learnTaxBills(index, [
      { address: "100 Royal St", taxBill: "A1, A2" },
      { address: "100 Royal St", taxBill: "41000001" },
    ]).links).toEqual([]);
  });
});
