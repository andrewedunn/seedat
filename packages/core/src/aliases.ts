// ABOUTME: Learns street-name aliases from the city's own data: where an address point and a parcel share a
// ABOUTME: GEOPIN but spell the street differently, the parcel's spelling is an alias, weighted by agreeing parcels.
import { normalizeStreet, parseAddress } from "./normalize";

export interface AliasEvidenceRow { geopin: number; addressStreet: string; situs: string }
export interface LearnedAlias { alias: string; street: string; origin: "parcel-situs"; votes: number }

export function learnStreetAliases(rows: AliasEvidenceRow[], opts: { minVotes: number; minShare: number }): LearnedAlias[] {
  const canonical = new Set<string>();
  // variant -> canonical street -> set of agreeing GEOPINs
  const votes = new Map<string, Map<string, Set<number>>>();

  for (const r of rows) {
    const street = normalizeStreet(r.addressStreet);
    canonical.add(street);
    const variant = parseAddress(r.situs)?.street;
    if (!variant) continue;
    let byStreet = votes.get(variant);
    if (!byStreet) votes.set(variant, (byStreet = new Map()));
    let geopins = byStreet.get(street);
    if (!geopins) byStreet.set(street, (geopins = new Set()));
    geopins.add(r.geopin);
  }

  const out: LearnedAlias[] = [];
  for (const [variant, byStreet] of votes) {
    if (canonical.has(variant)) continue;
    const ranked = [...byStreet].map(([street, g]) => ({ street, n: g.size })).sort((a, b) => b.n - a.n);
    const total = ranked.reduce((sum, r) => sum + r.n, 0);
    const top = ranked[0]!;
    if (top.n >= opts.minVotes && top.n / total >= opts.minShare) {
      out.push({ alias: variant, street: top.street, origin: "parcel-situs", votes: top.n });
    }
  }
  return out.sort((a, b) => b.votes - a.votes);
}
