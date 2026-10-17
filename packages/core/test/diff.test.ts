// ABOUTME: Tests for snapshot diffing: classifying rows as new/changed/unchanged/removed and field-level changes.
// ABOUTME: This is how See Dat records history the city does not publish (change_log).
import { describe, expect, it } from "vitest";
import { diffKeys, fieldChanges } from "../src/diff";

describe("diffKeys", () => {
  it("classifies rows against the previous snapshot's hashes", () => {
    const prev = new Map([["a", "h1"], ["b", "h2"], ["c", "h3"]]);
    const next = [{ key: "a", hash: "h1" }, { key: "b", hash: "CHANGED" }, { key: "d", hash: "h4" }];
    expect(diffKeys(prev, next)).toEqual({ inserted: ["d"], updated: ["b"], unchanged: 1, removed: ["c"] });
  });

  it("treats a duplicate key within one snapshot as one row (last wins)", () => {
    const next = [{ key: "a", hash: "h1" }, { key: "a", hash: "h9" }];
    expect(diffKeys(new Map([["a", "h1"]]), next)).toEqual({ inserted: [], updated: ["a"], unchanged: 0, removed: [] });
  });
});

describe("fieldChanges", () => {
  it("lists changed fields, ignoring bookkeeping columns", () => {
    const before = { permit_num: "26-1", status: "Plan Review", fees_total: 100, last_seen_at: "x", row_hash: "a" };
    const after = { permit_num: "26-1", status: "Issued", fees_total: 100, last_seen_at: "y", row_hash: "b" };
    expect(fieldChanges(before, after)).toEqual([{ field: "status", old: "Plan Review", new: "Issued" }]);
  });

  it("only compares the columns the new row has (stored rows carry columns other writers own)", () => {
    expect(fieldChanges({ status: "Issued", onestop_id: 1122300 }, { status: "Issued" })).toEqual([]);
  });

  it("treats null, undefined and empty string as the same", () => {
    expect(fieldChanges({ a: null, b: "" }, { a: undefined, b: null })).toEqual([]);
  });

  it("compares numbers and numeric strings by value", () => {
    expect(fieldChanges({ est_cost: 1500 }, { est_cost: "1500" })).toEqual([]);
    expect(fieldChanges({ est_cost: 1500 }, { est_cost: "1600" })).toEqual([{ field: "est_cost", old: "1500", new: "1600" }]);
  });
});
