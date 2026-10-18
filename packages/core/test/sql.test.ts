// ABOUTME: Tests for the SQL batch writer used to load D1: quoting, NULLs, JSON values, and upsert form.
// ABOUTME: Values come from city data, so escaping must be airtight.
import { describe, expect, it } from "vitest";
import { insertSql, sqlValue, utf8Length } from "../src/sql";

describe("sqlValue", () => {
  it("quotes strings and doubles embedded quotes", () => {
    expect(sqlValue("O'Keefe")).toBe("'O''Keefe'");
  });
  it("writes NULL for null and undefined", () => {
    expect(sqlValue(null)).toBe("NULL");
    expect(sqlValue(undefined)).toBe("NULL");
  });
  it("writes finite numbers bare and non-finite as NULL", () => {
    expect(sqlValue(12.5)).toBe("12.5");
    expect(sqlValue(Number.NaN)).toBe("NULL");
  });
  it("writes booleans as 0/1 and objects as JSON text", () => {
    expect(sqlValue(true)).toBe("1");
    expect(sqlValue([{ name: "A'B" }])).toBe(`'[{"name":"A''B"}]'`);
  });
  it("neutralizes control characters that break statements", () => {
    expect(sqlValue("a\u0000b")).toBe("'ab'");
  });
});

describe("insertSql", () => {
  it("writes multi-row inserts in chunks", () => {
    const rows = [{ a: 1, b: "x" }, { a: 2, b: null }, { a: 3, b: "z" }];
    expect(insertSql("t", ["a", "b"], rows, { chunk: 2 })).toEqual([
      "INSERT INTO t (a, b) VALUES (1, 'x'), (2, NULL);",
      "INSERT INTO t (a, b) VALUES (3, 'z');",
    ]);
  });
  it("starts a new statement before exceeding maxBytes (D1 rejects statements over 100 KB)", () => {
    const rows = Array.from({ length: 10 }, (_, i) => ({ a: i, b: "x".repeat(100) }));
    const out = insertSql("t", ["a", "b"], rows, { chunk: 1000, maxBytes: 300 });
    expect(out.length).toBeGreaterThan(1);
    for (const s of out) expect(s.length).toBeLessThanOrEqual(300);
    expect(out.join(" ").match(/\(\d+, 'x+'\)/g)).toHaveLength(10);
  });

  it("measures the limit in UTF-8 bytes, not characters", () => {
    const rows = Array.from({ length: 4 }, (_, i) => ({ a: i, b: "é".repeat(40) }));   // 80 bytes of text per row
    const out = insertSql("t", ["a", "b"], rows, { maxBytes: 200 });
    for (const s of out) expect(utf8Length(s)).toBeLessThanOrEqual(200);
    expect(utf8Length("é")).toBe(2);
  });

  it("ignores duplicates when every column is part of the key", () => {
    expect(insertSql("t", ["a", "b"], [{ a: 1, b: 2 }], { upsertKey: ["a", "b"] })).toEqual([
      "INSERT INTO t (a, b) VALUES (1, 2) ON CONFLICT (a, b) DO NOTHING;",
    ]);
  });

  it("supports upsert on a key", () => {
    expect(insertSql("t", ["k", "v"], [{ k: "a", v: 1 }], { upsertKey: ["k"] })).toEqual([
      "INSERT INTO t (k, v) VALUES ('a', 1) ON CONFLICT (k) DO UPDATE SET v = excluded.v;",
    ]);
  });
});
