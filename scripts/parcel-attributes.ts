// ABOUTME: Assigns each city parcel a representative point and its spatial attributes by point-in-polygon.
// ABOUTME: Reads data/raw/arcgis/*.geojson, writes data/derived/parcels.jsonl (rows shaped like the `parcel` table).
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { PolygonIndex, pointInGeometry, representativePoint, type PolygonGeometry } from "../packages/core/src/pip.js";

interface Feature { geometry: any; properties: Record<string, any> }
const load = (slug: string): Feature[] => JSON.parse(readFileSync(`data/raw/arcgis/${slug}.geojson`, "utf8")).features.filter((f: Feature) => f.geometry);
const clean = (v: unknown): string | null => {
  const s = v == null ? "" : String(v).trim();
  return s === "" ? null : s;
};
const indexOf = (slug: string) => new PolygonIndex<Record<string, any>>(load(slug).map((f) => ({ geom: f.geometry as PolygonGeometry, value: f.properties })));

const t0 = Date.now();
const now = new Date().toISOString();
const zoning = indexOf("zoning");
const overlays = indexOf("overlays");
const flu = indexOf("future_land_use");
const hdlc = indexOf("hdlc_districts");
const nr = indexOf("nr_districts");
const neighborhoods = indexOf("neighborhoods");
const council = indexOf("council_districts");
const wards = indexOf("wards");
const planning = indexOf("planning_districts");

// Partial-control districts that the city's solar review area definition includes anyway.
const SOLAR_PARTIAL_DISTRICTS = new Set(["Esplanade Ridge", "Tremé"]);

const parcels = load("parcels");
const landmarks = load("hdlc_landmarks");
const parcelIndex = new PolygonIndex<number>(parcels.map((f, i) => ({ geom: f.geometry as PolygonGeometry, value: i })));
const landmarkParcels = new Set<number>();
let landmarksUnmatched = 0;
for (const lm of landmarks) {
  const [x, y] = lm.geometry.coordinates;
  const hits = parcelIndex.query(x, y);
  if (hits.length === 0) landmarksUnmatched++;
  for (const h of hits) landmarkParcels.add(h);
}

const first = <T>(xs: T[]): T | undefined => xs[0];
const keys = ["situs", "lat", "acres", "zoning", "zoning_desc", "overlays", "future_land_use", "local_historic_district", "hdlc_control",
  "nr_district", "neighborhood", "council_district", "ward", "planning_district"] as const;
const nonNull: Record<string, number> = Object.fromEntries(keys.map((k) => [k, 0]));
let outside = 0, landmarkCount = 0, solarCount = 0, zoningMulti = 0, dupGeopin = 0;
const seen = new Set<number>();
const rows: string[] = [];

parcels.forEach((f, i) => {
  const p = f.properties;
  const geopin = Number(p.GEOPIN);
  if (!Number.isInteger(geopin) || seen.has(geopin)) { dupGeopin++; return; }
  seen.add(geopin);
  const geom = f.geometry as PolygonGeometry;
  const [lon, lat] = representativePoint(geom);
  if (!pointInGeometry(lon, lat, geom)) outside++;

  const z = zoning.query(lon, lat);
  if (z.length > 1) zoningMulti++;
  const ov = [...new Set(overlays.query(lon, lat).map((o) => clean(o.DESCRIPTION)).filter((s): s is string => !!s))].sort();
  // A point can sit in a Full and a Partial polygon of one district; Full wins.
  const districts = hdlc.query(lon, lat).sort((a, b) => Number(b.CONTROL === "Full") - Number(a.CONTROL === "Full"));
  const district = first(districts);
  const control = district ? (String(district.CONTROL).toLowerCase() === "full" ? "Full" : "Partial") : null;
  const isLandmark = landmarkParcels.has(i) ? 1 : 0;
  const solar = isLandmark || districts.some((d) => String(d.CONTROL).toLowerCase() === "full" || SOLAR_PARTIAL_DISTRICTS.has(d.NAME)) ? 1 : 0;
  const situs = [p.SITUS_NUMBER || null, p.SITUS_DIR, p.SITUS_STREET, p.SITUS_TYPE].map(clean).filter(Boolean).join(" ") || null;

  const row = {
    geopin, situs, lat, lon, acres: typeof p.ACRES === "number" ? p.ACRES : null,
    zoning: clean(first(z)?.ZONECLASS), zoning_desc: clean(first(z)?.ZONEDESC),
    overlays: ov.length ? JSON.stringify(ov) : null,
    future_land_use: clean(first(flu.query(lon, lat))?.FUTLANDUSE),
    local_historic_district: clean(district?.NAME), hdlc_control: control,
    nr_district: clean(first(nr.query(lon, lat))?.NAME),
    is_landmark: isLandmark, hdlc_solar_review: solar,
    flood_zone: null,
    neighborhood: clean(first(neighborhoods.query(lon, lat))?.GNOCDC_LAB),
    council_district: clean(first(council.query(lon, lat))?.DISTRICTID),
    ward: clean(first(wards.query(lon, lat))?.WARD),
    planning_district: clean(first(planning.query(lon, lat))?.DISTRICT_N),
    first_seen_at: now, last_seen_at: now, retired_at: null,
  };
  for (const k of keys) if ((row as Record<string, unknown>)[k] != null) nonNull[k]++;
  landmarkCount += isLandmark; solarCount += solar;
  const line = JSON.stringify(row);
  rows.push(line);
});

mkdirSync("data/derived", { recursive: true });
writeFileSync("data/derived/parcels.jsonl", rows.join("\n") + "\n");

const n = rows.length;
console.log(`parcels written: ${n} (skipped dup/invalid GEOPIN: ${dupGeopin})`);
for (const k of keys) console.log(`  ${k.padEnd(24)} ${((100 * nonNull[k]) / n).toFixed(2)}%`);
console.log(`  is_landmark=1            ${landmarkCount} parcels (${landmarks.length} landmark points, ${landmarksUnmatched} in no parcel)`);
console.log(`  hdlc_solar_review=1      ${solarCount} parcels`);
console.log(`representative points outside own polygon: ${outside}`);
console.log(`parcels whose point hit >1 zoning polygon: ${zoningMulti}`);
console.log(`runtime: ${((Date.now() - t0) / 1000).toFixed(1)}s`);
