// ABOUTME: Measures the match ladder on real downloaded data (data/raw) and prints the rung distribution per source.
// ABOUTME: Usage: npx tsx scripts/measure-match.ts [sampleSize]
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { learnStreetAliases } from "../packages/core/src/aliases";
import { matchRecord, type MatchInput } from "../packages/core/src/match";
import { MemoryIndex } from "../packages/core/src/memory-index";
import { parseAddress } from "../packages/core/src/normalize";
import { statePlaneToLatLon } from "../packages/core/src/projection";

const RAW = join(import.meta.dirname, "..", "data", "raw");
const pages = (dir: string): any[] =>
  readdirSync(join(RAW, dir)).filter((f) => f.endsWith(".json")).sort()
    .flatMap((f) => { const j = JSON.parse(readFileSync(join(RAW, dir, f), "utf8")); return Array.isArray(j) ? j : j.features; });

const lama = pages("lama").map((f) => f.attributes ? { ...f.attributes, x: f.geometry?.x, y: f.geometry?.y } : f);
const parcels = pages("parcels").map((f) => f.attributes ?? f);
const situs = (p: any) => [p.SITUS_NUMBER, p.SITUS_DIR, p.SITUS_STREET, p.SITUS_TYPE].filter(Boolean).join(" ");

const situsByGeopin = new Map(parcels.map((p) => [Number(p.GEOPIN), situs(p)]));
const aliases = learnStreetAliases(
  lama.filter((a) => a.GEOPIN && a.FULLNAME && situsByGeopin.has(Number(a.GEOPIN)))
    .map((a) => ({ geopin: Number(a.GEOPIN), addressStreet: a.FULLNAME, situs: situsByGeopin.get(Number(a.GEOPIN))! })),
  { minVotes: 3, minShare: 0.8 },
);
console.log(`learned ${aliases.length} aliases; top:`, aliases.slice(0, 8).map((a) => `${a.alias} → ${a.street} (${a.votes})`).join("; "));

const addresses = lama.map((a) => ({ addressId: Number(a.SITEADDID), geopin: a.GEOPIN ? Number(a.GEOPIN) : null, fullAddress: a.FULLADDR ?? "",
  unitType: a.UNITTYPE, unitId: a.UNITID, lat: a.y ?? null, lon: a.x ?? null }));
const parcelInputs = parcels.map((p) => ({ geopin: Number(p.GEOPIN), situs: situs(p) }));
const firstPass = new MemoryIndex({ addresses, parcels: parcelInputs, aliases });

// Second alias source: records with coordinates. The nearest address point's street says what an unknown name means.
const strAll = pages("str");
const codeAll = pages("code");
const coordRows = [
  ...strAll.map((r) => ({ address: r.address, lat: Number(r.latitude), lon: Number(r.longitude) })),
  ...codeAll.map((r) => ({ address: r.location, ...(statePlaneToLatLon(r.xpos, r.ypos) ?? { lat: NaN, lon: NaN }) })),
].flatMap((r, i) => {
  const p = r.address ? parseAddress(r.address) : null;
  if (!p || !Number.isFinite(r.lat) || firstPass.resolveStreet(p.street)) return [];
  const near = firstPass.nearestAddress(r.lat, r.lon, 25);
  return near ? [{ geopin: i, addressStreet: near.street, situs: r.address }] : [];
});
const coordAliases = learnStreetAliases(coordRows, { minVotes: 3, minShare: 0.8 });
console.log(`learned ${coordAliases.length} aliases from coordinates; top:`, coordAliases.slice(0, 12).map((a) => `${a.alias} → ${a.street} (${a.votes})`).join("; "));

const textIndex = new MemoryIndex({ addresses, parcels: parcelInputs, aliases: [...aliases, ...coordAliases] });

