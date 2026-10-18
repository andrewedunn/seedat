// ABOUTME: Address search for the page and MCP server: resolves a typed address to a parcel with the same match
// ABOUTME: ladder used at ingest, and offers typeahead suggestions from the canonical address points.
import { matchRecord, type MatchResult } from "@seedat/core/src/match";
import { parseAddress } from "@seedat/core/src/normalize";
import { prefetchIndex } from "./prefetch";

export interface Suggestion { geopin: number; full_address: string; neighborhood: string | null }

/** Resolve free text ("1234 st claude", "3210 Gravier St Apt 2") to a parcel, or say why not. */
export async function resolveAddress(db: D1Database, q: string): Promise<MatchResult> {
  const index = await prefetchIndex(db, [{ address: q }]);
  return matchRecord({ address: q }, index);
}

/**
 * Typeahead: with a house number, building addresses on streets starting with what was typed; without one, the
 * first address on matching streets. Prefix matching runs on the normalized street key, so "st cl" finds SAINT CLAUDE.
 */
export async function suggest(db: D1Database, q: string, limit = 8): Promise<Suggestion[]> {
  const trimmed = q.trim();
  if (trimmed.length < 2) return [];
  const number = /^\d+/.exec(trimmed)?.[0];
  // Parse with a stand-in number when none was typed, so the street normalizes the same way either way.
  const streetPart = parseAddress(number ? trimmed : `1 ${trimmed}`)?.street ?? "";
  const prefix = streetPart.replace(/\s+(ST|AVE|BLVD|DR|RD|PL|CT|LN|PKWY|HWY)$/, "");
  if (!prefix) return [];

  const rows = number
    // Nearest house numbers on matching streets: the exact number often has no address point (vacant lots, doubles).
    ? await db.prepare(`SELECT a.geopin, a.full_address, p.neighborhood FROM address a JOIN parcel p ON p.geopin = a.geopin
        WHERE a.street_key >= ? AND a.street_key < ? AND a.number BETWEEN ? AND ? AND a.unit_id IS NULL AND a.status = 'Current'
        ORDER BY abs(a.number - ?), a.street_key LIMIT ?`).bind(prefix, `${prefix}\uffff`, Number(number) - 60, Number(number) + 60, Number(number), limit).all<Suggestion>()
    : await db.prepare(`SELECT a.geopin, a.street_key AS full_address, p.neighborhood FROM address a JOIN parcel p ON p.geopin = a.geopin
        WHERE a.street_key >= ? AND a.street_key < ? AND a.unit_id IS NULL GROUP BY a.street_key ORDER BY a.street_key LIMIT ?`)
        .bind(prefix, `${prefix}\uffff`, limit).all<Suggestion>();
  return rows.results;
}
