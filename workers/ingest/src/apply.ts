// ABOUTME: Applies one page of one source to D1: finds rows whose content changed (per-source hash in src_row),
// ABOUTME: re-assembles and re-matches only those keys, logs field-level changes, upserts, and handles removals.
import { assemble, type Piece } from "@seedat/core/src/assemble";
import { fieldChanges } from "@seedat/core/src/diff";
import { preferRow, recordSources, rowHash, type AnySource } from "@seedat/core/src/sources";
import { insertSql } from "@seedat/core/src/sql";
import { allChunks, jsonChunks, prefetchIndex } from "@seedat/d1/src/prefetch";

const PK: Record<string, string[]> = {
  permit: ["permit_num"], code_case: ["case_id"], str_license: ["str_id"], business_license: ["license_id"],
  service_request: ["request_id"], demolition: ["demolition_id"], code_event: ["source_id", "source_key"], permit_event: ["permit_num", "seq"],
  src_row: ["source_id", "key"], change_log: [], record_parcel: ["entity", "entity_id", "geopin"],
};
const MATCHED = new Set(["permit", "code_case", "str_license", "business_license", "demolition"]);
const sourcesFor = (table: string) => recordSources.filter((s) => s.table === table);
/** Tables whose rows are merged from several sources keep each source's row JSON in src_row. */
export const isMultiSource = (table: string) => table !== "code_event" && sourcesFor(table).length > 1;

const columnCache = new Map<string, Promise<string[]>>();
function columns(db: D1Database, table: string): Promise<string[]> {
  if (!columnCache.has(table)) {
    const p = db.prepare("SELECT name FROM pragma_table_info(?)").bind(table).all<{ name: string }>().then((r) => r.results.map((c) => c.name));
    p.catch(() => columnCache.delete(table));
    columnCache.set(table, p);
  }
  return columnCache.get(table)!;
}

/** Literal-SQL upsert in byte-capped statements (D1 allows only 100 bound parameters, too few for wide rows). */
async function upsert(db: D1Database, table: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const cols = (await columns(db, table)).filter((c) => rows.some((r) => r[c] !== undefined));
  const key = PK[table]!;
  const stmts = insertSql(table, cols, rows, key.length ? { upsertKey: key } : {});
  for (let i = 0; i < stmts.length; i += 50) await db.batch(stmts.slice(i, i + 50).map((s) => db.prepare(s)));
}

interface Mapped { raw: Record<string, unknown>; row: Record<string, unknown>; match: Piece["match"]; hash: string }

/**
 * Map, key and hash raw rows. When a key repeats (e.g. 245 BLDS permit numbers name two permits), `preferRow`
 * picks the version: deterministic regardless of page order, and the same rule the backfill uses.
 */
export function mapRows(src: AnySource, raws: Record<string, unknown>[]): Map<string, Mapped> {
  const out = new Map<string, Mapped>();
  for (const raw of raws) {
    const row = src.map(raw) as Record<string, unknown> | null;
    if (!row) continue;
    const match = src.matchInput?.(raw);
    const hash = rowHash({ ...row, __match: match ?? null });
    const key = src.key(row as never);
    const seen = out.get(key);
    if (!seen || preferRow({ row, hash }, seen)) out.set(key, { raw, row, match, hash });
  }
  return out;
}

export interface PageResult { rows: number; changed: number; inserted: number; updated: number; geopins: number[] }

