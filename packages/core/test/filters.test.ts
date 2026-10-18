// ABOUTME: Tests for the MCP/API filter builders: neighborhood name matching and the SQL they generate.
// ABOUTME: SQL is checked structurally (clauses and bound values), and every value must be bound, never inlined.
import { describe, expect, it } from "vitest";
import { findPropertiesQuery, matchNeighborhood, searchPermitsQuery } from "../src/filters";

const HOODS = ["BYWATER", "SEVENTH WARD", "ST.  ANTHONY", "TREME - LAFITTE", "LOWER NINTH WARD", "MID-CITY", "McDONOGH"];

describe("matchNeighborhood", () => {
  it.each([
    ["Bywater", "BYWATER"], ["the seventh ward", "SEVENTH WARD"], ["7th Ward", "SEVENTH WARD"], ["st anthony", "ST.  ANTHONY"],
    ["Treme", "TREME - LAFITTE"], ["Tremé", "TREME - LAFITTE"], ["lower 9th ward", "LOWER NINTH WARD"], ["Mid City", "MID-CITY"], ["mcdonogh", "McDONOGH"],
  ])("%s -> %s", (input, out) => expect(matchNeighborhood(input, HOODS)).toBe(out));
  it("returns null when nothing matches", () => expect(matchNeighborhood("Metairie", HOODS)).toBeNull());
});

describe("searchPermitsQuery", () => {
  it("binds every filter and joins parcels only when needed", () => {
    const q = searchPermitsQuery({ neighborhood: "BYWATER", type: "DEMO", minCost: 100000, since: "2026-06-01", limit: 50 });
    expect(q.sql).toContain("pa.neighborhood = ?");
    expect(q.sql).toContain("p.permit_type = ?");
    expect(q.sql).toContain("p.est_cost >= ?");
    expect(q.sql).toContain("coalesce(p.applied_date, p.issued_date) >= ?");
    expect(q.params).toEqual(["BYWATER", "DEMO", 100000, "2026-06-01", 51]);
    expect(q.sql).not.toMatch(/'BYWATER'|100000|2026-06-01/);
  });

  it("uses full-text search for description keywords", () => {
    const q = searchPermitsQuery({ text: "solar panels", limit: 10 });
    expect(q.sql).toContain("permit_fts MATCH ?");
    expect(q.params[0]).toBe('"solar" "panels"');
  });

  it("caps the limit at 500", () => {
    expect(searchPermitsQuery({ limit: 10000 }).params.at(-1)).toBe(501);
  });
});

describe("findPropertiesQuery", () => {
  it("expresses 'open code cases and no permit activity in two years'", () => {
    const q = findPropertiesQuery({ neighborhood: "SEVENTH WARD", openCodeCase: true, noPermitSince: "2024-10-17", limit: 100 });
    expect(q.sql).toContain("s.code_cases_open > 0");
    expect(q.sql).toContain("(s.last_permit_date IS NULL OR s.last_permit_date < ?)");
    expect(q.params).toEqual(["SEVENTH WARD", "2024-10-17", 101]);
  });

  it("filters by ward, historic control and active rentals", () => {
    const q = findPropertiesQuery({ ward: "7", hdlcControl: "Full", strActive: true, limit: 5 });
    expect(q.sql).toContain("pa.ward = ?");
    expect(q.sql).toContain("pa.hdlc_control = ?");
    expect(q.sql).toContain("s.str_active = 1");
    expect(q.params).toEqual(["7", "Full", 6]);
  });
});
