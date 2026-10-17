// ABOUTME: Backfills the canonical geography into seedat-db: parcels (with precomputed map attributes), address
// ABOUTME: points, street dictionary and aliases, hundred-blocks, and the learned tax-bill crosswalk.
// Usage: npx tsx scripts/backfill-geography.ts [--load]   (without --load it only writes data/sql/geo-*.sql)
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cellOf } from "../packages/core/src/geo";
import { parseAddress } from "../packages/core/src/normalize";
import { insertSql } from "../packages/core/src/sql";
import { loadSqlFiles, writeSqlFiles } from "./lib/d1";
import { DATA, buildFullIndex, lamaPoints } from "./lib/raw";

const now = new Date().toISOString();
const { index, aliases, taxBills } = buildFullIndex();

const parcels = readFileSync(join(DATA, "derived", "parcels.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l));
const parcelById = new Map(parcels.map((p) => [p.geopin, p]));
const PARCEL_COLS = Object.keys(parcels[0]);

const addressRowsAll = lamaPoints().flatMap((a) => {
  const p = parseAddress(a.fullAddress);
  if (!p || a.lat == null || a.lon == null) return [];
  const n = p.numbers[0]!;
  return [{
    address_id: a.addressId, site_address_id: a.siteAddressId, geopin: a.geopin != null && parcelById.has(a.geopin) ? a.geopin : null,
    full_address: a.fullAddress, number: n, number_suffix: p.suffix, street_key: p.street,
    unit_type: a.unitType, unit_id: a.unitId, status: a.status, zip: a.zip, lat: a.lat, lon: a.lon,
    cell: cellOf(a.lat, a.lon), block_id: `${Math.floor(n / 100) * 100} ${p.street}`,
  }];
});

const addressRows = [...new Map(addressRowsAll.map((a) => [a.address_id, a])).values()];
console.log(`address points: ${addressRowsAll.length}, distinct ids ${addressRows.length}`);

const blocks = new Map<string, { street_key: string; block_number: number; lat: number; lon: number; n: number; hoods: Map<string, number>; councils: Map<string, number> }>();
for (const a of addressRows) {
  const b = blocks.get(a.block_id) ?? { street_key: a.street_key, block_number: Math.floor(a.number / 100) * 100, lat: 0, lon: 0, n: 0, hoods: new Map(), councils: new Map() };
  b.lat += a.lat; b.lon += a.lon; b.n++;
  const parcel = a.geopin ? parcelById.get(a.geopin) : null;
  if (parcel?.neighborhood) b.hoods.set(parcel.neighborhood, (b.hoods.get(parcel.neighborhood) ?? 0) + 1);
  if (parcel?.council_district) b.councils.set(parcel.council_district, (b.councils.get(parcel.council_district) ?? 0) + 1);
  blocks.set(a.block_id, b);
}
const top = (m: Map<string, number>) => [...m].sort((x, y) => y[1] - x[1])[0]?.[0] ?? null;
const blockRows = [...blocks].map(([block_id, b]) => ({
  block_id, street_key: b.street_key, block_number: b.block_number, lat: b.lat / b.n, lon: b.lon / b.n,
  neighborhood: top(b.hoods), council_district: top(b.councils),
}));

const aliasRows = [
  ...index.canonicalStreets().map((s) => ({ alias_key: s, street_key: s, origin: "canonical", votes: null })),
  ...aliases.filter((a) => !index.resolveStreet(a.alias) || index.resolveStreet(a.alias)?.via === "alias")
    .map((a) => ({ alias_key: a.alias, street_key: a.street, origin: a.origin, votes: a.votes })),
];
const dedupAliases = [...new Map(aliasRows.map((r) => [r.alias_key, r])).values()];
const situsRows = [...new Map(parcels.flatMap((p) => {
  const parsed = p.situs ? parseAddress(p.situs) : null;
  return parsed ? parsed.numbers.map((n) => ({ street_key: parsed.street, number: n, geopin: p.geopin })) : [];
}).map((r) => [`${r.street_key}|${r.number}|${r.geopin}`, r])).values()];
const taxRows = taxBills.filter((t) => parcelById.has(t.geopin)).map((t) => ({ tax_bill: t.taxBill, geopin: t.geopin, evidence: t.evidence }));

const statements = [
  "DELETE FROM parcel_situs;", "DELETE FROM tax_bill_geopin;", "DELETE FROM street_alias;", "DELETE FROM block;", "DELETE FROM address;", "DELETE FROM parcel;",
  ...insertSql("parcel", PARCEL_COLS, parcels, { chunk: 200 }),
  ...insertSql("address", Object.keys(addressRows[0]!), addressRows, { chunk: 300 }),
  ...insertSql("block", Object.keys(blockRows[0]!), blockRows, { chunk: 500 }),
  ...insertSql("street_alias", ["alias_key", "street_key", "origin", "votes"], dedupAliases, { chunk: 500 }),
  ...insertSql("parcel_situs", ["street_key", "number", "geopin"], situsRows, { chunk: 1000 }),
  ...insertSql("tax_bill_geopin", ["tax_bill", "geopin", "evidence"], taxRows, { chunk: 500 }),
  `INSERT INTO source (source_id, name, url, license, cadence, last_pulled_at, last_success_at, last_row_count) VALUES
    ('arcgis:Assessor/Landbase_Layers/0', 'City parcels', 'https://maps.nola.gov/server/rest/services/Assessor/Landbase_Layers/MapServer/0', 'City of New Orleans open data', 'weekly', '${now}', '${now}', ${parcels.length}),
    ('arcgis:Addresses/Site_Address_Point_LAMA/0', 'Site address points (LAMA)', 'https://maps.nola.gov/server/rest/services/Addresses/Site_Address_Point_LAMA/MapServer/0', 'City of New Orleans open data', 'weekly', '${now}', '${now}', ${addressRows.length})
    ON CONFLICT (source_id) DO UPDATE SET last_pulled_at = excluded.last_pulled_at, last_success_at = excluded.last_success_at, last_row_count = excluded.last_row_count;`,
];
console.log(`rows: parcel ${parcels.length}, address ${addressRows.length}, block ${blockRows.length}, street_alias ${dedupAliases.length}, parcel_situs ${situsRows.length}, tax_bill_geopin ${taxRows.length}`);
const files = writeSqlFiles("geo", statements);
console.log(`wrote ${files.length} SQL files`);
if (process.argv.includes("--load")) loadSqlFiles(files);