/** Re-assemble `keys` of `table` from their live src_row pieces (plus fresh in-memory pieces), match, diff, upsert. */
async function reassemble(
  db: D1Database, table: string, keys: string[], fresh: Map<string, Piece>, now: string, snapshotId: number,
): Promise<{ inserted: number; updated: number; removed: number; geopins: Set<number> }> {
  const piecesByKey = new Map<string, Piece[]>();
  if (isMultiSource(table)) {
    const defs = new Map(sourcesFor(table).map((s) => [s.sourceId, s]));
    const stored = await allChunks<{ source_id: string; key: string; row_json: string; match_json: string | null }>(db,
      `SELECT source_id, key, row_json, match_json FROM src_row WHERE key IN (SELECT value FROM json_each(?))
       AND removed_at IS NULL AND source_id IN (${[...defs.keys()].map((s) => `'${s}'`).join(",")})`, keys);
    for (const s of stored) {
      if (fresh.get(s.key)?.sourceId === s.source_id) continue;   // the fresh piece replaces its stored copy
      const list = piecesByKey.get(s.key) ?? [];
      const def = defs.get(s.source_id)!;
      list.push({ sourceId: s.source_id, priority: def.priority, row: JSON.parse(s.row_json), ...(s.match_json ? { match: JSON.parse(s.match_json) } : {}), ...(def.wins ? { wins: def.wins } : {}) });
      piecesByKey.set(s.key, list);
    }
  }
  for (const [k, p] of fresh) piecesByKey.set(k, [...(piecesByKey.get(k) ?? []), p]);

  const index = MATCHED.has(table)
    ? await prefetchIndex(db, [...piecesByKey.values()].flatMap((ps) => ps.flatMap((p) => (p.match ? [p.match] : []))))
    : null;
  const pk = PK[table]![0]!;
  const old = new Map((await allChunks<Record<string, unknown>>(db, `SELECT * FROM ${table} WHERE ${pk} IN (SELECT value FROM json_each(?))`, keys))
    .map((r) => [String(r[pk]), r]));

  const rows: Record<string, unknown>[] = [];
  const log: Record<string, unknown>[] = [];
  const links: Record<string, unknown>[] = [];
  const relinked: string[] = [];
  const geopins = new Set<number>();
  let inserted = 0, updated = 0, removed = 0;
  const logRow = (key: string, field: string, o: string | null, n: string | null) =>
    log.push({ entity: table, entity_id: key, field, old_value: o, new_value: n, observed_at: now, snapshot_id: snapshotId });

  for (const key of keys) {
    const before = old.get(key);
    if (typeof before?.geopin === "number") geopins.add(before.geopin);
    const pieces = piecesByKey.get(key);
    if (!pieces?.length) {
      // Every source dropped this record upstream: keep it, mark it removed.
      if (before && !before.removed_at) { removed++; rows.push({ [pk]: before[pk], removed_at: now }); logRow(key, "*", "present", "removed"); }
      continue;
    }
    const { row, otherGeopins } = assemble(table, pieces, index);
    row.removed_at = null;
    if (MATCHED.has(table)) {
      relinked.push(key);
      for (const g of otherGeopins) { links.push({ entity: table, entity_id: key, geopin: g }); geopins.add(g); }
    }
    if (before) {
      const diffs = fieldChanges(before, row);
      if (!diffs.length) continue;
      updated++;
      row.first_seen_at = before.first_seen_at;
      for (const d of diffs) logRow(key, d.field, d.old, d.new);
    } else {
      inserted++;
      row.first_seen_at = now;
      logRow(key, "*", null, "inserted");
    }
    row.last_seen_at = now;
    if (typeof row.geopin === "number") geopins.add(row.geopin);
    rows.push(row);
  }
  await upsert(db, table, rows);
  await upsert(db, "change_log", log);
  // Extra parcels for multi-address records: replace this batch's links wholesale.
  for (const chunk of jsonChunks(relinked)) {
    await db.prepare("DELETE FROM record_parcel WHERE entity = ? AND entity_id IN (SELECT value FROM json_each(?))").bind(table, chunk).run();
  }
  await upsert(db, "record_parcel", links);
  return { inserted, updated, removed, geopins };
}

