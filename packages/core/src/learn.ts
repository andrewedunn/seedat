// ABOUTME: Builds the learned lookup tables from city data: street aliases (from parcel situs and from records
// ABOUTME: with coordinates) and the assessor tax-bill -> GEOPIN crosswalk (from permits placed by address).
import { learnStreetAliases, type LearnedAlias } from "./aliases";
import type { AddressIndex } from "./index-types";
import { matchRecord } from "./match";
import { parseAddress } from "./normalize";

const LEARN_OPTS = { minVotes: 3, minShare: 0.8 };

/** Aliases from parcels whose situs street disagrees with the address points on the same GEOPIN. */
export function aliasesFromSitus(
  addressPoints: { geopin: number | null; streetName: string | null }[],
  situsByGeopin: Map<number, string>,
): LearnedAlias[] {
  const rows = addressPoints.flatMap((a) => {
    const situs = a.geopin != null ? situsByGeopin.get(a.geopin) : undefined;
    return a.streetName && situs ? [{ geopin: a.geopin!, addressStreet: a.streetName, situs }] : [];
  });
  return learnStreetAliases(rows, LEARN_OPTS);
}

/** Aliases from records with coordinates whose street is unknown: the nearest address point's street votes. */
export function aliasesFromCoordinates(
  index: AddressIndex,
  records: { address: string | null; lat: number | null; lon: number | null }[],
  maxMeters = 25,
): LearnedAlias[] {
  const rows = records.flatMap((r, i) => {
    const p = r.address ? parseAddress(r.address) : null;
    if (!p || r.lat == null || r.lon == null || !Number.isFinite(r.lat) || index.resolveStreet(p.street)) return [];
    const near = index.nearestAddress(r.lat, r.lon, maxMeters);
    return near ? [{ geopin: i, addressStreet: near.street, situs: r.address! }] : [];
  });
  return learnStreetAliases(rows, { ...LEARN_OPTS, origin: "coordinates" });
}

export interface TaxBillLink { taxBill: string; geopin: number; evidence: number }

/**
 * The crosswalk nobody publishes: for permits with exactly one tax-bill number that we can place by address
 * (without using the crosswalk itself), count which parcel each tax bill lands on. Keep bills where at least
 * `minShare` of placements agree.
 */
export function learnTaxBills(
  index: AddressIndex,
  permits: { address: string | null; taxBill: string | null }[],
  minShare = 0.8,
): { links: TaxBillLink[]; seen: number; conflicting: number } {
  const votes = new Map<string, Map<number, number>>();
  for (const p of permits) {
    const bills = String(p.taxBill ?? "").split(",").map((b) => b.trim()).filter((b) => b && !/^\d{8}$/.test(b));
    if (bills.length !== 1 || !p.address) continue;
    const m = matchRecord({ address: p.address }, index);
    if (!m.geopin || m.otherGeopins || m.matchType === "nearest_point") continue;
    const byGeopin = votes.get(bills[0]!) ?? new Map<number, number>();
    byGeopin.set(m.geopin, (byGeopin.get(m.geopin) ?? 0) + 1);
    votes.set(bills[0]!, byGeopin);
  }
  const links: TaxBillLink[] = [];
  for (const [taxBill, byGeopin] of votes) {
    const ranked = [...byGeopin].sort((a, b) => b[1] - a[1]);
    const total = ranked.reduce((s, [, n]) => s + n, 0);
    if (ranked[0]![1] / total >= minShare) links.push({ taxBill, geopin: ranked[0]![0], evidence: ranked[0]![1] });
  }
  return { links, seen: votes.size, conflicting: votes.size - links.length };
}
