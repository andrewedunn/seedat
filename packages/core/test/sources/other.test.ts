// ABOUTME: Tests for the STR, business-license and 311 adapters, including that phones, emails and addresses are dropped.
// ABOUTME: Real rows; STR keying uses the application reference code because renewals reuse license numbers.
import { describe, expect, it } from "vitest";
import strApps from "../fixtures/str_application.json";
import strActive from "../fixtures/ufdg-ajws.json";
import strNon from "../fixtures/2ei9-wqw2.json";
import biz from "../fixtures/hjcd-grvu.json";
import sr from "../fixtures/2jgv-pqrq.json";
import { source as appSource } from "../../src/sources/str_application";
import { source as activeSource } from "../../src/sources/str_active";
import { source as nonSource } from "../../src/sources/str_noncommercial";
import { source as bizSource } from "../../src/sources/business_license";
import { source as srSource } from "../../src/sources/service_request";

type Raw = Record<string, unknown>;
const rows = (x: unknown) => x as Raw[];

describe("str_application", () => {
  const [a, b] = rows(strApps) as [Raw, Raw];

  it("keys on the reference code and keeps the operator name only", () => {
    expect(appSource.sourceId).toBe("socrata:en36-xvxg");
    const r = appSource.map(a)!;
    expect(appSource.key(r)).toBe("G5G1Z1");
    expect(r).toMatchObject({
      license_number: "17STR-03654", reference_code: "G5G1Z1", address_raw: "1823 N Rampart St", block_id: "1800 N RAMPART ST",
      license_type: "Short Term Rental", status: "Expired", applied_date: "2017-03-13T10:03:23", issued_date: "2017-04-06T10:27:04",
      expiration_date: "2018-04-05T10:27:04", operator_name: "Corbett Scott", lat: 29.967534427202207, lon: -90.0608581762254,
    });
    expect(r.is_active).toBeUndefined();
  });

  it("never lets a phone or email through, even if one is in the raw row", () => {
    const r = appSource.map({ ...a, contact_phone: "504-408-1823", contact_email: "x@y.com", contact_name: "Pat 504-408-1823" })!;
    const s = JSON.stringify(r);
    expect(s).not.toMatch(/504|@/);
    expect(Object.keys(r).filter((k) => /phone|email/.test(k))).toEqual([]);
  });

  it("handles applications that never got a license number", () => {
    const r = appSource.map(b)!;
    expect(r.str_id).toBe("1AUYGY");
    expect(r.license_number).toBeNull();
    expect(r.status).toBe("Denied");
    expect(appSource.matchInput!(b)).toMatchObject({ address: "7543 Plum St", lat: 29.944667998954227 });
  });

  it("returns null with no reference code", () => {
    expect(appSource.map({ ...a, reference_code: undefined })).toBeNull();
  });
});

describe("str_active", () => {
  it("marks rows active and reads latitude/longitude columns", () => {
    expect(activeSource.sourceId).toBe("socrata:ufdg-ajws");
    const r = activeSource.map(rows(strActive)[0]!)!;
    expect(r).toMatchObject({ str_id: "Q657QJ", license_number: "25-XSTR-45204", is_active: 1, license_type: "Lodging Exempt from STR Regulation", lat: 29.95301746902359 });
    expect(r.status).toBeUndefined();
    expect(r.operator_name ?? null).toBeNull();
  });
  it("keeps operator_name without phone or email", () => {
    const r = activeSource.map({ ...rows(strActive)[0]!, operator_name: "Jo Doe", operator_phone: "5045551212", operator_email: "a@b.co" })!;
    expect(r.operator_name).toBe("Jo Doe");
    expect(JSON.stringify(r)).not.toMatch(/5045551212|@/);
  });
});

describe("str_noncommercial", () => {
  it("maps the non-commercial license list", () => {
    const [x] = rows(strNon) as [Raw];
    const r = nonSource.map(x)!;
    expect(r).toMatchObject({
      str_id: "2YZFYP", license_number: "23-NSTR-15998", license_type: "Non-Commercial Short Term Rental", status: "Issued",
      operator_name: "Leah Grabert", applied_date: "2026-04-29T19:28:15", expiration_date: "2027-06-30T23:59:00",
      lat: 29.999569837659013, lon: -90.07424213495804,
    });
    expect(r.is_active).toBeUndefined();
    expect(JSON.stringify(r)).not.toMatch(/lefink|@|3377811006/);
  });
});

describe("business_license", () => {
  const [placeholder, ok] = rows(biz) as [Raw, Raw];
  it("maps a license and drops owner, phone and mailing details", () => {
    const r = bizSource.map(ok)!;
    expect(bizSource.key(r)).toBe("105025335");
    expect(r).toMatchObject({ business_name: "1000 FIGS", business_type: "Special Events-Other (Vendor)", issued_date: "2017-07-15", address_raw: "3141 PONCE DE LEON ST", block_id: "3100 PONCE DE LEON ST" });
    expect(JSON.stringify(r)).not.toMatch(/630|SUNNY/);
    expect(bizSource.matchInput!(ok)).toMatchObject({ address: "3141 PONCE DE LEON ST", lat: 29.980563361097094 });
  });
  it("treats the '0' business name as missing", () => {
    expect(bizSource.map(placeholder)!.business_name).toBeNull();
  });
  it("does not offer out-of-town addresses to the New Orleans matcher", () => {
    const m = bizSource.matchInput!(placeholder);
    expect(m.address).toBeNull();
    expect(m.lat ?? null).toBeNull();
  });
});

describe("service_request", () => {
  const [mayor, street] = rows(sr) as [Raw, Raw];
  it("stores the block and no address or point", () => {
    expect(srSource.sourceId).toBe("socrata:2jgv-pqrq");
    const r = srSource.map(street)!;
    expect(srSource.key(r)).toBe("2021-848380");
    expect(r).toMatchObject({ block_id: "4800 CAMELIA ST", request_type: "Roads and Streets", request_reason: "Street Subsidence (Sinking)", status: "Pending", created_date: "2021-12-15T15:05:19" });
    expect(Object.keys(r).filter((k) => /address|lat|lon|point|x$|y$/.test(k))).toEqual([]);
    expect(JSON.stringify(r)).not.toContain("Camelia St");
    expect(srSource.matchInput).toBeUndefined();
  });
  it("has a null block when the request has no address", () => {
    const r = srSource.map(mayor)!;
    expect(r.block_id).toBeNull();
    expect(r.closed_date).toBe("2022-07-08T09:30:48");
  });
});
