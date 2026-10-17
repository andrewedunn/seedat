// ABOUTME: Helpers for batch scripts: read downloaded raw pages from data/raw and build the full matching index.
// ABOUTME: Shared by the backfill and the match-rate measurement so both use identical inputs.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { aliasesFromCoordinates, aliasesFromSitus, learnTaxBills, type TaxBillLink } from "../../packages/core/src/learn";
import type { LearnedAlias } from "../../packages/core/src/aliases";
import { MemoryIndex, type AddressPointInput, type ParcelInput } from "../../packages/core/src/memory-index";
import { statePlaneToLatLon } from "../../packages/core/src/projection";
import { hash53 } from "../../packages/core/src/sources/helpers";

export const DATA = join(import.meta.dirname, "..", "..", "data");
export const RAW = join(DATA, "raw");

/** All rows from data/raw/<dir>/*.json, accepting Socrata arrays or ArcGIS {features: [...]} pages. */
export function pages(dir: string): any[] {
  return readdirSync(join(RAW, dir)).filter((f) => f.endsWith(".json")).sort()
    .flatMap((f) => { const j = JSON.parse(readFileSync(join(RAW, dir, f), "utf8")); return Array.isArray(j) ? j : j.features; });
}

/** Stable address id: the city's SITEADDID is not unique, so hash it with the address text and unit. */
export const addressIdFor = (siteAddId: unknown, fullAddress: unknown, unitId: unknown) =>
  hash53(`${siteAddId}|${fullAddress ?? ""}|${unitId ?? ""}`);

export function lamaPoints(): (AddressPointInput & { siteAddressId: number; streetName: string | null; status: string | null; zip: string | null })[] {
  return pages("lama").map((f) => {
    const a = f.attributes ?? f;
    return {
      addressId: addressIdFor(a.SITEADDID, a.FULLADDR, a.UNITID), siteAddressId: Number(a.SITEADDID), geopin: a.GEOPIN ? Number(a.GEOPIN) : null, fullAddress: a.FULLADDR ?? "",
      unitType: a.UNITTYPE ?? null, unitId: a.UNITID ?? null, lat: f.geometry?.y ?? null, lon: f.geometry?.x ?? null,
      streetName: a.FULLNAME ?? null, status: a.STATUS ?? null, zip: a.ZCTA5CE10 ?? null,
    };
  });
}

export function parcelSitus(): ParcelInput[] {
  return pages("parcels").map((f) => {
    const p = f.attributes ?? f;
    return { geopin: Number(p.GEOPIN), situs: [p.SITUS_NUMBER, p.SITUS_DIR, p.SITUS_STREET, p.SITUS_TYPE].filter(Boolean).join(" ") || null };
  });
}

export interface FullIndex { index: MemoryIndex; aliases: LearnedAlias[]; taxBills: TaxBillLink[]; crosswalkStats: { seen: number; conflicting: number } }

/** Build the index in three passes: situs aliases, then coordinate aliases, then the tax-bill crosswalk. */
export function buildFullIndex(log = console.log): FullIndex {
  const addresses = lamaPoints();
  const parcels = parcelSitus();
  const situsByGeopin = new Map(parcels.filter((p) => p.situs).map((p) => [p.geopin, p.situs!]));
  const situsAliases = aliasesFromSitus(addresses, situsByGeopin);
  const first = new MemoryIndex({ addresses, parcels, aliases: situsAliases });
  const coordAliases = aliasesFromCoordinates(first, [
    ...pages("str").map((r) => ({ address: r.address, lat: Number(r.latitude) || null, lon: Number(r.longitude) || null })),
    ...pages("code").map((r) => ({ address: r.location, ...(statePlaneToLatLon(r.xpos, r.ypos) ?? { lat: null, lon: null }) })),
  ]);
  const aliases = [...situsAliases, ...coordAliases];
  const textIndex = new MemoryIndex({ addresses, parcels, aliases });
  const crosswalk = learnTaxBills(textIndex, pages("permits").map((r) => ({ address: r.originaladdress1, taxBill: r.pin ?? null })));
  log(`index: ${addresses.length} address points, ${parcels.length} parcels, ${situsAliases.length}+${coordAliases.length} aliases, ${crosswalk.links.length} tax bills (${crosswalk.conflicting} conflicting)`);
  return {
    index: new MemoryIndex({ addresses, parcels, aliases, taxBills: crosswalk.links }),
    aliases, taxBills: crosswalk.links, crosswalkStats: { seen: crosswalk.seen, conflicting: crosswalk.conflicting },
  };
}
