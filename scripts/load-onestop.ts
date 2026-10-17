// ABOUTME: Loads crawled One Stop detail pages into seedat-db: one onestop_record per page (matched to a parcel), and
// ABOUTME: for pages that are permits, permit_event rows plus permit.onestop_id. Linked to permits by reference code.
// Usage: npx tsx scripts/load-onestop.ts [--load]
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { blockIdForText } from "../packages/core/src/block";
import { matchRecord } from "../packages/core/src/match";
import { detailToEvents, parseOneStopDetail } from "../packages/core/src/onestop";
import { source as blds } from "../packages/core/src/sources/permit_blds";
import { insertSql, sqlValue } from "../packages/core/src/sql";
import { loadSqlFiles, writeSqlFiles } from "./lib/d1";
import { RAW, buildFullIndex } from "./lib/raw";

const DIR = join(RAW, "onestop");

// Reference code -> permit number, from the BLDS rows we already downloaded.
const byRef = new Map<string, string>();
for (const f of readdirSync(join(RAW, "src", "72f9-bi28")).filter((x) => x.endsWith(".json"))) {
  for (const raw of JSON.parse(readFileSync(join(RAW, "src", "72f9-bi28", f), "utf8"))) {
    const row = blds.map(raw);
    if (row?.onestop_ref) byRef.set(String(row.onestop_ref), row.permit_num);
  }
}

const { index } = buildFullIndex();
const now = new Date().toISOString();
const records: Record<string, unknown>[] = [];
const events: Record<string, unknown>[] = [];
const links: { permit_num: string; onestop_id: number; fetched: string }[] = [];
let pages = 0, empty = 0, unlinked = 0;
for (const f of readdirSync(DIR).filter((x) => x.endsWith(".html.gz"))) {
  pages++;
  const id = Number(f.replace(".html.gz", ""));
  const d = parseOneStopDetail(gunzipSync(readFileSync(join(DIR, f))).toString("utf8"), id);
  if (d.isEmpty) { empty++; continue; }
  const permitNum = d.permitNum ?? (d.referenceCode ? byRef.get(d.referenceCode) : undefined) ?? null;
  const fetched = statSync(join(DIR, f)).mtime.toISOString();
  const m = matchRecord({ address: d.location }, index);
  const done = d.statuses.filter((st) => st.complete);
  records.push({
    onestop_id: id, reference_code: d.referenceCode, permit_num: permitNum, record_type: d.type,
    geopin: m.geopin, address_id: m.addressId, match_type: m.matchType, match_score: m.score,
    address_raw: d.location, block_id: blockIdForText(d.location), description: d.description,
    submitted_date: d.statuses[0]?.date ?? null, current_status: done[done.length - 1]?.name ?? null,
    // Staff reviewer names stay out of what we publish; divisions and outcomes are enough.
    detail_json: JSON.stringify({ ...d, reviews: d.reviews.map(({ reviewer: _r, ...rest }) => rest) }),
    fetched_at: fetched, first_seen_at: now, last_seen_at: now,
  });
  if (!permitNum) { unlinked++; continue; }
  d.permitNum = permitNum;
  events.push(...detailToEvents(d));
  links.push({ permit_num: permitNum, onestop_id: id, fetched });
}

const permits = [...new Set(links.map((l) => l.permit_num))];
const statements = [
  ...insertSql("onestop_record", Object.keys(records[0]!), records, { upsertKey: ["onestop_id"] }),
  ...permits.map((p) => `DELETE FROM permit_event WHERE permit_num = ${sqlValue(p)} AND source_id = 'onestop:detail';`),
  ...insertSql("permit_event", ["permit_num", "seq", "kind", "name", "status", "event_date", "actor", "detail", "source_id"], events),
  ...links.map((l) => `UPDATE permit SET onestop_id = ${l.onestop_id}, detail_fetched_at = ${sqlValue(l.fetched)} WHERE permit_num = ${sqlValue(l.permit_num)};`),
];
const matched = records.filter((r) => r.geopin).length;
console.log(JSON.stringify({ pages, empty, records: records.length, matchedToParcel: matched, linkedToPermit: links.length, unlinked, events: events.length,
  types: Object.fromEntries([...records.reduce((m, r) => m.set(r.record_type, (m.get(r.record_type) ?? 0) + 1), new Map())].sort((a, b) => b[1] - a[1])) }));
const files = writeSqlFiles("onestop", statements);
if (process.argv.includes("--load")) loadSqlFiles(files);
