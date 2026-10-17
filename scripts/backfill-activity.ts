// ABOUTME: Backfills every activity table in seedat-db from data/raw/src/<id>/: permits, events, code cases, STR,
// ABOUTME: 311, business licences and NOPD block-month counts; also writes per-source hash manifests for nightly diffs.
// Usage: npx tsx scripts/backfill-activity.ts [--load]   (run scripts/download-all.sh first)
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { assemble, type Piece } from "../packages/core/src/assemble";
import { insertSql } from "../packages/core/src/sql";
import { policeSources, recordSources, rowHash, type AnySource } from "../packages/core/src/sources";
import { loadSqlFiles, writeSqlFiles } from "./lib/d1";
import { DATA, RAW, buildFullIndex } from "./lib/raw";

const now = new Date().toISOString();
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

function* rawRows(sourceId: string): Generator<Record<string, unknown>> {
  const dir = join(RAW, "src", sourceId.replace("socrata:", ""));
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".json")).sort()) {
    for (const r of JSON.parse(readFileSync(join(dir, f), "utf8"))) yield r;
  }
}

const COLUMNS = tableColumns();
const MATCHED = new Set(["permit", "code_case", "str_license", "business_license"]);
const MULTI_SOURCE = new Set(["permit", "str_license"]);
const { index } = buildFullIndex();
const statements: string[] = [];
const stats: Record<string, unknown> = {};

function writeTable(table: string, rows: Record<string, unknown>[], extra: Record<string, unknown> = {}) {
  const cols = COLUMNS.get(table)!;
  const full = rows.map((r) => ({ ...r, ...extra }));
  const present = cols.filter((c) => full.some((r) => r[c] !== undefined));
  statements.push(`DELETE FROM ${table};`, ...insertSql(table, present, full));
}

function manifest(sourceId: string, hashes: Map<string, string>) {
  writeFileSync(join(STATE, `${sourceId.replace(":", "_")}.hashes.json.gz`), gzipSync(JSON.stringify(Object.fromEntries(hashes))));
}

// ── record tables ──
const byTable = new Map<string, AnySource[]>();
for (const s of recordSources) byTable.set(s.table, [...(byTable.get(s.table) ?? []), s]);

for (const [table, sources] of byTable) {
  const pieces = new Map<string, Piece[]>();
  const events: Record<string, unknown>[] = [];
  const srcRows: Record<string, unknown>[] = [];
  for (const src of sources) {
    const hashes = new Map<string, string>();
    let mapped = 0, dropped = 0;
    for (const raw of rawRows(src.sourceId)) {
      const row = src.map(raw) as Record<string, unknown> | null;
      if (!row) { dropped++; continue; }
      mapped++;
      const key = src.key(row as never);
      const match = src.matchInput?.(raw);
      const h = rowHash({ ...row, __match: match ?? null });
      hashes.set(key, h);
      const list = pieces.get(key) ?? [];
      list.push({ sourceId: src.sourceId, priority: src.priority, row, ...(match ? { match } : {}) });
      pieces.set(key, list);
      // Every source keeps its per-row hash (the nightly diff baseline); only multi-source tables keep the row itself.
      const multi = MULTI_SOURCE.has(table);
      srcRows.push({ source_id: src.sourceId, key, row_json: multi ? JSON.stringify(row) : "", match_json: multi && match ? JSON.stringify(match) : null, row_hash: h, first_seen_at: now, last_seen_at: now });
      for (const e of src.events?.(raw) ?? []) events.push(e as Record<string, unknown>);
    }
    manifest(src.sourceId, hashes);
    stats[src.sourceId] = { mapped, dropped, keys: hashes.size };
  }

  const rows: Record<string, unknown>[] = [];
  const matchCounts: Record<string, number> = {};
  for (const [, list] of pieces) {
    // Duplicate keys within one source (e.g. 245 BLDS permit numbers): last piece per source wins.
    const perSource = [...new Map(list.map((p) => [p.sourceId, p])).values()];
    const { row } = assemble(table, perSource, MATCHED.has(table) ? index : null);
    if (MATCHED.has(table)) matchCounts[row.match_type as string] = (matchCounts[row.match_type as string] ?? 0) + 1;
    rows.push(row);
  }
  if (table === "code_event") {
    writeTable(table, [...new Map(rows.map((r) => [`${r.source_id}|${r.source_key}`, r])).values()].map(({ row_hash, ...r }) => r));
  } else if (table === "service_request" || table === "business_license" || table === "code_case" || table === "permit" || table === "str_license") {
    writeTable(table, rows, { first_seen_at: now, last_seen_at: now });
  }
  if (events.length) {
    const ev = [...new Map(events.map((e) => [`${e.permit_num}|${e.seq}`, e])).values()];
    writeTable("permit_event", ev);
    stats.permit_event = ev.length;
  }
  if (srcRows.length) {
    statements.push(`DELETE FROM src_row WHERE source_id IN (${sources.map((s) => `'${s.sourceId}'`).join(", ")});`,
      ...insertSql("src_row", Object.keys(srcRows[0]!), srcRows));
  }
  const matched = Object.entries(matchCounts).filter(([k]) => k !== "unmatched").reduce((s, [, n]) => s + n, 0);
  stats[table] = { rows: rows.length, ...(MATCHED.has(table) ? { matchRate: `${(100 * matched / rows.length).toFixed(2)}%`, byType: matchCounts } : {}) };
  console.log(table, JSON.stringify(stats[table]));
}

// ── NOPD calls for service → block × month × category counts only ──
const police = new Map<string, number>();
for (const src of policeSources) {
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
const policeRows = [...police].map(([k, n]) => { const [block_id, month, category] = k.split("|"); return { block_id, month, category, n }; });
writeTable("police_call_month", policeRows);
console.log("police_call_month", policeRows.length);

// ── provenance ──
const sourceRows = [...recordSources, ...policeSources].map((s) => ({
  source_id: s.sourceId, name: s.name, url: s.url, license: s.license, cadence: "nightly",
  last_pulled_at: now, last_success_at: now, last_row_count: (stats[s.sourceId] as { mapped?: number; used?: number })?.mapped ?? (stats[s.sourceId] as { used?: number })?.used ?? null,
}));
statements.push(...insertSql("source", Object.keys(sourceRows[0]!), sourceRows, { upsertKey: ["source_id"] }));
statements.push("INSERT INTO permit_fts(permit_fts) VALUES('rebuild');");

writeFileSync(join(STATE, "backfill-stats.json"), JSON.stringify(stats, null, 2));
const files = writeSqlFiles("activity", statements);
console.log(`wrote ${files.length} SQL files`);
if (process.argv.includes("--load")) loadSqlFiles(files);
