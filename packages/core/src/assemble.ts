// ABOUTME: Turns the per-source pieces of one record (e.g. a permit seen in BLDS, rcm3 and aib5) into the final
// ABOUTME: table row: merged columns, parcel match columns, derived fields and row_hash. Shared by backfill and nightly ingest.
import type { AddressIndex } from "./index-types";
import { matchRecord, type MatchInput } from "./match";
import { mergeRows } from "./merge";
import { rowHash } from "./sources/helpers";

export interface Piece { sourceId: string; priority: number; row: Record<string, unknown>; match?: MatchInput; wins?: readonly string[] }

/** Merge match inputs the same way as rows: first non-empty value by priority wins each field. */
export function mergeMatchInputs(pieces: Piece[]): MatchInput | null {
  const withMatch = [...pieces].filter((p) => p.match).sort((a, b) => a.priority - b.priority);
  if (!withMatch.length) return null;
  const out: Record<string, unknown> = { address: null };
  for (const { match } of withMatch) {
    for (const [k, v] of Object.entries(match!)) {
      if (v !== null && v !== undefined && v !== "" && (out[k] === null || out[k] === undefined)) out[k] = v;
    }
  }
  return out as unknown as MatchInput;
}

const daysBetween = (a: unknown, b: unknown): number | null => {
  if (typeof a !== "string" || typeof b !== "string") return null;
  const d = (Date.parse(b) - Date.parse(a)) / 86_400_000;
  return Number.isFinite(d) && d >= 0 ? Math.round(d) : null;
};

export interface Assembled { row: Record<string, unknown>; sources: string[]; otherGeopins: number[] }

/**
 * Build the final row. `matched` tables get geopin/address_id/match_type/match_score; permits also get
 * days_to_issue and a JSON `sources` list. Bookkeeping (first/last_seen_at) is the caller's job.
 */
export function assemble(table: string, pieces: Piece[], index: AddressIndex | null): Assembled {
  const { row, sources } = mergeRows(pieces);
  let otherGeopins: number[] = [];
  if (index) {
    const input = mergeMatchInputs(pieces);
    const m = input ? matchRecord(input, index) : null;
    otherGeopins = m?.otherGeopins ?? [];
    row.geopin = m?.geopin ?? null;
    row.address_id = m?.addressId ?? null;
    row.match_type = m?.matchType ?? "unmatched";
    row.match_score = m?.score ?? 0;
  }
  // Only the active-licenses list says a license is active; absence from it means not active.
  if (table === "str_license") row.is_active = row.is_active ?? 0;
  if (table === "permit") {
    row.days_to_issue = daysBetween(row.applied_date, row.issued_date);
    row.sources = JSON.stringify(sources);
  }
  row.row_hash = rowHash(row);
  return { row, sources, otherGeopins };
}
