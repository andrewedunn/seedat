// ABOUTME: Tests for the frozen historical archives: 311 2012–2018, permits to 2009 (f7tt), Accela and LAMA 2004–2012
// ABOUTME: file archives, and BlightStatus demolitions. Real rows copied from the converted city files.
import { describe, expect, it } from "vitest";
import accela from "../fixtures/rw6e-a9x3.json";
import lama from "../fixtures/fdhh-psg3.json";
import f7tt from "../fixtures/f7tt-z5vu.json";
import sr311 from "../fixtures/3iz8-nghx.json";
import demos from "../fixtures/e3wd-h7q2.json";
import { source as accelaSource } from "../../src/sources/permit_accela";
import { source as lamaSource } from "../../src/sources/permit_lama";
import { source as f7ttSource } from "../../src/sources/permit_f7tt";
import { source as srHistoricSource } from "../../src/sources/service_request_historic";
import { source as demoSource } from "../../src/sources/demolition";
import { recordSources } from "../../src/sources";

type Raw = Record<string, unknown>;
const rows = (x: unknown) => x as Raw[];

describe("frozen archives in the registry", () => {
  it("are registered, marked frozen, and feed the permit, 311 and demolition tables", () => {
    const frozen = recordSources.filter((s) => s.frozen).map((s) => [s.sourceId, s.table]);
    expect(frozen).toEqual(expect.arrayContaining([
      ["socrata:f7tt-z5vu", "permit"], ["socrata:rw6e-a9x3", "permit"], ["socrata:fdhh-psg3", "permit"],
      ["socrata:3iz8-nghx", "service_request"], ["socrata:e3wd-h7q2", "demolition"],
    ]));
  });

  it("rank below the live permit datasets, so live data wins shared columns", () => {
    const live = Math.max(...recordSources.filter((s) => s.table === "permit" && !s.frozen).map((s) => s.priority));
    for (const s of [lamaSource, accelaSource, f7ttSource]) expect(s.priority).toBeGreaterThan(live);
  });
});

describe("permit_accela (rw6e-a9x3)", () => {
  const [vendor, kiosk, placeholder, noGeopin] = rows(accela) as [Raw, Raw, Raw, Raw];

  it("keys on the public permit number and maps type, status, cost, fees, owner and tax bill", () => {
    const r = accelaSource.map(vendor)!;
    expect(accelaSource.key(r)).toBe("04BLD-00046");
    expect(r).toMatchObject({
      address_raw: "1454 MAGAZINE ST", block_id: "1400 MAGAZINE ST",
      permit_type: "BLD", permit_type_desc: "Residential", permit_class: "Single (One-Family Unit)", work_class: "Renovation (Non-Structural)",
      status: "Permit Issuance Active", status_date: "2004-03-04", applied_date: "2004-03-03",
      est_cost: 45000, fees_total: 275, fees_unpaid: 0, owner_name: "BRADLEY C DAVIS", tax_bill: "101104221",
      land_use: "Single Family Dwelling", council_district_filed: "B",
    });
    expect(r.description).toMatch(/^Renovations to an existing 2-sty/);
    expect(r.lat).toBeCloseTo(29.935, 2);
    expect(r.lon).toBeCloseTo(-90.071, 2);
  });

  it("never carries the staff names on the record", () => {
    expect(JSON.stringify(accelaSource.map(vendor))).not.toMatch(/JOLLA|LETHA/);
  });

  it("gives the matcher the city's own GEOPIN, the tax bill and the point", () => {
    const m = accelaSource.matchInput!(vendor);
    expect(m).toMatchObject({ address: "1454 MAGAZINE ST", geopin: "41135750", taxBill: "101104221" });
    expect(m.lat).toBeCloseTo(29.935, 2);
    expect(accelaSource.matchInput!(noGeopin).geopin).toBeNull();
  });

  it("ignores GEOPIN 41021509, a default Accela stamped on 17k permits across 1,200 streets", () => {
    expect(accelaSource.matchInput!({ ...vendor, geopin: "41021509" }).geopin).toBeNull();
  });

  it("keys kiosk and online repair approvals, which have no public number, on the internal id", () => {
    const r = accelaSource.map(kiosk)!;
    expect(accelaSource.key(r)).toBe("ACCELA-102789");
    expect(r).toMatchObject({ address_raw: "1930-1932 S Lopez ST", applied_date: "2007-03-05", status: "APPROVAL", permit_type: null, est_cost: 35000 });
  });

  it("drops the $$ placeholder copies of real permit numbers", () => {
    expect(accelaSource.map(placeholder)).toBeNull();
  });
});

