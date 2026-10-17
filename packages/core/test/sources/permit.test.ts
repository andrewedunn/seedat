// ABOUTME: Tests for the three permit adapters (BLDS, rcm3, aib5) against real rows copied from the city datasets.
// ABOUTME: Checks keys, date cleaning, contractor JSON, partial-row shape, lat/lon, and aib5 milestone events.
import { describe, expect, it } from "vitest";
import blds from "../fixtures/permits_blds.json";
import rcm3 from "../fixtures/permits_rcm3.json";
import aib5 from "../fixtures/permits_aib5.json";
import { source as bldsSource } from "../../src/sources/permit_blds";
import { source as rcm3Source } from "../../src/sources/permit_rcm3";
import { source as aib5Source } from "../../src/sources/permit_aib5";

type Raw = Record<string, unknown>;
const rows = (x: unknown) => x as Raw[];

describe("permit_blds", () => {
  const [a, b, c] = rows(blds) as [Raw, Raw, Raw];

  it("describes the dataset", () => {
    expect(bldsSource.sourceId).toBe("socrata:72f9-bi28");
    expect(bldsSource.table).toBe("permit");
    expect(bldsSource.license).toBe("CC0-1.0");
  });

  it("maps a modern permit and fixes the leading '#' on its number", () => {
    const r = bldsSource.map(a)!;
    expect(r.permit_num).toBe("23-31957-SERV");
    expect(bldsSource.key(r)).toBe("23-31957-SERV");
    expect(r).toMatchObject({
      address_raw: "3724 Fourth St", block_id: "3700 FOURTH ST",
      permit_type: "SERV", permit_type_desc: "Electrical Service / Circuit / Feeder", permit_class: "Two-Family",
      work_class: "Electrical Service / Circuit / Feeder",
      status: "Meter Release", status_mapped: "Permit Finaled", status_date: "2024-02-26T11:26:37",
      applied_date: "2023-11-21T07:52:15", issued_date: "2024-02-14T07:45:52", completed_date: "2024-02-26T11:25:11",
      expires_date: "2024-08-14T07:45:52", est_cost: 2500, fees_total: 94, tax_bill: "412405313", onestop_ref: "J5FTJH",
    });
    expect(JSON.parse(r.contractor as string)).toEqual([{ name: "Corey Brian Chatman", trade: "Electrical", license: "07LEL-00148" }]);
  });

  it("collapses double spaces in names and keeps the first pin of a list for matching", () => {
    const r = bldsSource.map(b)!;
    expect(r.issued_date).toBe("2012-10-19");
    expect(r.tax_bill).toBe("101112320, 101112321");
    expect(JSON.parse(r.contractor as string)[0]).toEqual({ name: "Eugene J Lawrence Jr.", trade: null, license: null });
    expect(bldsSource.matchInput!(b)).toEqual({ address: "3612 Thalia St", taxBill: "101112320" });
  });

  it("leaves columns the row omits as null and does not invent a contractor", () => {
    const r = bldsSource.map(c)!;
    expect(r.issued_date).toBeNull();
    expect(r.contractor).toBeNull();
    expect(r.tax_bill).toBeNull();
    expect(bldsSource.matchInput!(c)).toEqual({ address: "1900 Shade Tree Ln", taxBill: null });
  });

  it("scrubs phone numbers and emails out of the description", () => {
    const r = bldsSource.map({ ...a, description: "Install waf. frank 504-821-0005 f@x.com 13-05147-RNVN" })!;
    expect(r.description).toBe("Install waf. frank 13-05147-RNVN");
  });

  it("returns null without a permit number", () => {
    expect(bldsSource.map({ ...a, permitnum: undefined })).toBeNull();
  });

  it("nulls junk dates", () => {
    expect(bldsSource.map({ ...a, issuedate: "2915-02-14T00:00:00.000", expiresdate: "1900-01-01T00:00:00.000" })).toMatchObject({ issued_date: null, expires_date: null });
  });
});