// Learn the tax-bill -> GEOPIN crosswalk from every permit we can place without it.
const permitAll = pages("permits");
const votes = new Map<string, Map<number, number>>();
for (const r of permitAll) {
  const bills = String(r.pin ?? "").split(",").map((b: string) => b.trim()).filter((b: string) => b && !/^\d{8}$/.test(b));
  if (bills.length !== 1) continue;
  const m = matchRecord({ address: r.originaladdress1 }, textIndex);
  if (!m.geopin || m.otherGeopins) continue;
  const byGeopin = votes.get(bills[0]!) ?? new Map<number, number>();
  byGeopin.set(m.geopin, (byGeopin.get(m.geopin) ?? 0) + 1);
  votes.set(bills[0]!, byGeopin);
}
const taxBills = [...votes].flatMap(([taxBill, byGeopin]) => {
  const ranked = [...byGeopin].sort((a, b) => b[1] - a[1]);
  const total = ranked.reduce((s, [, n]) => s + n, 0);
  return ranked[0]![1] / total >= 0.8 ? [{ taxBill, geopin: ranked[0]![0], evidence: ranked[0]![1] }] : [];
});
console.log(`learned tax-bill crosswalk: ${taxBills.length} tax bills -> GEOPIN (from ${votes.size} seen; ${votes.size - taxBills.length} conflicting)`);

const index = new MemoryIndex({ addresses, parcels: parcelInputs, aliases: [...aliases, ...coordAliases], taxBills });

const N = Number(process.argv[2] ?? 20000);
function sample<T>(xs: T[], n: number): T[] {
  let seed = 7; const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
  const copy = [...xs]; for (let i = copy.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [copy[i], copy[j]] = [copy[j]!, copy[i]!]; }
  return copy.slice(0, n);
}

function report(name: string, inputs: MatchInput[], raws: string[]) {
  const counts = new Map<string, number>(); const misses: string[] = [];
  inputs.forEach((inp, i) => {
    const m = matchRecord(inp, index);
    const k = m.matchType === "unmatched" ? `unmatched:${m.reason}` : m.matchType;
    counts.set(k, (counts.get(k) ?? 0) + 1);
    if (m.matchType === "unmatched" && misses.length < 25) misses.push(`${m.reason}: ${raws[i]}`);
  });
  const matched = inputs.length - [...counts].filter(([k]) => k.startsWith("unmatched")).reduce((s, [, v]) => s + v, 0);
  console.log(`\n${name}: ${inputs.length} records, matched ${(100 * matched / inputs.length).toFixed(1)}%`);
  for (const [k, v] of [...counts].sort((a, b) => b[1] - a[1])) console.log(`  ${k.padEnd(28)} ${String(v).padStart(6)}  ${(100 * v / inputs.length).toFixed(1)}%`);
  console.log("  sample misses:\n    " + misses.join("\n    "));
}

// Coordinates for BLDS permits come from the other two permit datasets, joined on permit number.
const coords = new Map<string, { lat: number; lon: number }>();
for (const r of pages("permits_rcm3")) {
  const lat = Number(r.location_1?.latitude), lon = Number(r.location_1?.longitude);
  if (r.numstring && lat && lon) coords.set(r.numstring, { lat, lon });
}
for (const r of pages("permits_aib5")) {
  const lat = Number(r.latitude), lon = Number(r.longitude);
  if (r.permitnumber && lat && lon && !coords.has(r.permitnumber)) coords.set(r.permitnumber, { lat, lon });
}
const permits = sample(permitAll, N);
console.log(`\npermits with coordinates from rcm3/aib5: ${permits.filter((r) => coords.has(r.permitnum)).length} of ${permits.length}`);
report("permits (BLDS + coordinates)", permits.map((r) => ({ address: r.originaladdress1, taxBill: r.pin?.split(",")[0], ...coords.get(r.permitnum) })), permits.map((r) => `${r.originaladdress1} | pin ${r.pin}`));
const strs = sample(strAll, N);
report("STR applications", strs.map((r) => ({ address: r.address, lat: Number(r.latitude) || null, lon: Number(r.longitude) || null })), strs.map((r) => r.address));
const cases = sample(codeAll, N);
report("code cases", cases.map((r) => ({ address: r.location, geopin: r.geopin, ...statePlaneToLatLon(r.xpos, r.ypos) })), cases.map((r) => `${r.location} | geopin ${r.geopin}`));
