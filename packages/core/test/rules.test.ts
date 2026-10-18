// ABOUTME: Tests for the plain-English property rules: which review applies to a parcel and what its zoning means.
// ABOUTME: Covers VCC, HDLC full/partial control, landmarks, solar review, National Register, undesignated parcels.
import { describe, expect, it } from "vitest";
import { rulesForParcel, zoningPlainEnglish, type Rule } from "../src/rules.js";

type P = Parameters<typeof rulesForParcel>[0];
const base: P = {
  zoning: "HU-RD1", zoning_desc: "Two-Family Residential District", overlays: [],
  local_historic_district: null, hdlc_control: null, nr_district: null, is_landmark: false, hdlc_solar_review: false,
};
const titles = (rs: Rule[]) => rs.map((r) => r.title);
const find = (rs: Rule[], re: RegExp) => rs.find((r) => re.test(r.title));

describe("rulesForParcel", () => {
  it("French Quarter VCC parcel: VCC review first, no HDLC rule", () => {
    const rs = rulesForParcel({ ...base, zoning: "VCC-2", zoning_desc: "Vieux Carré Commercial District", local_historic_district: "Vieux Carré" });
    const first = rs[0]!;
    expect(first.title).toMatch(/Vieux Carr/);
    expect(first.body).toMatch(/paint/i);
    expect(first.sourceUrl).toMatch(/^https:\/\/nola\.gov\//);
    expect(find(rs, /HDLC/)).toBeUndefined();
  });

  it("French Quarter parcel flagged in the solar area still gets no HDLC solar rule (the VCC reviews all exterior work)", () => {
    const rs = rulesForParcel({ ...base, zoning: "VCC-1", local_historic_district: "Vieux Carré", hdlc_control: "Full", hdlc_solar_review: true });
    expect(find(rs, /HDLC/)).toBeUndefined();
  });

  it("Bywater full-control parcel: HDLC review, paint color exempt", () => {
    const rs = rulesForParcel({ ...base, zoning: "HMR-2", local_historic_district: "Bywater", hdlc_control: "Full" });
    const r = find(rs, /HDLC/)!;
    expect(r).toBeDefined();
    expect(rs[0]).toBe(r);
    expect(r.body).toMatch(/Certificate of Appropriateness/);
    expect(r.body).toMatch(/paint colou?r/i);
    expect(r.verified).toBe(true);
    expect(find(rs, /Vieux Carr/)).toBeUndefined();
  });

  it("Mid-City partial-control parcel: demolition only", () => {
    const rs = rulesForParcel({ ...base, local_historic_district: "Mid-City", hdlc_control: "Partial" });
    const r = find(rs, /HDLC/)!;
    expect(r.body).toMatch(/demolition/i);
    expect(r.body).not.toMatch(/Certificate of Appropriateness/);
  });

  it("Esplanade Ridge partial-control parcel also mentions comment-only review", () => {
    const rs = rulesForParcel({ ...base, local_historic_district: "Esplanade Ridge", hdlc_control: "Partial" });
    expect(find(rs, /HDLC/)!.body).toMatch(/comment/i);
  });

  it("parcel with no designation says no historic review and cites a source", () => {
    const rs = rulesForParcel(base);
    expect(find(rs, /HDLC|Vieux/)).toBeUndefined();
    const r = find(rs, /No (local )?historic/i)!;
    expect(r).toBeDefined();
    expect(r.sourceUrl).toMatch(/^https:\/\//);
  });

  it("landmark: all exterior work reviewed, even outside a district", () => {
    const rs = rulesForParcel({ ...base, is_landmark: true });
    const r = find(rs, /landmark/i)!;
    expect(r.body).toMatch(/exterior/i);
    expect(find(rs, /No (local )?historic/i)).toBeUndefined();
  });

  it("solar-review parcel gets a solar rule; others do not", () => {
    const rs = rulesForParcel({ ...base, local_historic_district: "Garden District", hdlc_control: "Full", hdlc_solar_review: true });
    expect(find(rs, /solar/i)).toBeDefined();
    expect(find(rulesForParcel(base), /solar/i)).toBeUndefined();
  });

  it("National Register district without local review: City Council demolition review, not exterior review", () => {
    const rs = rulesForParcel({ ...base, nr_district: "Broadmoor" });
    const r = find(rs, /National Register/)!;
    expect(r.body).toMatch(/demolition/i);
    expect(r.body).toMatch(/City Council/);
  });

  it("every rule has a source URL; unverified ones are flagged", () => {
    const rs = rulesForParcel({ ...base, is_landmark: true, hdlc_solar_review: true, local_historic_district: "Bywater", hdlc_control: "Full" });
    for (const r of rs) {
      expect(r.sourceUrl).toMatch(/^https:\/\//);
      expect(r.body.length).toBeGreaterThan(20);
      expect(typeof r.verified).toBe("boolean");
    }
    expect(titles(rs).length).toBe(new Set(titles(rs)).size);
  });

  it("interim zoning rules apply citywide when zoning is known, with data center flagged unverified", () => {
    const rs = rulesForParcel(base);
    expect(find(rs, /Transient lodging/i)!.verified).toBe(true);
    expect(find(rs, /Data center/i)!.verified).toBe(false);
    expect(rulesForParcel({ ...base, zoning: null, zoning_desc: null }).length).toBeGreaterThan(0);
  });
});

describe("zoningPlainEnglish", () => {
  it("explains common districts", () => {
    expect(zoningPlainEnglish("HU-RD1", null)).toMatch(/two-family/i);
    expect(zoningPlainEnglish("S-RS", null)).toMatch(/single-family/i);
    expect(zoningPlainEnglish("C-2", null)).toMatch(/auto/i);
    expect(zoningPlainEnglish("VCC-1", null)).toMatch(/French Quarter/);
    expect(zoningPlainEnglish("LI", null)).toMatch(/industrial/i);
  });
  it("falls back by pattern and ignores inclusionary suffixes", () => {
    expect(zoningPlainEnglish("CBD-9", null)).toMatch(/downtown|central business/i);
    expect(zoningPlainEnglish("HU-RD1-IZ", null)).toBe(zoningPlainEnglish("HU-RD1", null));
    expect(zoningPlainEnglish("S-LRS1", null)).toMatch(/single-family/i);
  });
  it("returns null for missing or unknown codes", () => {
    expect(zoningPlainEnglish(null, null)).toBeNull();
    expect(zoningPlainEnglish("ZZZ-9", null)).toBeNull();
  });
});
