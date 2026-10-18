// ABOUTME: Backfills every activity table in seedat-db from data/raw/src/<id>/: permits, events, code cases, STR,
// ABOUTME: 311, business licences, demolitions and NOPD block-month counts; also writes per-source hash manifests for nightly diffs.
// Usage: npx tsx scripts/backfill-activity.ts [--load] [--tables=permit,code_case,...] [--police] [--sources=f7tt-z5vu,...]
// Re-running with --tables replaces whole tables (DELETE then INSERT), which also wipes crawler-written permit.onestop_id
// and onestop:detail events; after a re-run, reload those with scripts/load-onestop.ts. Intended for the initial load.
//   (run scripts/download-all.sh first; with no --tables/--police/--sources flags, everything is backfilled)
// --sources adds sources to a loaded database without wiping anything: every key those sources hold is re-assembled
// from all of its table's sources and upserted (first_seen_at kept), and only those keys' src_row baselines are written.
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { assemble, type Piece } from "../packages/core/src/assemble";
import { insertSql } from "../packages/core/src/sql";
import { policeSources, recordSources, type AnySource } from "../packages/core/src/sources";
import { loadSqlFiles, writeSqlFiles } from "./lib/d1";
import { collectSource, rawRows } from "./lib/pieces";
import { DATA, buildFullIndex } from "./lib/raw";

const now = new Date().toISOString();
const tablesArg = process.argv.find((a) => a.startsWith("--tables="))?.slice(9).split(",");
const sourcesArg = process.argv.find((a) => a.startsWith("--sources="))?.slice(10).split(",").map((s) => (s.includes(":") ? s : `socrata:${s}`));
const addOnly = new Set(sourcesArg ?? []);
const doPolice = process.argv.includes("--police") || (!tablesArg && !sourcesArg);
const wantTable = (t: string) => !tablesArg || tablesArg.includes(t);
const STATE = join(DATA, "state");
mkdirSync(STATE, { recursive: true });

/** Column names per table, read from the migrations so we never write a column that doesn't exist. */
function tableColumns(): Map<string, string[]> {
  const migrations = readdirSync(join(DATA, "..", "db", "migrations")).filter((f) => f.endsWith(".sql")).sort()
    .map((f) => readFileSync(join(DATA, "..", "db", "migrations", f), "utf8")).join("\n");
  const out = execFileSync("sqlite3", [":memory:"], {
    input: `${migrations}\n.mode list\nSELECT m.name, p.name FROM sqlite_master m JOIN pragma_table_info(m.name) p WHERE m.type = 'table';\n`,
  }).toString();
  const cols = new Map<string, string[]>();
  for (const line of out.trim().split("\n")) {
    const [t, c] = line.split("|");
    cols.set(t!, [...(cols.get(t!) ?? []), c!]);
  }
  return cols;
}

const COLUMNS = tableColumns();
const MATCHED = new Set(["permit", "code_case", "str_license", "business_license", "demolition"]);
const PK: Record<string, string> = { permit: "permit_num", code_case: "case_id", str_license: "str_id", business_license: "license_id", service_request: "request_id", demolition: "demolition_id" };
const { index } = buildFullIndex();
const statements: string[] = [];
const stats: Record<string, unknown> = {};

function writeTable(table: string, rows: Record<string, unknown>[], extra: Record<string, unknown> = {}) {
  const cols = COLUMNS.get(table)!;
  const full = rows.map((r) => ({ ...r, ...extra }));
  const present = cols.filter((c) => full.some((r) => r[c] !== undefined));
  statements.push(`DELETE FROM ${table};`, ...insertSql(table, present, full));
}

/** Add-only write: insert new keys, update existing ones in place, keep their first_seen_at and every other column. */
function upsertTable(table: string, rows: Record<string, unknown>[], extra: Record<string, unknown> = {}) {
  const cols = COLUMNS.get(table)!;
  const full = rows.map((r) => ({ ...r, ...extra }));
  const present = cols.filter((c) => full.some((r) => r[c] !== undefined));
  statements.push(...insertSql(table, present, full, { upsertKey: [PK[table]!], keepOnConflict: ["first_seen_at"] }));
}

function manifest(sourceId: string, hashes: Map<string, string>) {
  writeFileSync(join(STATE, `${sourceId.replace(":", "_")}.hashes.json.gz`), gzipSync(JSON.stringify(Object.fromEntries(hashes))));
}

// ── record tables ──
const byTable = new Map<string, AnySource[]>();
for (const s of recordSources) byTable.set(s.table, [...(byTable.get(s.table) ?? []), s]);

