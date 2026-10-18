// ABOUTME: Re-runs the current matcher over every matched record (permits, code cases, STR, licenses, demolitions) and
// ABOUTME: updates only match columns and multi-parcel links in seedat-db. Use after improving the matcher.
// Usage: npx tsx scripts/rematch.ts [--load]   (writes data/sql/rematch-*.sql; rehearse in local SQLite with
//   PRAGMA foreign_keys=ON first, since D1 enforces foreign keys)
import { assemble, type Piece } from "../packages/core/src/assemble";
import { recordSources } from "../packages/core/src/sources";
import { isEventPermit } from "../packages/core/src/status";
import { insertSql } from "../packages/core/src/sql";
import { loadSqlFiles, writeSqlFiles } from "./lib/d1";
import { collectSource } from "./lib/pieces";
import { DATA, buildFullIndex } from "./lib/raw";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const KEY: Record<string, string> = { permit: "permit_num", code_case: "case_id", str_license: "str_id", business_license: "license_id", demolition: "demolition_id" };
const CHUNK = 20_000;

const { index } = buildFullIndex();
// Address points can name a GEOPIN the parcel layer lacks; links must point at real parcels (D1 enforces the FK).
const knownParcels = new Set(readFileSync(join(DATA, "derived", "parcels.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l).geopin as number));
const stage: Record<string, unknown>[] = [];
const links: Record<string, unknown>[] = [];
const counts: Record<string, Record<string, number>> = {};

for (const table of Object.keys(KEY)) {
  const pieces = new Map<string, Piece[]>();
  for (const src of recordSources.filter((s) => s.table === table)) {
    for (const [key, b] of collectSource(src).best) {
      const list = pieces.get(key) ?? [];
      list.push({ sourceId: src.sourceId, priority: src.priority, row: b.row, ...(b.match ? { match: b.match } : {}), ...(src.wins ? { wins: src.wins } : {}) });
      pieces.set(key, list);
    }
  }
  const c: Record<string, number> = {};
  let events = 0, eventsUnmatched = 0;
  for (const [key, list] of pieces) {
    const { row, otherGeopins } = assemble(table, list, index);
    c[row.match_type as string] = (c[row.match_type as string] ?? 0) + 1;
    if (table === "permit" && isEventPermit(key)) { events++; if (row.match_type === "unmatched") eventsUnmatched++; }
    stage.push({ rid: stage.length, entity: table, key, geopin: row.geopin, address_id: row.address_id, match_type: row.match_type, match_score: row.match_score });
    for (const g of otherGeopins) if (knownParcels.has(g)) links.push({ entity: table, entity_id: key, geopin: g });
  }
  counts[table] = c;
  const total = Object.values(c).reduce((s, n) => s + n, 0);
  console.log(`${table}: ${total} rows, matched ${(100 * (total - (c.unmatched ?? 0)) / total).toFixed(2)}%`, JSON.stringify(c));
  if (events) {
    const props = total - events, unmatchedProps = (c.unmatched ?? 0) - eventsUnmatched;
    console.log(`  excluding ${events} event permits: ${props} property permits, matched ${(100 * (props - unmatchedProps) / props).toFixed(2)}%`);
  }
}
console.log(`multi-parcel links: ${links.length}`);

const statements: string[] = [
  "DROP TABLE IF EXISTS rematch_stage;",
  "CREATE TABLE rematch_stage (rid INTEGER PRIMARY KEY, entity TEXT, key TEXT, geopin INTEGER, address_id INTEGER, match_type TEXT, match_score REAL);",
  ...insertSql("rematch_stage", ["rid", "entity", "key", "geopin", "address_id", "match_type", "match_score"], stage),
];
for (let lo = 0; lo < stage.length; lo += CHUNK) {
  for (const [table, key] of Object.entries(KEY)) {
    const cmp = table === "code_case" ? `${table}.${key} = CAST(s.key AS INTEGER)` : `${table}.${key} = s.key`;
    statements.push(`UPDATE ${table} SET geopin = s.geopin, address_id = s.address_id, match_type = s.match_type, match_score = s.match_score
      FROM rematch_stage s WHERE s.entity = '${table}' AND s.rid >= ${lo} AND s.rid < ${lo + CHUNK} AND ${cmp}
      AND (${table}.geopin IS NOT s.geopin OR ${table}.match_type IS NOT s.match_type OR ${table}.address_id IS NOT s.address_id);`);
  }
}
statements.push("DELETE FROM record_parcel;", ...insertSql("record_parcel", ["entity", "entity_id", "geopin"], links, { upsertKey: ["entity", "entity_id", "geopin"] }), "DROP TABLE rematch_stage;");

const files = writeSqlFiles("rematch", statements);
console.log(`wrote ${files.length} SQL files`);
if (process.argv.includes("--load")) loadSqlFiles(files);
