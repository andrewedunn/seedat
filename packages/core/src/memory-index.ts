// ABOUTME: In-memory AddressIndex built from address points, parcels, street aliases and the tax-bill crosswalk.
// ABOUTME: Used by the batch backfill (Node) and by tests; the nightly Worker uses the D1-backed index.
import { cellOf, cellsAround, editDistance, metersBetween } from "./geo";
import type { AddressCandidate, AddressIndex } from "./index-types";
import { STREET_TYPE_ABBRS, normalizeStreet, parseAddress } from "./normalize";

export interface AddressPointInput {
  addressId: number; geopin: number | null; fullAddress: string;
  unitType: string | null; unitId: string | null; lat: number | null; lon: number | null;
}
export interface ParcelInput { geopin: number; situs: string | null }
export interface AliasInput { alias: string; street: string; origin: string }
export interface TaxBillInput { taxBill: string; geopin: number }

type Located = AddressCandidate & { lat: number; lon: number };

const key = (street: string, n: number) => `${street}|${n}`;

/** "SAINT CLAUDE AVE" -> "SAINT CLAUDE"; "INTERSTATE 10 SERVICE RD N" -> "INTERSTATE 10 SERVICE N". */
function withoutType(street: string): string {
  return street.split(" ").filter((t, i, all) => !(i > 0 && i >= all.length - 2 && STREET_TYPE_ABBRS.has(t))).join(" ");
}

export class MemoryIndex implements AddressIndex {
  private parcels = new Set<number>();
  private streets = new Set<string>();
  private aliases = new Map<string, string>();
  private byAddress = new Map<string, AddressCandidate[]>();
  private bySitus = new Map<string, number[]>();
  private numbersByStreet = new Map<string, Set<number>>();
  private byCell = new Map<string, Located[]>();
  private taxBills = new Map<string, number[]>();
  private byNameOnly: Map<string, Set<string>> | null = null;

  constructor(input: { addresses: AddressPointInput[]; parcels: ParcelInput[]; aliases?: AliasInput[]; taxBills?: TaxBillInput[] }) {
    for (const p of input.parcels) {
      this.parcels.add(p.geopin);
      const parsed = p.situs ? parseAddress(p.situs) : null;
      if (!parsed) continue;
      this.streets.add(parsed.street);
      for (const n of parsed.numbers) this.push(this.bySitus, key(parsed.street, n), p.geopin);
      this.noteNumber(parsed.street, parsed.numbers);
    }
    for (const a of input.addresses) {
      if (a.geopin == null) continue;
      const parsed = parseAddress(a.fullAddress);
      if (!parsed) continue;
      const cand: AddressCandidate = {
        addressId: a.addressId, geopin: a.geopin, street: parsed.street,
        number: parsed.numbers[0]!, unitId: a.unitId ? a.unitId.toUpperCase() : null,
      };
      this.streets.add(parsed.street);
      this.push(this.byAddress, key(cand.street, cand.number), cand);
      this.noteNumber(cand.street, [cand.number]);
      if (a.lat != null && a.lon != null) this.push(this.byCell, cellOf(a.lat, a.lon), { ...cand, lat: a.lat, lon: a.lon });
    }
    for (const al of input.aliases ?? []) {
      const from = normalizeStreet(al.alias), to = normalizeStreet(al.street);
      if (from !== to && !this.streets.has(from)) this.aliases.set(from, to);
    }
    for (const t of input.taxBills ?? []) this.push(this.taxBills, t.taxBill, t.geopin);
  }

  private push<K, V>(m: Map<K, V[]>, k: K, v: V) {
    const list = m.get(k);
    if (list) list.push(v); else m.set(k, [v]);
  }

  private noteNumber(street: string, numbers: number[]) {
    let s = this.numbersByStreet.get(street);
    if (!s) this.numbersByStreet.set(street, (s = new Set()));
    for (const n of numbers) s.add(n);
  }

  hasParcel(geopin: number) { return this.parcels.has(geopin); }

  /** Every canonical street key, for writing the street dictionary. */
  canonicalStreets(): string[] { return [...this.streets].sort(); }

  resolveStreet(street: string) {
    if (this.streets.has(street)) return { street, via: "canonical" as const };
    const to = this.aliases.get(street);
    if (to && this.streets.has(to)) return { street: to, via: "alias" as const };
    // "1720 DUFOSSAT": no street type (or the wrong one), but only one street has that name.
    const named = this.namesWithoutType().get(withoutType(street));
    return named && named.size === 1 ? { street: [...named][0]!, via: "alias" as const } : null;
  }

  private namesWithoutType() {
    if (!this.byNameOnly) {
      this.byNameOnly = new Map();
      for (const s of this.streets) {
        const k = withoutType(s);
        let set = this.byNameOnly.get(k);
        if (!set) this.byNameOnly.set(k, (set = new Set()));
        set.add(s);
      }
    }
    return this.byNameOnly;
  }

  addressesAt(street: string, n: number) { return this.byAddress.get(key(street, n)) ?? []; }
  parcelsAtSitus(street: string, n: number) { return this.bySitus.get(key(street, n)) ?? []; }
  geopinsForTaxBill(taxBill: string) { return this.taxBills.get(taxBill) ?? []; }

  similarStreetsWithNumber(street: string, n: number, maxDistance: number) {
    const out: { street: string; distance: number }[] = [];
    for (const [s, nums] of this.numbersByStreet) {
      if (!nums.has(n) || s === street) continue;
      const d = editDistance(street, s, maxDistance);
      if (d <= maxDistance) out.push({ street: s, distance: d });
    }
    return out.sort((a, b) => a.distance - b.distance);
  }

  nearestAddress(lat: number, lon: number, maxMeters: number) {
    let best: (Located & { meters: number }) | null = null;
    for (const c of cellsAround(lat, lon)) {
      for (const a of this.byCell.get(c) ?? []) {
        const m = metersBetween(lat, lon, a.lat, a.lon);
        if (m <= maxMeters && (!best || m < best.meters)) best = { ...a, meters: m };
      }
    }
    return best;
  }
}