for (const [table, sources] of byTable) {
  const adding = sources.filter((s) => addOnly.has(s.sourceId));
  if (sourcesArg ? !adding.length : !wantTable(table)) continue;
  // Same rule as the Worker (apply.ts isMultiSource): tables fed by several sources keep each source's row JSON.
  const multi = table !== "code_event" && sources.length > 1;
  const collected = sources.map((src) => ({ src, ...collectSource(src) }));
  // In add-only mode, only the keys the added sources hold are touched.
  const keys = sourcesArg ? new Set(collected.filter((c) => addOnly.has(c.src.sourceId)).flatMap((c) => [...c.best.keys()])) : null;
  const pieces = new Map<string, Piece[]>();
  const events: Record<string, unknown>[] = [];
  const srcRows: Record<string, unknown>[] = [];
  for (const { src, best, mapped, dropped } of collected) {
    // Duplicate keys within one source (e.g. 245 BLDS permit numbers): `preferRow` picks, the same
    // deterministic rule the nightly Worker uses (workers/ingest/src/apply.ts mapRows).
    const hashes = new Map<string, string>();
    for (const [key, { row, match, h, raw }] of best) {
      hashes.set(key, h);
      if (keys && !keys.has(key)) continue;
      const list = pieces.get(key) ?? [];
      list.push({ sourceId: src.sourceId, priority: src.priority, row, ...(match ? { match } : {}), ...(src.wins ? { wins: src.wins } : {}) });
      pieces.set(key, list);
      // Every source keeps its per-row hash (the nightly diff baseline); only multi-source tables keep the row itself.
      srcRows.push({ source_id: src.sourceId, key, row_json: multi ? JSON.stringify(row) : "", match_json: multi && match ? JSON.stringify(match) : null, row_hash: h, first_seen_at: now, last_seen_at: now });
      if (!keys || addOnly.has(src.sourceId)) for (const e of src.events?.(raw) ?? []) events.push(e as Record<string, unknown>);
    }
    if (!sourcesArg || addOnly.has(src.sourceId)) {
      manifest(src.sourceId, hashes);
      stats[src.sourceId] = { mapped, dropped, keys: hashes.size };
    }
  }

  const rows: Record<string, unknown>[] = [];
  const matchCounts: Record<string, number> = {};
  for (const [, list] of pieces) {
    const { row } = assemble(table, list, MATCHED.has(table) ? index : null);
    if (MATCHED.has(table)) matchCounts[row.match_type as string] = (matchCounts[row.match_type as string] ?? 0) + 1;
    rows.push(row);
  }
  if (table === "code_event") {
    writeTable(table, [...new Map(rows.map((r) => [`${r.source_id}|${r.source_key}`, r])).values()].map(({ row_hash, ...r }) => r));
  } else if (sourcesArg) {
    upsertTable(table, rows, { first_seen_at: now, last_seen_at: now });
  } else {
    writeTable(table, rows, { first_seen_at: now, last_seen_at: now });
  }
  if (events.length) {
    const ev = [...new Map(events.map((e) => [`${e.permit_num}|${e.seq}`, e])).values()];
    if (sourcesArg) statements.push(...insertSql("permit_event", Object.keys(ev[0]!), ev, { upsertKey: ["permit_num", "seq"] }));
    else writeTable("permit_event", ev);
    stats.permit_event = ev.length;
  }
  if (srcRows.length) {
    // Add-only: the added sources' baselines are replaced; other sources' baselines are refreshed for the touched keys
    // only, from the same download that built the row, so the nightly diff and the row agree.
    const clear = sourcesArg ? adding : sources;
    statements.push(`DELETE FROM src_row WHERE source_id IN (${clear.map((s) => `'${s.sourceId}'`).join(", ")});`,
      ...insertSql("src_row", Object.keys(srcRows[0]!), srcRows, sourcesArg ? { upsertKey: ["source_id", "key"], keepOnConflict: ["first_seen_at"] } : {}));
  }
  const matched = Object.entries(matchCounts).filter(([k]) => k !== "unmatched").reduce((s, [, n]) => s + n, 0);
  stats[table] = { rows: rows.length, ...(MATCHED.has(table) ? { matchRate: `${(100 * matched / rows.length).toFixed(2)}%`, byType: matchCounts } : {}) };
  console.log(table, JSON.stringify(stats[table]));
}

// ── NOPD calls for service → block × month × category counts only ──
const police = new Map<string, number>();
for (const src of doPolice ? policeSources : []) {
  let used = 0, skipped = 0;
  const seen = new Set<string>();   // the 2019 file overlaps 2020: dedupe on the NOPD item number
  for (const raw of rawRows(src.sourceId)) {
    const item = String(raw.nopd_item ?? "");
    if (item && seen.has(item)) continue;
    if (item) seen.add(item);
    const m = src.map(raw);
    if (!m) { skipped++; continue; }
    used++;
    const k = `${m.block_id}|${m.month}|${m.category}`;
    police.set(k, (police.get(k) ?? 0) + 1);
  }
  stats[src.sourceId] = { used, skipped };
}
if (doPolice) {
  const policeRows = [...police].map(([k, n]) => { const [block_id, month, category] = k.split("|"); return { block_id, month, category, n }; });
  writeTable("police_call_month", policeRows);
  console.log("police_call_month", policeRows.length);
}

// ── provenance ──
const backfilled = sourcesArg ? recordSources.filter((s) => addOnly.has(s.sourceId)) : recordSources.filter((s) => wantTable(s.table));
const sourceRows = [...backfilled, ...(doPolice ? policeSources : [])].map((s) => ({
  source_id: s.sourceId, name: s.name, url: s.url, license: s.license, cadence: "frozen" in s && s.frozen ? "frozen" : "nightly",
  last_pulled_at: now, last_success_at: now, last_row_count: (stats[s.sourceId] as { mapped?: number; used?: number })?.mapped ?? (stats[s.sourceId] as { used?: number })?.used ?? null,
}));
statements.push(...insertSql("source", Object.keys(sourceRows[0]!), sourceRows, { upsertKey: ["source_id"] }));
// Add-only writes go through the permit_fts triggers (migration 0007); a full table reload needs a rebuild.
if (wantTable("permit") && !sourcesArg) statements.push("INSERT INTO permit_fts(permit_fts) VALUES('rebuild');");

writeFileSync(join(STATE, "backfill-stats.json"), JSON.stringify(stats, null, 2));
const files = writeSqlFiles(sourcesArg ? `add-${sourcesArg.map((s) => s.replace("socrata:", "")).join("+")}` : `activity-${tablesArg?.join("+") ?? "all"}${doPolice && tablesArg ? "+police" : ""}`, statements);
console.log(`wrote ${files.length} SQL files`);
if (process.argv.includes("--load")) loadSqlFiles(files);
