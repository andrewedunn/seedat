// ABOUTME: Snapshot diffing: compares this pull's row hashes with the previous pull's, and lists changed fields.
// ABOUTME: The city replaces most tables nightly without change tracking; this is how we recover history.

export interface KeyedHash { key: string; hash: string }

export interface KeyDiff { inserted: string[]; updated: string[]; unchanged: number; removed: string[] }

export function diffKeys(prev: Map<string, string>, next: Iterable<KeyedHash>): KeyDiff {
  const latest = new Map<string, string>();
  for (const { key, hash } of next) latest.set(key, hash);
  const inserted: string[] = [], updated: string[] = [];
  let unchanged = 0;
  for (const [key, hash] of latest) {
    const before = prev.get(key);
    if (before === undefined) inserted.push(key);
    else if (before !== hash) updated.push(key);
    else unchanged++;
  }
  const removed = [...prev.keys()].filter((k) => !latest.has(k));
  return { inserted, updated, unchanged, removed };
}

const BOOKKEEPING = new Set(["row_hash", "first_seen_at", "last_seen_at", "removed_at", "detail_fetched_at"]);

function canon(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return String(v);
  if (typeof v === "string" && /^-?\d+(\.\d+)?$/.test(v)) return String(Number(v));
  return typeof v === "object" ? JSON.stringify(v) : String(v);
}

export interface FieldChange { field: string; old: string | null; new: string | null }

export function fieldChanges(before: Record<string, unknown>, after: Record<string, unknown>): FieldChange[] {
  const fields = new Set([...Object.keys(before), ...Object.keys(after)]);
  const out: FieldChange[] = [];
  for (const field of fields) {
    if (BOOKKEEPING.has(field)) continue;
    const o = canon(before[field]), n = canon(after[field]);
    if (o !== n) out.push({ field, old: o, new: n });
  }
  return out;
}
