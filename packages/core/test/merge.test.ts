// ABOUTME: Tests for merging rows from several sources that feed one table (e.g. three permit datasets).
// ABOUTME: Lower priority numbers win a column; later sources only fill columns the earlier ones left null.
import { describe, expect, it } from "vitest";
import { mergeRows } from "../src/merge";

describe("mergeRows", () => {
  it("lets the highest-priority source win and later ones fill gaps", () => {
    const merged = mergeRows([
      { sourceId: "rcm3", priority: 2, row: { permit_num: "26-1", status: "Issued (rcm3)", lat: 29.9, owner_name: "A" } },
      { sourceId: "blds", priority: 1, row: { permit_num: "26-1", status: "Issued", lat: null, permit_type: "RNVS" } },
    ]);
    expect(merged.row).toEqual({ permit_num: "26-1", status: "Issued", lat: 29.9, owner_name: "A", permit_type: "RNVS" });
    expect(merged.sources).toEqual(["blds", "rcm3"]);
  });

  it("lets a source's `wins` columns beat higher-priority sources, but only where it has a value", () => {
    const merged = mergeRows([
      { sourceId: "live", priority: 1, row: { id: "1", created_date: "2019-01-02", closed_date: "2014-02-24", status: "Closed" } },
      { sourceId: "archive", priority: 2, wins: ["created_date", "closed_date"], row: { id: "1", created_date: "2014-02-20T10:00:00", closed_date: null, status: "Open" } },
    ]);
    expect(merged.row).toEqual({ id: "1", created_date: "2014-02-20T10:00:00", closed_date: "2014-02-24", status: "Closed" });
    expect(merged.sources).toEqual(["live", "archive"]);
  });

  it("treats undefined like null", () => {
    expect(mergeRows([
      { sourceId: "a", priority: 1, row: { x: undefined } },
      { sourceId: "b", priority: 2, row: { x: 5 } },
    ]).row).toEqual({ x: 5 });
  });
});
