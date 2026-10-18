// ABOUTME: Tests for the plain-English property summary: built only from structured facts, never invented.
// ABOUTME: Each case checks a sentence appears (or doesn't) for a given combination of facts.
import { describe, expect, it } from "vitest";
import { summarizeProperty, type SummaryFacts } from "../src/summary";

const base: SummaryFacts = {
  address: "3300 Dauphine St", neighborhood: "BYWATER", zoning: "HMR-3", zoningPlain: "historic marigny/tremé/bywater residential",
  historicDistrict: "Bywater", hdlcControl: "Full", vcc: false, isLandmark: false,
  permitsTotal: 0, permitsOpen: 0, lastPermitType: null, lastPermitDate: null, demolitionDate: null,
  codeCasesOpen: 0, codeCasesTotal: 0, lastCodeCaseDate: null, strActiveType: null,
  block311: 0, blockPolice: 0, today: "2026-10-17",
};

describe("summarizeProperty", () => {
  it("opens with where it is and how it is zoned", () => {
    expect(summarizeProperty(base)).toMatch(/^3300 Dauphine St is in Bywater, zoned HMR-3 \(historic marigny\/tremé\/bywater residential\)\./);
  });

  it("does not double the period when the zoning description ends with one", () => {
    expect(summarizeProperty({ ...base, zoningPlain: "Single- and two-family homes." })).toContain("zoned HMR-3 (Single- and two-family homes).");
  });

  it("explains full HDLC control in one sentence", () => {
    expect(summarizeProperty(base)).toContain("Bywater historic district under full HDLC control, so most exterior changes need approval first.");
  });

  it("says partial control reviews demolition (HDLC guidelines p.01-5)", () => {
    expect(summarizeProperty({ ...base, historicDistrict: "Mid-City", hdlcControl: "Partial" })).toContain("partial HDLC control, where demolition needs HDLC review.");
  });

  it("names the Vieux Carré Commission for the French Quarter", () => {
    expect(summarizeProperty({ ...base, historicDistrict: "Vieux Carré", hdlcControl: "Full", vcc: true })).toContain("Vieux Carré Commission");
  });

  it("summarizes permit history with the most recent one", () => {
    const s = summarizeProperty({ ...base, permitsTotal: 7, permitsOpen: 2, lastPermitType: "Renovation", lastPermitDate: "2026-08-03" });
    expect(s).toContain("The city has 7 permits on record here; the most recent, a renovation permit, was filed in August 2026. 2 are still open.");
  });

  it("keeps acronyms and picks a/an by sound", () => {
    expect(summarizeProperty({ ...base, permitsTotal: 2, lastPermitType: "HDLC COA", lastPermitDate: "2024-05-01" })).toContain("the most recent, an HDLC COA permit,");
    expect(summarizeProperty({ ...base, permitsTotal: 2, lastPermitType: "Electrical Service / Circuit / Feeder", lastPermitDate: "2024-05-01" })).toContain("the most recent, an electrical service / circuit / feeder permit,");
    expect(summarizeProperty({ ...base, permitsTotal: 2, lastPermitType: "VCC General Work", lastPermitDate: "2024-05-01" })).toContain("the most recent, a VCC general work permit,");
    expect(summarizeProperty({ ...base, permitsTotal: 2, lastPermitType: "Plumbing Permit", lastPermitDate: "2024-05-01" })).toContain("the most recent, a plumbing permit,");
  });

  it("uses the singular for one of anything", () => {
    const s = summarizeProperty({ ...base, permitsTotal: 1, permitsOpen: 1, lastPermitType: "Plumbing", lastPermitDate: "2026-01-09", codeCasesOpen: 1, codeCasesTotal: 1 });
    expect(s).toContain("The city has 1 permit on record here");
    expect(s).toContain("1 is still open.");
    expect(s).toContain("There is 1 open code enforcement case.");
  });

  it("says plainly when there is no permit history", () => {
    expect(summarizeProperty(base)).toContain("The city has no permits on record for this address.");
  });

  it("mentions past code enforcement only when there is some", () => {
    expect(summarizeProperty(base)).not.toContain("code enforcement");
    expect(summarizeProperty({ ...base, codeCasesTotal: 3, lastCodeCaseDate: "2019-05-01" })).toContain("3 past code enforcement cases, the latest in May 2019, all closed.");
  });

  it("flags an active short-term rental license and a demolition permit", () => {
    const s = summarizeProperty({ ...base, strActiveType: "Residential", demolitionDate: "2025-11-20" });
    expect(s).toContain("It has an active short-term rental license (Residential).");
    expect(summarizeProperty({ ...base, strActiveType: "Lodging Exempt from STR Regulation" }))
      .toContain("It has an active short-term rental license (Lodging Exempt from STR Regulation).");
    expect(s).toContain("A demolition permit was filed in November 2025.");
  });

  it("closes with block-level activity, never the address itself", () => {
    expect(summarizeProperty({ ...base, block311: 14, blockPolice: 52 })).toContain("On this block in the past year: 14 requests to 311 and 52 calls to police.");
  });
});