export async function applyPage(db: D1Database, src: AnySource, raws: Record<string, unknown>[], now: string, snapshotId: number): Promise<PageResult> {
  const table = src.table;
  const multi = isMultiSource(table);
  const page = mapRows(src, raws);

  // Compare with the hashes stored last time for this source. A key already written earlier in this same run
  // (a duplicate on another page) keeps whichever version has the greater hash.
  const prev = new Map((await allChunks<{ key: string; row_hash: string; row_json: string; last_seen_at: string; removed_at: string | null }>(db,
    `SELECT key, row_hash, row_json, last_seen_at, removed_at FROM src_row WHERE source_id = '${src.sourceId}' AND key IN (SELECT value FROM json_each(?))`, [...page.keys()]))
    .map((r) => [r.key, r]));
  const changed = [...page].filter(([k, v]) => {
    const p = prev.get(k);
    if (!p) return true;
    if (p.row_hash === v.hash) return p.removed_at !== null;   // unchanged, unless it is coming back after removal
    // Written earlier in this run from another page: keep the stored version unless this one is preferred.
    // Single-source tables store only the hash, so there the tiebreak falls back to the hash.
    if (p.last_seen_at !== now) return true;
    const stored = { row: p.row_json ? JSON.parse(p.row_json) as Record<string, unknown> : {}, hash: p.row_hash };
    return preferRow({ row: v.row, hash: v.hash }, stored);
  });
  if (!changed.length) return { rows: page.size, changed: 0, inserted: 0, updated: 0, geopins: [] };

  // Target writes first, src_row last: if anything fails, a retried step still sees these rows as changed.
  const events = changed.flatMap(([, v]) => (src.events?.(v.raw) ?? []) as Record<string, unknown>[]);
  if (events.length) await upsert(db, "permit_event", events);

  let result = { inserted: 0, updated: 0, geopins: [] as number[] };
  if (table === "code_event") {
    await upsert(db, "code_event", changed.map(([, v]) => v.row));
    result.inserted = changed.length;
  } else {
    const fresh = new Map(changed.map(([k, v]) => [k, { sourceId: src.sourceId, priority: src.priority, row: v.row, ...(v.match ? { match: v.match } : {}), ...(src.wins ? { wins: src.wins } : {}) } as Piece]));
    const r = await reassemble(db, table, changed.map(([k]) => k), fresh, now, snapshotId);
    result = { inserted: r.inserted, updated: r.updated, geopins: [...r.geopins] };
  }

  await upsert(db, "src_row", changed.map(([key, v]) => ({
    source_id: src.sourceId, key, row_json: multi ? JSON.stringify(v.row) : "", match_json: multi && v.match ? JSON.stringify(v.match) : null,
    row_hash: v.hash, first_seen_at: now, last_seen_at: now, removed_at: null,
  })));
  return { rows: page.size, changed: changed.length, ...result };
}

/**
 * Removal sweep for one source after a full pull: keys we hold that the pull no longer contains. Refuses when
 * more than `maxShare` of the source would vanish, which means a bad pull rather than real removals.
 */
export async function applyRemovals(
  db: D1Database, src: AnySource, seenKeys: Set<string>, now: string, snapshotId: number, maxShare = 0.2,
): Promise<{ removed: number; refused?: string; geopins: number[] }> {
  const stored = (await db.prepare("SELECT key FROM src_row WHERE source_id = ? AND removed_at IS NULL").bind(src.sourceId).all<{ key: string }>()).results;
  const gone = stored.map((r) => r.key).filter((k) => !seenKeys.has(k));
  if (!gone.length) return { removed: 0, geopins: [] };
  if (gone.length > stored.length * maxShare) return { removed: 0, refused: `${gone.length} of ${stored.length} keys missing; not applying`, geopins: [] };

  const stmts = gone.map((k) => db.prepare("UPDATE src_row SET removed_at = ? WHERE source_id = ? AND key = ?").bind(now, src.sourceId, k));
  for (let i = 0; i < stmts.length; i += 100) await db.batch(stmts.slice(i, i + 100));
  if (src.table === "code_event") {
    // Events are history; a removed upstream row is noted in src_row only.
    return { removed: gone.length, geopins: [] };
  }
  const r = await reassemble(db, src.table, gone, new Map(), now, snapshotId);
  return { removed: gone.length, geopins: [...r.geopins] };
}
