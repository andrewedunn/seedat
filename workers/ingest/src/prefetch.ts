// ABOUTME: Builds a small in-memory AddressIndex for one batch of records by prefetching from D1 only the rows
// ABOUTME: those records could match (addresses on their streets, situs, tax bills, nearby cells), so a Worker can run the matcher.
import { cellsAround } from "@seedat/core/src/geo";
import type { MatchInput } from "@seedat/core/src/match";
import { MemoryIndex, type AddressPointInput } from "@seedat/core/src/memory-index";
import { parseAddress } from "@seedat/core/src/normalize";

const PARAM_BYTES = 80_000;   // keep each JSON parameter well under D1's 100 KB statement limit

/** Split values into JSON arrays that each fit in one bound parameter. */
export function jsonChunks(values: unknown[]): string[] {
  const out: string[] = [];
  let cur: unknown[] = [], size = 2;
  for (const v of values) {
    const s = JSON.stringify(v).length + 1;
    if (cur.length && size + s > PARAM_BYTES) { out.push(JSON.stringify(cur)); cur = []; size = 2; }
    cur.push(v); size += s;
  }
  if (cur.length) out.push(JSON.stringify(cur));
  return out;
}

/** Run `sql` (with one `?` bound to a JSON array) over all chunks of `values` and concatenate the results. */
export async function allChunks<T>(db: D1Database, sql: string, values: unknown[]): Promise<T[]> {
  if (!values.length) return [];
  const results = await db.batch(jsonChunks(values).map((c) => db.prepare(sql).bind(c)));
  return results.flatMap((r) => r.results as T[]);
}

interface Dictionary { index: MemoryIndex; streets: string[]; aliases: { alias: string; street: string; origin: string }[] }
let dictionary: Promise<Dictionary> | null = null;

/** Street dictionary and aliases (about 2,600 rows), cached for the life of the isolate. */
function loadDictionary(db: D1Database): Promise<Dictionary> {
  dictionary ??= (async () => {
    const rows = (await db.prepare("SELECT alias_key, street_key, origin FROM street_alias").all<{ alias_key: string; street_key: string; origin: string }>()).results;
    const streets = rows.filter((r) => r.origin === "canonical").map((r) => r.street_key);
    const aliases = rows.filter((r) => r.origin !== "canonical").map((r) => ({ alias: r.alias_key, street: r.street_key, origin: r.origin }));
    return { index: new MemoryIndex({ addresses: [], parcels: [], streets, aliases }), streets, aliases };
  })();
  return dictionary;
}

interface AddressRow { address_id: number; geopin: number | null; street_key: string; number: number; unit_id: string | null; lat: number; lon: number }

export async function prefetchIndex(db: D1Database, inputs: MatchInput[]): Promise<MemoryIndex> {
  const dict = await loadDictionary(db);
  const pairs = new Map<string, { s: string; n: number }>();
  const fuzzyNumbers = new Set<number>();
  const taxBills = new Set<string>();
  const cells = new Set<string>();
  const geopins = new Set<number>();

  for (const input of inputs) {
    for (const g of [input.geopin, input.taxBill]) if (g != null && /^\d{8}$/.test(String(g).trim())) geopins.add(Number(g));
    if (input.taxBill) taxBills.add(input.taxBill.trim());
    if (input.lat != null && input.lon != null && input.lat !== 0) for (const c of cellsAround(input.lat, input.lon)) cells.add(c);
    const p = input.address ? parseAddress(input.address) : null;
    if (!p) continue;
    const resolved = dict.index.resolveStreet(p.street);
    if (resolved) for (const n of p.numbers) pairs.set(`${resolved.street}|${n}`, { s: resolved.street, n });
    else fuzzyNumbers.add(p.numbers[0]!);
  }

  const addrCols = "a.address_id, a.geopin, a.street_key, a.number, a.unit_id, a.lat, a.lon";
  const [byPair, byNumber, byCell, situsPairs, situsNumbers, bills, known] = await Promise.all([
    allChunks<AddressRow>(db, `SELECT ${addrCols} FROM json_each(?) j JOIN address a ON a.street_key = json_extract(j.value, '$.s') AND a.number = json_extract(j.value, '$.n')`, [...pairs.values()]),
    allChunks<AddressRow>(db, `SELECT ${addrCols} FROM address a WHERE a.number IN (SELECT value FROM json_each(?))`, [...fuzzyNumbers]),
    allChunks<AddressRow>(db, `SELECT ${addrCols} FROM address a WHERE a.cell IN (SELECT value FROM json_each(?))`, [...cells]),
    allChunks<{ street_key: string; number: number; geopin: number }>(db, "SELECT s.street_key, s.number, s.geopin FROM json_each(?) j JOIN parcel_situs s ON s.street_key = json_extract(j.value, '$.s') AND s.number = json_extract(j.value, '$.n')", [...pairs.values()]),
    allChunks<{ street_key: string; number: number; geopin: number }>(db, "SELECT street_key, number, geopin FROM parcel_situs WHERE number IN (SELECT value FROM json_each(?))", [...fuzzyNumbers]),
    allChunks<{ tax_bill: string; geopin: number }>(db, "SELECT tax_bill, geopin FROM tax_bill_geopin WHERE tax_bill IN (SELECT value FROM json_each(?))", [...taxBills]),
    allChunks<{ geopin: number }>(db, "SELECT geopin FROM parcel WHERE geopin IN (SELECT value FROM json_each(?))", [...geopins]),
  ]);

  const addresses: AddressPointInput[] = [...new Map([...byPair, ...byNumber, ...byCell].map((a) => [a.address_id, a])).values()]
    .map((a) => ({ addressId: a.address_id, geopin: a.geopin, fullAddress: "", streetKey: a.street_key, number: a.number, unitType: null, unitId: a.unit_id, lat: a.lat, lon: a.lon }));

  return new MemoryIndex({
    addresses, parcels: [], streets: dict.streets, aliases: dict.aliases,
    situs: [...situsPairs, ...situsNumbers].map((s) => ({ streetKey: s.street_key, number: s.number, geopin: s.geopin })),
    taxBills: bills.map((b) => ({ taxBill: b.tax_bill, geopin: b.geopin })),
    knownParcels: known.map((k) => k.geopin),
  });
}