describe("permit_lama (fdhh-psg3)", () => {
  const [mech, demo, unnumbered] = rows(lama) as [Raw, Raw, Raw];

  it("maps the rcm3-shaped columns", () => {
    const r = lamaSource.map(mech)!;
    expect(lamaSource.key(r)).toBe("04MCH-01106");
    expect(r).toMatchObject({
      address_raw: "2605 Josephine St", block_id: "2600 JOSEPHINE ST",
      permit_type: "MECH", permit_type_desc: "General Mechanical",
      status: "Inspection - Completed", status_date: "2004-10-13", is_closed: 1,
      applied_date: null, issued_date: "2004-04-21", est_cost: 0, fees_total: 62, fees_unpaid: 0,
      land_use: "Unknown", zoning_filed: "RM-2",
    });
    expect(JSON.parse(r.contractor as string)).toEqual([{ name: "A/C Ambulance Ser", trade: null, license: null }]);
    expect(r.lat).toBeCloseTo(29.93, 1);
  });

  it("drops a filing date that falls after the issue date, the migration artifact on 87% of rows", () => {
    expect(lamaSource.map(mech)!.applied_date).toBeNull();            // filed 2004-05-16, issued 2004-04-21
    expect(lamaSource.map({ ...mech, filingdate: "2004-04-20T00:00:00" })!.applied_date).toBe("2004-04-20");
    expect(lamaSource.map({ ...mech, filingdate: "2004-04-21T00:00:00" })!.applied_date).toBe("2004-04-21");
  });

  it("keeps only the work description, dropping the import boilerplate, owner address and phone numbers", () => {
    expect(lamaSource.map(mech)!.description).toBe("install gas waf and 3 ton a/c. Sidney Lee @");
    expect(lamaSource.map(demo)!.description).toBe("demolition to grade of a 2 story camp as per owner's request.outside of the hcdrc district.");
  });

  it("takes the owner name out of the description text, even when glued to the next label", () => {
    expect(lamaSource.map(mech)!.owner_name).toBe("Keith T Keller");
    expect(lamaSource.map(demo)!.owner_name).toBe("Cedar Bayou LLC");
    expect(JSON.stringify(lamaSource.map(demo))).not.toContain("Poydras");
  });

  it("treats -1 coordinates as missing and skips rows with no permit number", () => {
    expect(lamaSource.map(demo)!.lat).toBeNull();
    expect(lamaSource.matchInput!(demo)).toEqual({ address: "55456 Rte 6 Highway 90", taxBill: null, lat: null, lon: null });
    expect(lamaSource.map(unnumbered)).toBeNull();
  });
});

describe("permit_f7tt (historical permits to 2009)", () => {
  const [demo, unit, noPoint] = rows(f7tt) as [Raw, Raw, Raw];

  it("maps number, address, dates, owner, zoning and the tax bill inside the property key", () => {
    const r = f7ttSource.map(demo)!;
    expect(f7ttSource.key(r)).toBe("B00000007");
    expect(r).toMatchObject({
      address_raw: "600 MAZANT ST", block_id: "600 MAZANT ST", permit_type_desc: "Building",
      applied_date: "2000-01-04", issued_date: "2000-01-04", owner_name: "REUTHER SEAFOOD, O INC", zoning_filed: "LI", tax_bill: "39W105604",
    });
    expect(r.description).toMatch(/^BUILDING DEMOLITION AND DEBRIS REMOVAL/);
    expect(r.lat).toBeCloseTo(29.96, 1);
  });

  it("keeps the unit, and has no tax bill for generated property keys", () => {
    const r = f7ttSource.map(unit)!;
    expect(r).toMatchObject({ address_raw: "1255 N VILLERE ST UNIT A", tax_bill: null, issued_date: null });
  });

  it("passes address, tax bill and point to the matcher", () => {
    expect(f7ttSource.matchInput!(noPoint)).toEqual({ address: "100 EUTERPE ST", taxBill: null, lat: null, lon: null });
    expect(f7ttSource.matchInput!(demo)).toMatchObject({ address: "600 MAZANT ST", taxBill: "39W105604" });
  });
});

describe("service_request_historic (3iz8-nghx)", () => {
  const [light, signal] = rows(sr311) as [Raw, Raw];

  it("stores the block only, like the live 311 adapter", () => {
    const r = srHistoricSource.map(light)!;
    expect(srHistoricSource.key(r)).toBe("101000847991");
    expect(r).toEqual({
      request_id: "101000847991", block_id: "5400 CONSTANCE ST", request_type: "Street Light", request_reason: "Streetlight - Outage Or Cycling",
      status: "Closed", created_date: "2018-08-21T14:03:55", closed_date: "2018-08-28T09:38:35",
    });
    expect(JSON.stringify(r)).not.toMatch(/Constance St|29\.92|Pole/);
    expect(srHistoricSource.matchInput).toBeUndefined();
  });

  it("has no block for an intersection and no closed date while open", () => {
    expect(srHistoricSource.map(signal)).toMatchObject({ block_id: null, closed_date: null, status: "Open" });
  });

  it("supplies the true created and closed times ahead of the live dataset's migration placeholders", () => {
    expect(srHistoricSource.wins).toEqual(["created_date", "closed_date"]);
  });
});

describe("demolition (e3wd-h7q2)", () => {
  const [fema, noGeopin, zeroGeopin] = rows(demos) as [Raw, Raw, Raw];

  it("maps program, units and dates, and keys on a stable hash of program, address and start date", () => {
    const r = demoSource.map(fema)!;
    expect(r).toMatchObject({
      address_raw: "2443 Louisa Street", block_id: "2400 LOUISA ST", program: "FEMA", case_id: "3152", units: 1,
      council_district_filed: "D", start_date: "2015-11-30", complete_date: "2015-11-30",
    });
    expect(demoSource.key(r)).toBe(r.demolition_id);
    expect(demoSource.key(demoSource.map({ ...fema })!)).toBe(demoSource.key(r));
    expect(demoSource.key(demoSource.map({ ...fema, demolition_start: "2015-12-01T00:00:00.000" })!)).not.toBe(demoSource.key(r));
  });

  it("gives the matcher the GEOPIN when there is one", () => {
    expect(demoSource.matchInput!(fema)).toEqual({ address: "2443 Louisa Street", geopin: "41067296" });
    expect(demoSource.matchInput!(noGeopin)).toEqual({ address: "601 Tricou St", geopin: null });
    expect(demoSource.matchInput!(zeroGeopin).geopin).toBeNull();
  });
});
