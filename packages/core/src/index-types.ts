// ABOUTME: The lookup interface the match ladder needs, so the same matcher runs on an in-memory index
// ABOUTME: (batch backfill) or a D1-backed index (nightly incremental loads in a Worker).

export interface AddressCandidate {
  addressId: number;
  geopin: number;
  street: string;          // canonical street key
  number: number;
  unitId: string | null;   // normalized unit id, e.g. "409"
}

export interface AddressIndex {
  /** Does this GEOPIN exist in the parcel layer? */
  hasParcel(geopin: number): boolean;
  /** Canonical street key for a normalized street, or null if unknown. `via` says how it resolved. */
  resolveStreet(street: string): { street: string; via: "canonical" | "alias" } | null;
  /** Address points at this number on this canonical street. */
  addressesAt(street: string, number: number): AddressCandidate[];
  /** Parcels whose own situs address is this number on this street. */
  parcelsAtSitus(street: string, number: number): number[];
  /** Canonical streets within `maxDistance` edits of `street` that have an address or parcel at `number`. */
  similarStreetsWithNumber(street: string, number: number, maxDistance: number): { street: string; distance: number }[];
  /** GEOPINs our learned crosswalk associates with an assessor tax-bill number. */
  geopinsForTaxBill(taxBill: string): number[];
  /** Nearest address point within `maxMeters`, with its distance. */
  nearestAddress(lat: number, lon: number, maxMeters: number): (AddressCandidate & { meters: number }) | null;
}