describe("permit_rcm3", () => {
  const [a, b] = rows(rcm3) as [Raw, Raw];

  it("keys on numstring and maps the columns BLDS lacks", () => {
    expect(rcm3Source.sourceId).toBe("socrata:rcm3-fn58");
    const r = rcm3Source.map(b)!;
    expect(rcm3Source.key(r)).toBe("25-17611-RNVN");
    expect(r).toMatchObject({
      owner_name: "Williams Claudia Clark", fees_total: 195, fees_unpaid: 0, is_closed: 0,
      land_use: "Mixed Use", zoning_filed: "VCR-2", council_district_filed: "C",
      lat: 29.960800683903543, lon: -90.06212517913177, tax_bill: "41022258",
    });
    expect(r.historic_district_filed).toBeNull();
  });

  it("reads closed permits and historic district", () => {
    const r = rcm3Source.map(a)!;
    expect(r).toMatchObject({ is_closed: 1, historic_district_filed: "Garden District", zoning_filed: "C-1A" });
  });

  it("passes address, pin and coordinates to the matcher", () => {
    expect(rcm3Source.matchInput!(b)).toEqual({ address: "1022 Royal St", taxBill: "41022258", lat: 29.960800683903543, lon: -90.06212517913177 });
  });

  it("drops the city's missing-key placeholder rows", () => {
    expect(rcm3Source.map({ ...b, numstring: "missing_key_value_123456" })).toBeNull();
  });

  it("treats a 0/0 location as no location", () => {
    expect(rcm3Source.map({ ...b, location_1: { latitude: "0.0", longitude: "0.0" } })).toMatchObject({ lat: null, lon: null });
  });
});

describe("permit_aib5", () => {
  const [a, b] = rows(aib5) as [Raw, Raw];

  it("maps the partial row with coordinates and milestone dates", () => {
    expect(aib5Source.sourceId).toBe("socrata:aib5-en5t");
    const r = aib5Source.map(a)!;
    expect(aib5Source.key(r)).toBe("15-23865-RNVN");
    expect(r).toMatchObject({
      address_raw: "1245 Constance St", is_closed: 1, land_use: "Mixed Use",
      applied_date: "2018-11-27", issued_date: "2018-11-30", co_issued_date: "2019-07-08",
      lat: 29.938110448149292, lon: -90.0702210904141,
    });
    expect(aib5Source.matchInput!(a)).toMatchObject({ address: "1245 Constance St", lat: 29.938110448149292 });
  });

  it("emits one status event per milestone present, in pipeline order, with stable sequence numbers", () => {
    const ev = aib5Source.events!(a);
    expect(ev.map((e) => [e.name, e.event_date])).toEqual([
      ["Application submitted", "2018-11-27"],
      ["Application review", "2018-11-27"],
      ["Zoning review", "2018-11-29"],
      ["Plan review", "2018-11-29"],
      ["Permit approved", "2018-11-30"],
      ["Issue date", "2018-11-30"],
      ["First inspection", "2019-06-13"],
    ]);
    expect(ev[0]).toMatchObject({ permit_num: "15-23865-RNVN", kind: "status", source_id: "socrata:aib5-en5t", status: null });
    expect(new Set(ev.map((e) => e.seq)).size).toBe(ev.length);
    // Sequence is tied to the milestone, not to which ones are present.
    expect(aib5Source.events!(b).map((e) => e.seq)).toEqual([ev[0]!.seq]);
  });

  it("skips milestones with junk dates", () => {
    const ev = aib5Source.events!({ ...a, plan_review: "1900-01-01T00:00:00.000" });
    expect(ev.map((e) => e.name)).not.toContain("Plan review");
  });

  it("drops rows the city flags as deleted", () => {
    expect(aib5Source.map({ ...a, isdeleted: "True" })).toBeNull();
  });

  it("falls back to state-plane coordinates", () => {
    const r = aib5Source.map({ ...b, latitude: undefined, longitude: undefined })!;
    expect(r.lat).toBeCloseTo(29.9688, 3);
    expect(r.lon).toBeCloseTo(-90.0446, 3);
  });
});
