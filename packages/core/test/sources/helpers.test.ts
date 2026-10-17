// ABOUTME: Tests for the shared source helpers: date cleaning, row hashing, contact scrubbing, and number/text coercion.
// ABOUTME: The date cases are junk values really found in city data (years 1905, 2915, 5015, 1753 and 1900 placeholders).
import { describe, expect, it } from "vitest";
import { cleanDate, cleanPermitNum, dropContact, num, rowHash, text, yesNo } from "../../src/sources/helpers";

const NOW = new Date("2026-10-17T12:00:00Z");

describe("cleanDate", () => {
  it("keeps a midnight timestamp as a plain date", () => {
    expect(cleanDate("2012-01-28T00:00:00.000", NOW)).toBe("2012-01-28");
  });
  it("keeps the time when there is one", () => {
    expect(cleanDate("2026-10-16T14:19:28.000", NOW)).toBe("2026-10-16T14:19:28");
  });
  it("reads the space-separated form with microseconds used by hearing dates", () => {
    expect(cleanDate("2026-10-15 14:45:30.123456", NOW)).toBe("2026-10-15T14:45:30");
    expect(cleanDate("2021-08-03 11:30:38", NOW)).toBe("2021-08-03T11:30:38");
  });
  it("nulls the junk years", () => {
    for (const bad of ["1905-03-01T00:00:00.000", "2915-03-01T00:00:00.000", "5015-01-01T00:00:00.000", "1753-01-01T00:00:00.000", "1900-01-01T00:00:00.000"]) {
      expect(cleanDate(bad, NOW)).toBeNull();
    }
  });
  it("allows up to two years ahead and no further", () => {
    expect(cleanDate("2028-12-31T00:00:00.000", NOW)).toBe("2028-12-31");
    expect(cleanDate("2029-01-01T00:00:00.000", NOW)).toBeNull();
    expect(cleanDate("1990-01-01", NOW)).toBe("1990-01-01");
    expect(cleanDate("1989-12-31", NOW)).toBeNull();
  });
  it("nulls empty, non-string and impossible dates", () => {
    expect(cleanDate(null, NOW)).toBeNull();
    expect(cleanDate(undefined, NOW)).toBeNull();
    expect(cleanDate("", NOW)).toBeNull();
    expect(cleanDate("not a date", NOW)).toBeNull();
    expect(cleanDate("2020-02-31T00:00:00.000", NOW)).toBeNull();
    expect(cleanDate(20200101, NOW)).toBeNull();
  });
});

describe("rowHash", () => {
  it("is stable across calls and independent of key order", () => {
    const a = { permit_num: "26-1-X", status: "Issued", est_cost: 10 };
    const b = { est_cost: 10, status: "Issued", permit_num: "26-1-X" };
    expect(rowHash(a)).toBe(rowHash(b));
    expect(rowHash(a)).toBe(rowHash({ ...a }));
    expect(rowHash(a)).toMatch(/^[0-9a-f]{14}$/);
  });
  it("changes when content changes", () => {
    expect(rowHash({ a: 1 })).not.toBe(rowHash({ a: 2 }));
    expect(rowHash({ a: "1" })).not.toBe(rowHash({ a: 1 }));
  });
  it("ignores bookkeeping, match columns, null and undefined", () => {
    const base = { permit_num: "x", status: "Issued" };
    const noisy = {
      ...base, first_seen_at: "2026-01-01", last_seen_at: "2026-02-01", row_hash: "abc", removed_at: null,
      geopin: 1, address_id: 2, match_type: "exact", match_score: 1, description: null, lat: undefined,
    };
    expect(rowHash(noisy)).toBe(rowHash(base));
  });
  it("hashes non-ASCII text", () => {
    expect(rowHash({ a: "Tremé" })).not.toBe(rowHash({ a: "Treme" }));
  });
});

describe("dropContact", () => {
  it("removes emails", () => {
    expect(dropContact("call or write jo.smith+x@example.com today")).toBe("call or write today");
  });
  it("removes US phone numbers in common shapes", () => {
    for (const p of ["504-408-1823", "(504) 408-1823", "504.408.1823", "5047101124", "+1 504 408 1823", "1-504-408-1823"]) {
      expect(dropContact(`roy ${p} ck#16849`)).toBe("roy ck#16849");
    }
  });
  it("leaves permit numbers, dates and money alone", () => {
    const s = "see 13-05147-RNVN and 09BLD-03049, filed 12/30/2011 for $250000.50";
    expect(dropContact(s)).toBe(s);
  });
  it("keeps line breaks", () => {
    expect(dropContact("line one\r\nline two 504-408-1823")).toBe("line one\r\nline two");
  });
});

describe("coercion", () => {
  it("text trims and nulls blanks", () => {
    expect(text("  a  ")).toBe("a");
    expect(text("   ")).toBeNull();
    expect(text(undefined)).toBeNull();
    expect(text(5)).toBe("5");
  });
  it("num parses numeric strings and nulls the rest", () => {
    expect(num("12.5")).toBe(12.5);
    expect(num("0.0")).toBe(0);
    expect(num("")).toBeNull();
    expect(num("x")).toBeNull();
    expect(num(null)).toBeNull();
  });
  it("yesNo reads the city's boolean spellings", () => {
    expect(yesNo("True")).toBe(1);
    expect(yesNo("Yes")).toBe(1);
    expect(yesNo("False")).toBe(0);
    expect(yesNo(undefined)).toBeNull();
  });
});

describe("cleanPermitNum", () => {
  it("strips a leading # and tidies spacing", () => {
    expect(cleanPermitNum("#23-31957-SERV")).toBe("23-31957-SERV");
    expect(cleanPermitNum("12-12345 HVAC")).toBe("12-12345-HVAC");
    expect(cleanPermitNum("12-12345--HVAC")).toBe("12-12345-HVAC");
    expect(cleanPermitNum("12-12345- NEWC       ")).toBe("12-12345-NEWC");
  });
  it("rejects the city's missing-key placeholders", () => {
    expect(cleanPermitNum("missing_key_value_123456")).toBeNull();
    expect(cleanPermitNum("")).toBeNull();
    expect(cleanPermitNum(undefined)).toBeNull();
  });
});
