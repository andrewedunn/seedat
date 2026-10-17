// ABOUTME: The match ladder: resolves one city record (address text, optional GEOPIN, tax bill, coordinates)
// ABOUTME: to a parcel, trying rungs in order and reporting which rung matched and how confident it is.
import type { AddressCandidate, AddressIndex } from "./index-types";
import { parseAddress, type ParsedAddress } from "./normalize";

export type MatchType =
  | "source_geopin" | "exact" | "base_address" | "range_member" | "alias"
  | "parcel_situs" | "fuzzy_street" | "tax_bill" | "nearest_point" | "unmatched";

export type UnmatchedReason = "unparseable" | "unknown_street" | "number_not_found" | "ambiguous" | "no_address";

export interface MatchInput {
  address: string | null;
  geopin?: string | number | null;   // a GEOPIN the source already carries
  taxBill?: string | null;           // permit `pin`
  lat?: number | null;
  lon?: number | null;
}

export interface MatchResult {
  geopin: number | null;
  addressId: number | null;
  matchType: MatchType;
  score: number;
  otherGeopins?: number[];           // further parcels named by a multi-address record
  reason?: UnmatchedReason;
}

const NEAREST_METERS = 30;

const unmatched = (reason: UnmatchedReason): MatchResult => ({ geopin: null, addressId: null, matchType: "unmatched", score: 0, reason });

function asGeopin(v: string | number | null | undefined): number | null {
  if (v == null || v === "") return null;
  const s = String(v).trim();
  return /^\d{8}$/.test(s) ? Number(s) : null;
}

/** Pick the address point for one number: exact unit, else the building's base address. */
function pickAddress(cands: AddressCandidate[], unit: string | null): { cand: AddressCandidate; exact: boolean } | "ambiguous" | null {
  if (cands.length === 0) return null;
  if (unit) {
    const u = cands.filter((c) => c.unitId === unit);
    if (u.length === 1) return { cand: u[0]!, exact: true };
  }
  const bases = cands.filter((c) => c.unitId === null);
  if (bases.length === 1) return { cand: bases[0]!, exact: !unit };
  const geopins = new Set(cands.map((c) => c.geopin));
  if (geopins.size === 1) return { cand: bases[0] ?? cands[0]!, exact: !unit && cands.length === 1 };
  return "ambiguous";
}

/** Rungs 1–3 on a resolved street: exact / base address for each number, then reconcile ranges. */
function matchOnStreet(p: ParsedAddress, street: string, index: AddressIndex): MatchResult | "ambiguous" | null {
  const hits: { cand: AddressCandidate; exact: boolean }[] = [];
  for (const n of p.numbers) {
    const pick = pickAddress(index.addressesAt(street, n), p.unit);
    if (pick === "ambiguous") return "ambiguous";
    if (pick) hits.push(pick);
  }
  if (hits.length === 0) return null;
  const first = hits[0]!.cand;
  if (p.numbers.length > 1) {
    const others = [...new Set(hits.map((h) => h.cand.geopin))].filter((g) => g !== first.geopin);
    return { geopin: first.geopin, addressId: first.addressId, matchType: "range_member", score: 0.95, ...(others.length ? { otherGeopins: others } : {}) };
  }
  const exact = hits[0]!.exact;
  return { geopin: first.geopin, addressId: first.addressId, matchType: exact ? "exact" : "base_address", score: exact ? 1 : 0.97 };
}

function matchSitus(p: ParsedAddress, street: string, index: AddressIndex): MatchResult | null {
  const geopins = [...new Set(p.numbers.flatMap((n) => index.parcelsAtSitus(street, n)))];
  return geopins.length >= 1
    ? { geopin: geopins[0]!, addressId: null, matchType: "parcel_situs", score: 0.9, ...(geopins.length > 1 ? { otherGeopins: geopins.slice(1) } : {}) }
    : null;
}

export function matchRecord(input: MatchInput, index: AddressIndex): MatchResult {
  // Rung 0: a GEOPIN the source already carries (or a permit pin that is really a GEOPIN).
  for (const g of [asGeopin(input.geopin), asGeopin(input.taxBill)]) {
    if (g !== null && index.hasParcel(g)) return { geopin: g, addressId: null, matchType: "source_geopin", score: 1 };
  }

  const parsed = input.address ? parseAddress(input.address) : null;
  let failure: UnmatchedReason = input.address ? "unparseable" : "no_address";
  let knownStreet: string | null = null;

  if (parsed) {
    const resolved = index.resolveStreet(parsed.street);
    if (resolved) {
      knownStreet = resolved.street;
      const onStreet = matchOnStreet(parsed, resolved.street, index);
      if (onStreet === "ambiguous") failure = "ambiguous";
      else if (onStreet) return resolved.via === "alias" ? { ...onStreet, matchType: "alias", score: Math.min(onStreet.score, 0.95) } : onStreet;
      else {
        const situs = matchSitus(parsed, resolved.street, index);
        if (situs) return situs;
        failure = "number_not_found";
      }
    } else {
      // Rung 6: a near-miss spelling of a street that has this house number.
      const maxD = parsed.street.length >= 8 ? 2 : 1;
      const similar = index.similarStreetsWithNumber(parsed.street, parsed.numbers[0]!, maxD);
      const best = similar[0];
      if (best && (similar.length === 1 || similar[1]!.distance > best.distance)) {
        const viaFuzzy = matchOnStreet(parsed, best.street, index);
        const hit = viaFuzzy && viaFuzzy !== "ambiguous" ? viaFuzzy : matchSitus(parsed, best.street, index);
        if (hit) return { ...hit, matchType: "fuzzy_street", score: best.distance === 1 ? 0.85 : 0.75 };
      }
      failure = "unknown_street";
    }
  }

  // Rung 7: learned assessor tax-bill crosswalk.
  if (input.taxBill) {
    const g = [...new Set(index.geopinsForTaxBill(input.taxBill.trim()))];
    if (g.length === 1) return { geopin: g[0]!, addressId: null, matchType: "tax_bill", score: 0.9 };
  }

  // Rung 8: nearest address point, which must not contradict a street we recognised.
  if (input.lat != null && input.lon != null && input.lat !== 0 && input.lon !== 0) {
    const near = index.nearestAddress(input.lat, input.lon, NEAREST_METERS);
    const streetOk = !parsed || (knownStreet !== null && near?.street === knownStreet);
    if (near && streetOk) {
      return { geopin: near.geopin, addressId: near.addressId, matchType: "nearest_point", score: Math.max(0.5, 0.85 - near.meters / 100) };
    }
  }

  return unmatched(failure);
}
