// ABOUTME: Downloads the city's parcel and spatial-attribute layers from maps.nola.gov as WGS84 GeoJSON.
// ABOUTME: Pages 2000 features at a time, at most one request per second; writes data/raw/arcgis/<slug>.geojson.
import { mkdirSync, writeFileSync } from "node:fs";

const BASE = "https://maps.nola.gov/server/rest/services";
const UA = "seedat-research/0.1 (+https://seedat.dunn.us; seedat@dunn.us)";
const PAGE = 2000;
const OUT = "data/raw/arcgis";

export const LAYERS: Record<string, string> = {
  parcels: "Assessor/Landbase_Layers/MapServer/0",
  zoning: "LandUsePlanning/Land_Use_Planning_Layers/MapServer/2",
  overlays: "LandUsePlanning/Land_Use_Planning_Layers/MapServer/1",
  future_land_use: "LandUsePlanning/Land_Use_Planning_Layers/MapServer/3",
  hdlc_landmarks: "Administrative/Historic_Preservation/MapServer/0",
  hdlc_districts: "Administrative/Historic_Preservation/MapServer/1",
  nr_districts: "Administrative/Historic_Preservation/MapServer/2",
  neighborhoods: "Reference/Reference_Layers/MapServer/0",
  council_districts: "Administrative/Administrative_Layers/MapServer/1",
  wards: "Administrative/Administrative_Layers/MapServer/3",
  planning_districts: "Administrative/Administrative_Layers/MapServer/4",
};

let last = 0;
async function get(url: string): Promise<any> {
  for (let attempt = 1; ; attempt++) {
    const wait = last + 1000 - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    last = Date.now();
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();
      if (body.error) throw new Error(JSON.stringify(body.error));
      return body;
    } catch (e) {
      if (attempt >= 4) throw e;
      console.error(`retry ${attempt} after: ${(e as Error).message}`);
    }
  }
}

async function downloadLayer(slug: string, path: string): Promise<void> {
  const features: unknown[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const q = new URLSearchParams({
      f: "geojson", outSR: "4326", where: "1=1", outFields: "*",
      orderByFields: "OBJECTID", resultOffset: String(offset), resultRecordCount: String(PAGE),
    });
    const page = await get(`${BASE}/${path}/query?${q}`);
    const got: unknown[] = page.features ?? [];
    features.push(...got);
    console.log(`${slug}: offset ${offset}, +${got.length}, total ${features.length}`);
    const more = page.exceededTransferLimit === true || page.properties?.exceededTransferLimit === true;
    if (got.length === 0 || (!more && got.length < PAGE)) break;
  }
  writeFileSync(`${OUT}/${slug}.geojson`, JSON.stringify({ type: "FeatureCollection", features }));
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const only = process.argv.slice(2);
  for (const [slug, path] of Object.entries(LAYERS)) {
    if (only.length && !only.includes(slug)) continue;
    await downloadLayer(slug, path);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
