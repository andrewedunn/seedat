// ABOUTME: Applies one page of one source to D1: finds rows whose content changed (per-source hash in src_row),
// ABOUTME: re-assembles and re-matches only those keys, logs field-level changes, and upserts the target table.
import { assemble, type Piece } from "@seedat/core/src/assemble";
import { fieldChanges } from "@seedat/core/src/diff";
import { recordSources, rowHash, type AnySource } from "@seedat/core/src/sources";
import { insertSql } from "@seedat/core/src/sql";
import { allChunks } from "./prefetch";
import { prefetchIndex } from "./prefetch";

const PK: Record<string, string[]> = {
  permit: ["permit_num"], code_case: ["case_id"], str_license: ["str_id"], business_license: ["license_id"],
  service_request: ["request_id"], code_event: ["source_id", "source_key"], permit_event: ["permit_num", "seq"],
  src_row: ["source_id", "key"], change_log: [],
};
const MATCHED = new Set(["permit", "code_case", "str_license", "business_license"]);
const sourcesFor = (table: string) => recordSources.filter((s) => s.table === table);
const isMultiSource = (table: string) => sourcesFor(table).length > 1;

const columnCache = new Map<string, Promise<string[]>>();
function columns(db: D1Database, table: string): Promise<string[]> {
  if (!columnCache.has(table)) {
    columnCache.set(table, db.prepare(`SELECT name FROM pragma_table_info(?)`).bind(table).all<{ name: string }>().then((r) => r.results.map((c) => c.name)));
  }
  return columnCache.get(table)!;
}

/** Literal-SQL upsert in ≤90 KB statements (D1 caps bound parameters at 100 per statement, too few for wide rows). */
async function upsert(db: D1Database, table: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const cols = (await columns(db, table)).filter((c) => rows.some((r) => r[c] !== undefined));
  const key = PK[table]!;
  const stmts = insertSql(table, cols, rows, key.length ? { upsertKey: key } : {});
  for (let i = 0; i < stmts.length; i += 50) await db.batch(stmts.slice(i, i + 50).map((s) => db.prepare(s)));
}

export interface PageResult { rows: number; changed: number; inserted: number; updated: number; geopins: number[] }

export async function applyPage(db: D1Database, src: AnySource, raws: Record<string, unknown>[], now: string, snapshotId: number): Promise<PageResult> {
  const table = src.table;
  const multi = isMultiSource(table);

  // 1. Map, key and hash this page.
  const page = new Map<string, { raw: Record<string, unknown>; row: Record<string, unknown>; match: Piece["match"]; hash: string }>();
  for (const raw of raws) {
    const row = src.map(raw) as Record<string, unknown> | null;
    if (!row) continue;
    const match = src.matchInput?.(raw);
    page.set(src.key(row as never), { raw, row, match, hash: rowHash({ ...row, __match: match ?? null }) });
  }

  // 2. Compare with the hashes we stored last time for this source.
  const prev = new Map((await allChunks<{ key: string; row_hash: string }>(db,
    `SELECT key, row_hash FROM src_row WHERE source_id = '${src.sourceId}' AND key IN (SELECT value FROM json_each(?))`, [...page.keys()]))
    .map((r) => [r.key, r.row_hash]));
  const changed = [...page].filter(([k, v]) => prev.get(k) !== v.hash);
  if (!changed.length) return { rows: page.size, changed: 0, inserted: 0, updated: 0, geopins: [] };

  await upsert(db, "src_row", changed.map(([key, v]) => ({
    source_id: src.sourceId, key, row_json: multi ? JSON.stringify(v.row) : "", match_json: multi && v.match ? JSON.stringify(v.match) : null,
    row_hash: v.hash, first_seen_at: now, last_seen_at: now,
  })));

  // 3. Derived events (aib5 milestones) for changed rows.
  const events = changed.flatMap(([, v]) => (src.events?.(v.raw) ?? []) as Record<string, unknown>[]);
  if (events.length) await upsert(db, "permit_event", events);

  // 4. code_event rows are their own target; nothing to merge or match.
  if (table === "code_event") {
    await upsert(db, "code_event", changed.map(([, v]) => v.row));
    return { rows: page.size, changed: changed.length, inserted: changed.length, updated: 0, geopins: [] };
  }

  // 5. Gather every source's piece for the changed keys, then assemble and match.
  const keys = changed.map(([k]) => k);
  let piecesByKey: Map<string, Piece[]>;
  if (multi) {
    const priorities = new Map(sourcesFor(table).map((s) => [s.sourceId, s.priority]));
    const stored = await allChunks<{ source_id: string; key: string; row_json: string; match_json: string | null }>(db,
      `SELECT source_id, key, row_json, match_json FROM src_row WHERE key IN (SELECT value FROM json_each(?)) AND source_id IN (${[...priorities.keys()].map((s) => `'${s}'`).join(",")})`, keys);
    piecesByKey = new Map();
    for (const s of stored) {
      const list = piecesByKey.get(s.key) ?? [];
      list.push({ sourceId: s.source_id, priority: priorities.get(s.source_id)!, row: JSON.parse(s.row_json), ...(s.match_json ? { match: JSON.parse(s.match_json) } : {}) });
      piecesByKey.set(s.key, list);
    }
  } else {
    piecesByKey = new Map(changed.map(([k, v]) => [k, [{ sourceId: src.sourceId, priority: src.priority, row: v.row, ...(v.match ? { match: v.match } : {}) }]]));
  }
  const index = MATCHED.has(table)
    ? await prefetchIndex(db, [...piecesByKey.values()].flatMap((ps) => ps.flatMap((p) => (p.match ? [p.match] : []))))
    : null;

  const pk = PK[table]![0]!;
  const old = new Map((await allChunks<Record<string, unknown>>(db, `SELECT * FROM ${table} WHERE ${pk} IN (SELECT value FROM json_each(?))`, keys))
    .map((r) => [String(r[pk]), r]));

  const rows: Record<string, unknown>[] = [];
  const log: Record<string, unknown>[] = [];
  const geopins = new Set<number>();
  let inserted = 0, updated = 0;
  for (const [key, pieces] of piecesByKey) {
    const { row } = assemble(table, pieces, index);
    const before = old.get(key);
    if (before) {
      const diffs = fieldChanges(before, row);
      if (!diffs.length) continue;
      updated++;
      row.first_seen_at = before.first_seen_at;
      for (const d of diffs) log.push({ entity: table, entity_id: key, field: d.field, old_value: d.old, new_value: d.new, observed_at: now, snapshot_id: snapshotId });
      if (typeof before.geopin === "number") geopins.add(before.geopin);
    } else {
      inserted++;
      row.first_seen_at = now;
      log.push({ entity: table, entity_id: key, field: "*", old_value: null, new_value: "inserted", observed_at: now, snapshot_id: snapshotId });
    }
    row.last_seen_at = now;
    if (typeof row.geopin === "number") geopins.add(row.geopin);
    rows.push(row);
  }
  await upsert(db, table, rows);
  await upsert(db, "change_log", log);
  return { rows: page.size, changed: changed.length, inserted, updated, geopins: [...geopins] };
}
