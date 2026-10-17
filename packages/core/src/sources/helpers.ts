// ABOUTME: Shared helpers for source adapters: junk-date cleaning, stable row hashing, contact scrubbing, and value coercion.
// ABOUTME: Pure JS with no dependencies so the same code runs in Node ingest scripts and in Workers.

const MIN_YEAR = 1990;
const MAX_YEARS_AHEAD = 2;

/**
 * ISO `YYYY-MM-DD`, or `YYYY-MM-DDTHH:MM:SS` when the source has a real time of day.
 * Socrata timestamps are floating (no zone), so none is appended.
 * Years before 1990 (which covers the 1753/1900 placeholders) or beyond this year + 2 (1905, 2915, 5015 typos) give null.
 */
export function cleanDate(v: unknown, now: Date = new Date()): string | null {
  if (typeof v !== "string") return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?)?/.exec(v.trim());
  if (!m) return null;
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const [hh, mm, ss] = [Number(m[4] ?? 0), Number(m[5] ?? 0), Number(m[6] ?? 0)];
  if (year < MIN_YEAR || year > now.getUTCFullYear() + MAX_YEARS_AHEAD) return null;
  if (month < 1 || month > 12 || hh > 23 || mm > 59 || ss > 59) return null;
  if (day < 1 || day > new Date(Date.UTC(year, month, 0)).getUTCDate()) return null;
  const date = `${m[1]}-${m[2]}-${m[3]}`;
  return hh === 0 && mm === 0 && ss === 0 ? date : `${date}T${m[4]}:${m[5]}:${m[6] ?? "00"}`;
}

// Columns that describe our bookkeeping or the match result, not the upstream record's content.
const HASH_EXCLUDED = new Set([
  "first_seen_at", "last_seen_at", "removed_at", "row_hash",
  "geopin", "address_id", "match_type", "match_score",
]);

/** cyrb53: a fast, well-distributed 53-bit string hash using only 32-bit integer math. */
export function hash53(str: string, seed = 0): number {
  let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

/** Hash of the content columns, sorted by name; null and undefined count as absent. */
export function rowHash(row: Record<string, unknown>): string {
  const content = Object.keys(row)
    .filter((k) => !HASH_EXCLUDED.has(k) && row[k] != null)
    .sort()
    .map((k) => [k, row[k]]);
  return hash53(JSON.stringify(content)).toString(16).padStart(14, "0");
}

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/g;
const PHONE_RE = /(?<![\d.-])(?:\+?1[\s.-]?)?(?:\(\d{3}\)\s*|\d{3}[\s.-]?)\d{3}[\s.-]?\d{4}(?![\d-])/g;

/** Removes email addresses and US phone numbers from free text. Line breaks are kept. */
export function dropContact(input: string): string {
  return input
    .replace(EMAIL_RE, "")
    .replace(PHONE_RE, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+(\r?\n)/g, "$1")
    .trim();
}

/** Trimmed string, or null for missing and blank values. */
export function text(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

export function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** The city's boolean spellings ("True", "Yes", "Y") as 1/0. */
export function yesNo(v: unknown): 0 | 1 | null {
  const s = text(v)?.toLowerCase();
  if (!s) return null;
  if (s === "true" || s === "yes" || s === "y" || s === "1") return 1;
  if (s === "false" || s === "no" || s === "n" || s === "0") return 0;
  return null;
}

/** Permit numbers as the datasets share them: no leading '#', one hyphen between parts, no stray spaces. */
export function cleanPermitNum(v: unknown): string | null {
  const s = text(v);
  if (!s || /^missing_key/i.test(s)) return null;
  return s.replace(/^#+/, "").toUpperCase().replace(/\s*-\s*/g, "-").replace(/\s+/g, "-").replace(/-{2,}/g, "-").replace(/^-|-$/g, "") || null;
}

/** A WGS84 point from a Socrata location object ({latitude, longitude}), or null for missing and 0/0 placeholders. */
export function pointFrom(lat: unknown, lon: unknown): { lat: number; lon: number } | null {
  const la = num(lat), lo = num(lon);
  if (la === null || lo === null || (la === 0 && lo === 0)) return null;
  return { lat: la, lon: lo };
}

export const socrataUrl = (id: string): string => `https://data.nola.gov/resource/${id}.json`;

const DEAD_STATUS = /\b(VOID|VOIDED|CANCEL+ED|WITHDRAWN|DUPLICATE)\b/i;

/**
 * When one source repeats a key (e.g. a permit number reused by a voided duplicate), pick one version
 * deterministically: a live record beats a voided/cancelled/duplicate one, then the greater hash wins.
 * Used by both the backfill and the nightly Worker so they always agree.
 */
export function preferRow(a: { row: Record<string, unknown>; hash: string }, b: { row: Record<string, unknown>; hash: string }): boolean {
  const dead = (r: Record<string, unknown>) => DEAD_STATUS.test(`${r.status ?? ""} ${r.status_mapped ?? ""}`);
  const da = dead(a.row), db = dead(b.row);
  if (da !== db) return !da;
  return a.hash > b.hash;
}
