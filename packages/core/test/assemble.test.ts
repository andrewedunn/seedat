// ABOUTME: Tests that a permit seen in several sources assembles into one row with match columns and derived fields.
// ABOUTME: Uses a one-address in-memory index.
import { describe, expect, it } from "vitest";
import { assemble, mergeMatchInputs } from "../src/assemble";
import { MemoryIndex } from "../src/memory-index";

const index = new MemoryIndex({
  addresses: [{ addressId: 7, geopin: 41036019, fullAddress: "3210 Gravier Street", unitType: null, unitId: null, lat: 29.96308, lon: -90.09739 }],
  parcels: [{ geopin: 41036019, situs: "3210 GRAVIER ST" }],
});

describe("assemble", () => {
  it("merges sources, matches, and derives days_to_issue", () => {
    const { row } = assemble("permit", [
      { sourceId: "socrata:72f9-bi28", priority: 1, row: { permit_num: "26-1", applied_date: "2026-01-01", issued_date: "2026-01-31" }, match: { address: "Bad address", taxBill: null } },
      { sourceId: "socrata:rcm3-fn58", priority: 2, row: { permit_num: "26-1", lat: 29.96308 }, match: { address: "3210 Gravier St", lat: 29.96308, lon: -90.09739 } },
    ], index);
    expect(row).toMatchObject({
      permit_num: "26-1", geopin: 41036019, match_type: "nearest_point", days_to_issue: 30,
      sources: '["socrata:72f9-bi28","socrata:rcm3-fn58"]',
    });
    expect(typeof row.row_hash).toBe("string");
  });

  it("marks an STR licence inactive unless the active list says otherwise", () => {
    const { row } = assemble("str_license", [{ sourceId: "socrata:en36-xvxg", priority: 1, row: { str_id: "Q1" } }], null);
    expect(row.is_active).toBe(0);
  });

  it("leaves match columns off unmatched tables", () => {
    const { row } = assemble("service_request", [{ sourceId: "s", priority: 1, row: { request_id: "1" } }], null);
    expect(row).not.toHaveProperty("geopin");
  });
});

describe("mergeMatchInputs", () => {
  it("takes the first non-empty value of each field by priority", () => {
    expect(mergeMatchInputs([
      { sourceId: "b", priority: 2, row: {}, match: { address: "B", lat: 1, lon: 2 } },
      { sourceId: "a", priority: 1, row: {}, match: { address: "A", lat: null } },
    ])).toEqual({ address: "A", lat: 1, lon: 2 });
  });
});
