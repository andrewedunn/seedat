// ABOUTME: Tests for the One Stop permit detail-page parser and the permit_event rows derived from it.
// ABOUTME: Uses real pages (contacts scrubbed) for an empty template, a not-yet-issued permit, and issued permits.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { detailToEvents, parseOneStopDetail } from "../src/onestop";

const fixture = (name: string) => readFileSync(join(import.meta.dirname, "fixtures", "onestop", name), "utf8");

describe("parseOneStopDetail", () => {
  it("treats the blank template as empty", () => {
    const d = parseOneStopDetail(fixture("empty.html"), 292633);
    expect(d.isEmpty).toBe(true);
    expect(d).toMatchObject({ onestopId: 292633, referenceCode: null, permitNum: null, type: null, location: null, description: null });
    expect(d.statuses).toEqual([]);
    expect(d.fees).toEqual([]);
    expect(d.details).toEqual({});
    expect(detailToEvents(d)).toEqual([]);
  });

  it("treats a throttling message as empty", () => {
    expect(parseOneStopDetail("Too many requests in a short time. Please slow down.", 7).isEmpty).toBe(true);
  });

  it("parses a legacy import page that has no reference code", () => {
    const d = parseOneStopDetail(fixture("legacy-import.html"), 292633);
    expect(d.isEmpty).toBe(false);
    expect(d.referenceCode).toBeNull();
    expect(d.permitNum).toBe("09MCH-00363");
    expect(d.statuses[0]).toEqual({ name: "Application Acceptance - Approved", complete: true, date: "2009-02-12" });
  });

  it("treats the crawler honeypot stub as empty", () => {
    const d = parseOneStopDetail("<html><body><form><input name='website'/></form></body></html>", 5);
    expect(d.isEmpty).toBe(true);
  });

  it("parses a permit that is not yet issued", () => {
    const d = parseOneStopDetail(fixture("not-issued.html"), 1122436);
    expect(d.isEmpty).toBe(false);
    expect(d.referenceCode).toBe("S6MM3K");
    expect(d.permitNum).toBeNull();
    expect(d.createdBy).toBe("publicwebcrm");
    expect(d.statuses).toEqual([{ name: "Application Submitted", complete: true, date: "2026-10-15" }]);
    expect(d.fees).toEqual([
      { type: "Gas Line and Outlets", amount: 27, paid: false },
      { type: "Water Heaters", amount: 25, paid: false },
    ]);
    expect(d.reviews[0]).toEqual({ division: "Mechanical Permit Review", status: "Pending", date: "2026-10-15", reviewer: null });
    expect(d.inspections[0]).toEqual({ type: "Rough Mech Gas Res", date: null, status: "Unscheduled" });
    expect(d.details["Related Building Permit Number"]).toBe("26-24834-RENO");
    expect(detailToEvents(d)).toEqual([]);
  });

  it("reads the permit number from inside the HTML comment", () => {
    const d = parseOneStopDetail(fixture("issued-comments.html"), 1100000);
    expect(d.permitNum).toBe("26-10504-RNVN");
    expect(d.type).toBe("Renovation (Non-Structural)");
    expect(d.location).toBe("1215-1217 Rev John Raphael, Jr Way");
    expect(d.ownerName).toBe("Housing Authority of New Orleans");
    expect(d.description).toContain("Limited renovation of (2) existing residential units");
    expect(d.contractors).toEqual([{ name: "Colmex Construction LLC", license: null }]);
    expect(d.details["Parcel Tax Bill Numbers"]).toBe("102200209, 102200210");
    expect(d.details["Lot Number"]).toBe("358-A");
    expect(d.details["Existing Building Area (ft²)"]).toBe("3000");
  });

  it("splits review status and date and keeps reviewer names only in reviews", () => {
    const d = parseOneStopDetail(fixture("issued-comments.html"), 1100000);
    expect(d.reviews[0]).toEqual({ division: "Permit Intake", status: "Complete", date: "2026-04-13", reviewer: "Grace Espinoza" });
    expect(d.reviews).toHaveLength(5);
    expect(d.statuses.at(-1)).toEqual({ name: "Permit Issued", complete: true, date: "2026-06-11" });
  });

  it("decodes double-escaped entities and strips emails and phone numbers from comments", () => {
    const d = parseOneStopDetail(fixture("issued-comments.html"), 1100000);
    expect(d.reviewComments).toHaveLength(3);
    expect(d.reviewComments[0]).toMatchObject({ division: "Plan Review", status: "Open" });
    const all = d.reviewComments.map((c) => c.comment).join("\n");
    expect(all).toContain("New Driveways, Sidewalks & Curb Cuts:");
    expect(all).not.toMatch(/@|\(555\)|010-01/);
    expect(all).toContain("PLAN REVIEW\nGENERAL NOTE:");
  });

  it("decodes &amp;#39; in text fields", () => {
    const html = fixture("not-issued.html").replace("<td class='bold'>Type:</td> <td class='summary-table'>", "<td class='bold'>Type:</td> <td class='summary-table'>Owner&amp;#39;s &amp;amp; Co ");
    expect(parseOneStopDetail(html, 1).type).toMatch(/^Owner's & Co /);
  });

  it("parses inspections with dates and times, and fees marked paid", () => {
    const d = parseOneStopDetail(fixture("inspections-fees.html"), 1050000);
    expect(d.permitNum).toBe("25-06193-FGAS");
    expect(d.inspections).toEqual([
      { type: "Rough Mech Gas Res", date: null, status: "Unscheduled" },
      { type: "Gas Line", date: "2025-06-03", status: "Passed" },
      { type: "Water Heater", date: null, status: "Unscheduled" },
    ]);
    expect(d.fees).toEqual([
      { type: "Gas Line and Outlets", amount: 15, paid: true },
      { type: "Water Heaters", amount: 20, paid: true },
    ]);
    expect(d.reviews).toEqual([{ division: "Mechanical Permit Review", status: "Complete", date: "2025-02-27", reviewer: "Tangelia Gross" }]);
  });
});

describe("detailToEvents", () => {
  const d = parseOneStopDetail(fixture("inspections-fees.html"), 1050000);
  const events = detailToEvents(d);

  it("emits status, fee, review and inspection events in page order with sequential seq", () => {
    expect(events.map((e) => e.seq)).toEqual(events.map((_, i) => i));
    const kinds = events.map((e) => e.kind);
    expect(kinds.indexOf("fee")).toBeLessThan(kinds.indexOf("review"));
    expect(kinds.indexOf("review")).toBeLessThan(kinds.indexOf("inspection"));
    expect(events.every((e) => e.permit_num === "25-06193-FGAS" && e.source_id === "onestop:detail")).toBe(true);
    expect(events.filter((e) => e.kind === "inspection")).toHaveLength(3);
  });

  it("maps fields per kind", () => {
    expect(events.find((e) => e.kind === "inspection" && e.name === "Gas Line")).toMatchObject({ status: "Passed", event_date: "2025-06-03" });
    expect(events.find((e) => e.kind === "fee" && e.name === "Water Heaters")).toMatchObject({ status: "Paid", detail: "20" });
    expect(events.find((e) => e.kind === "review")).toMatchObject({ name: "Mechanical Permit Review", status: "Complete", event_date: "2025-02-27", actor: "Mechanical Permit Review" });
  });

  it("never carries reviewer names", () => {
    expect(JSON.stringify(events)).not.toContain("Tangelia");
    const issued = detailToEvents(parseOneStopDetail(fixture("issued-comments.html"), 1100000));
    expect(JSON.stringify(issued)).not.toMatch(/Espinoza|Breckman|Jones|@/);
    expect(issued.find((e) => e.kind === "status" && e.name === "Permit Issued")).toMatchObject({ status: "Complete", event_date: "2026-06-11" });
  });

  it("caps seq below 900", () => {
    const big = { ...d, inspections: Array.from({ length: 1000 }, (_, i) => ({ type: `I${i}`, date: null, status: null })) };
    const out = detailToEvents(big);
    expect(out).toHaveLength(900);
    expect(out.at(-1)!.seq).toBe(899);
  });
});
