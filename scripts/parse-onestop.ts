// ABOUTME: Parses every data/raw/onestop/*.html.gz crawl page and prints counts plus two example parsed objects.
// ABOUTME: Usage: npx tsx scripts/parse-onestop.ts
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { detailToEvents, parseOneStopDetail, type OneStopDetail } from "../packages/core/src/onestop";

const DIR = join(import.meta.dirname, "..", "data", "raw", "onestop");
const files = readdirSync(DIR).filter((f) => f.endsWith(".html.gz")).sort();

const parsed: OneStopDetail[] = files.map((f) =>
  parseOneStopDetail(gunzipSync(readFileSync(join(DIR, f))).toString("utf8"), Number(f.replace(".html.gz", ""))),
);

const events = parsed.reduce((n, d) => n + detailToEvents(d).length, 0);
console.log(JSON.stringify({
  pages: parsed.length,
  empty: parsed.filter((d) => d.isEmpty).length,
  withPermitNum: parsed.filter((d) => d.permitNum).length,
  withInspections: parsed.filter((d) => d.inspections.length > 0).length,
  eventsTotal: events,
}, null, 2));

const examples = [parsed.find((d) => d.inspections.length > 0), parsed.find((d) => !d.isEmpty && d.fees.length > 0)]
  .filter((d, i, a): d is OneStopDetail => d != null && a.indexOf(d) === i);
for (const d of examples.length ? examples : parsed.slice(0, 2)) console.log(JSON.stringify(d, null, 2));
