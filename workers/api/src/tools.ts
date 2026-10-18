// ABOUTME: The See Dat MCP tools: intent-shaped questions about New Orleans property (look up an address, search
// ABOUTME: permits, find properties, block activity, freshness) with provenance on every answer. Read-only.
import { findPropertiesQuery, matchNeighborhood, searchPermitsQuery } from "@seedat/core/src/filters";
import { rulesForParcel, zoningPlainEnglish } from "@seedat/core/src/rules";
import { isPermitOpen } from "@seedat/core/src/status";
import { summarizeProperty } from "@seedat/core/src/summary";
import { BLOCK_FOR_PARCEL_SQL, activityWindow, loadProperty, type Property } from "@seedat/d1/src/property";
import { resolveAddress, suggest } from "@seedat/d1/src/search";

export interface Env { DB: D1Database; SITE_ORIGIN: string }

export class ToolError extends Error {}

type Args = Record<string, unknown>;
interface Tool { name: string; description: string; inputSchema: object; run(env: Env, args: Args): Promise<unknown> }

const str = (a: Args, k: string) => (typeof a[k] === "string" && (a[k] as string).trim() ? (a[k] as string).trim() : undefined);
const num = (a: Args, k: string) => (typeof a[k] === "number" && Number.isFinite(a[k]) ? (a[k] as number) : undefined);
const clampInt = (v: number | undefined, lo: number, hi: number, dflt: number) => Math.min(Math.max(Math.floor(v ?? dflt), lo), hi);
const parseJson = (s: string): unknown => { try { return JSON.parse(s); } catch { return null; } };
const bool = (a: Args, k: string) => (typeof a[k] === "boolean" ? (a[k] as boolean) : undefined);
const isoDate = (a: Args, k: string) => {
  const v = str(a, k);
  if (v && !/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new ToolError(`${k} must be a date like 2026-06-01`);
  return v;
};

const valuesCache = new Map<string, { at: number; value: unknown }>();

let hoods: Promise<string[]> | null = null;
function neighborhoods(db: D1Database): Promise<string[]> {
  hoods ??= db.prepare("SELECT DISTINCT neighborhood FROM parcel WHERE neighborhood IS NOT NULL").all<{ neighborhood: string }>().then((r) => r.results.map((x) => x.neighborhood));
  hoods.catch(() => { hoods = null; });
  return hoods;
}
async function neighborhoodArg(env: Env, a: Args): Promise<string | undefined> {
  const raw = str(a, "neighborhood");
  if (!raw) return undefined;
  const all = await neighborhoods(env.DB);
  const m = matchNeighborhood(raw, all);
  if (!m) throw new ToolError(`Unknown neighborhood "${raw}". Use list_values with field "neighborhood" to see the city's names.`);
  return m;
}

async function asOf(db: D1Database): Promise<string | null> {
  return (await db.prepare("SELECT max(last_success_at) t FROM source").first<{ t: string | null }>())?.t ?? null;
}

const pageUrl = (env: Env, geopin: number | null) => (geopin ? `${env.SITE_ORIGIN}/p/${geopin}` : null);

async function parcelFrom(env: Env, a: Args): Promise<number> {
  const g = num(a, "geopin") ?? (str(a, "geopin") ? Number(str(a, "geopin")) : undefined);
  if (g && /^\d{8}$/.test(String(g))) return g;
  const address = str(a, "address");
  if (!address) throw new ToolError("Give an address (e.g. \"3300 Dauphine St\") or a geopin.");
  const m = await resolveAddress(env.DB, address);
  if (!m.geopin) {
    const s = await suggest(env.DB, address, 5);
    throw new ToolError(`Could not place "${address}" on a parcel (${m.reason ?? "no match"}).${s.length ? ` Closest addresses: ${s.map((x) => x.full_address).join("; ")}.` : ""}`);
  }
  return m.geopin;
}

function propertyFacts(env: Env, p: Property) {
  const a = p.parcel;
  const street = p.addresses.find((x) => !x.unit_id)?.full_address ?? a.situs ?? `Parcel ${a.geopin}`;
  const overlays: string[] = (() => { try { return JSON.parse(a.overlays ?? "[]"); } catch { return []; } })();
  const zoningPlain = zoningPlainEnglish(a.zoning, a.zoning_desc);
  const openPermits = p.permits.filter(isPermitOpen);
  // Lists are capped (see SHOWN); totals come from counts so a big parcel never reports its cap as the total.
  const permitsOpen = p.totals.permits > p.permits.length ? (p.summary?.permits_open ?? openPermits.length) : openPermits.length;
  return {
    address: street, geopin: a.geopin, page_url: pageUrl(env, a.geopin),
    neighborhood: a.neighborhood, ward: a.ward, council_district: a.council_district,
    zoning: a.zoning, zoning_plain_english: zoningPlain, overlays,
    historic_district: a.local_historic_district, hdlc_control: a.hdlc_control, national_register_district: a.nr_district,
    is_landmark: !!a.is_landmark, lot_sq_ft: a.acres ? Math.round(a.acres * 43560) : null,
    summary: summarizeProperty({
      address: street, neighborhood: a.neighborhood, zoning: a.zoning, zoningPlain,
      historicDistrict: a.local_historic_district, hdlcControl: a.hdlc_control,
      vcc: /^VC/i.test(a.zoning ?? "") || /vieux carr/i.test(a.local_historic_district ?? ""), isLandmark: !!a.is_landmark,
      permitsTotal: p.totals.permits, permitsOpen,
      lastPermitType: p.permits[0]?.permit_type_desc ?? null, lastPermitDate: p.permits[0]?.applied_date ?? null,
      demolitionDate: p.summary?.demolition_permit_date ?? null,
      codeCasesOpen: p.totals.code_cases_open, codeCasesTotal: p.totals.code_cases, lastCodeCaseDate: p.codeCases[0]?.filed_date ?? null,
      strActiveType: p.strs.find((x) => x.is_active)?.license_type ?? null,
      block311: p.block.requests12m.reduce((n, r) => n + r.n, 0), blockPolice: p.block.police12m.reduce((n, r) => n + r.n, 0),
      today: new Date().toISOString().slice(0, 10),
    }),
    counts: {
      permits: p.totals.permits, permits_open: permitsOpen, code_cases: p.totals.code_cases,
      code_cases_open: p.totals.code_cases_open, onestop_records: p.onestop.length,
      str_licenses_active: p.strs.filter((s) => s.is_active).length, units: p.totals.units,
    },
    rules: rulesForParcel({
      zoning: a.zoning, zoning_desc: a.zoning_desc, overlays, local_historic_district: a.local_historic_district,
      hdlc_control: a.hdlc_control, nr_district: a.nr_district, is_landmark: !!a.is_landmark, hdlc_solar_review: !!a.hdlc_solar_review,
    }),
  };
}

const PROVENANCE = "City of New Orleans open data (data.nola.gov, maps.nola.gov) and One Stop public record pages, joined to parcels by See Dat. Not an official city record.";

export const TOOLS: Tool[] = [
  {
    name: "lookup_address",
    description: "Look up a New Orleans address and get the property's key facts: parcel ID (geopin), neighborhood, zoning in plain English, historic district and HDLC/VCC review rules, a plain-English summary, and counts of permits, code enforcement cases and short-term rental licenses. Accepts messy input like \"1234 st claude apt b\". Start here for any question about a specific property.",
    inputSchema: { type: "object", properties: { address: { type: "string", description: "Street address in New Orleans, e.g. \"3300 Dauphine St\"" } }, required: ["address"] },
    async run(env, a) {
      const geopin = await parcelFrom(env, a);
      const p = await loadProperty(env.DB, geopin);
      if (!p) throw new ToolError(`No parcel ${geopin}.`);
      return { ...propertyFacts(env, p), as_of: await asOf(env.DB), provenance: PROVENANCE };
    },
  },
  {
    name: "get_property_records",
    description: "Every record on file for one property, newest first: permits (with status timeline and inspections where known), code enforcement cases (with inspections, violations and hearings), One Stop records such as HDLC/VCC reviews and special events, and short-term rental licenses. Filter by kind and date.",
    inputSchema: {
      type: "object",
      properties: {
        address: { type: "string" }, geopin: { type: "integer", description: "Parcel ID from lookup_address" },
        kinds: { type: "array", items: { type: "string", enum: ["permit", "code_case", "onestop", "str"] }, description: "Default: all" },
        since: { type: "string", description: "Only records dated on or after this date (YYYY-MM-DD)" },
        include_timeline: { type: "boolean", description: "Include each permit's and case's event timeline (default true)" },
        limit: { type: "integer", description: "Max records per kind (default 50, max 200)" },
      },
    },
    async run(env, a) {
      const geopin = await parcelFrom(env, a);
      const p = await loadProperty(env.DB, geopin);
      if (!p) throw new ToolError(`No parcel ${geopin}.`);
      const since = isoDate(a, "since") ?? "";
      const kinds = new Set(Array.isArray(a.kinds) && a.kinds.length ? (a.kinds as string[]) : ["permit", "code_case", "onestop", "str"]);
      const limit = clampInt(num(a, "limit"), 1, 200, 50);
      const timeline = bool(a, "include_timeline") ?? true;
      const after = (d: string | null) => !since || (d ?? "") >= since;
      const permitNums = new Set(p.permits.map((x) => x.permit_num));
      return {
        address: p.addresses.find((x) => !x.unit_id)?.full_address ?? p.parcel.situs, geopin, page_url: pageUrl(env, geopin),
        permits: kinds.has("permit") ? p.permits.filter((x) => after(x.applied_date ?? x.issued_date)).slice(0, limit)
          .map(({ events, match_score: _s, ...x }) => ({ ...x, is_open: isPermitOpen(x), ...(timeline ? { timeline: events } : {}) })) : undefined,
        code_cases: kinds.has("code_case") ? p.codeCases.filter((x) => after(x.filed_date)).slice(0, limit)
          .map(({ events, ...x }) => ({ ...x, ...(timeline ? { timeline: events } : {}) })) : undefined,
        onestop_records: kinds.has("onestop") ? p.onestop.filter((x) => after(x.submitted_date) && (!x.permit_num || !permitNums.has(x.permit_num))).slice(0, limit)
          .map(({ detail_json, ...x }) => ({ ...x, ...(timeline ? { detail: parseJson(detail_json) } : {}) })) : undefined,
        str_licenses: kinds.has("str") ? p.strs.filter((x) => after(x.issued_date ?? x.applied_date)).slice(0, limit) : undefined,
        as_of: await asOf(env.DB), provenance: PROVENANCE,
      };
    },
  },
  {
    name: "search_permits",
    description: "Search building permits citywide. Combine filters: neighborhood (loose names like \"7th ward\" or \"Treme\" work), council district, ward, historic district, permit type code (e.g. DEMO, NEWC, RNVS, SOLR, HDLC; see list_values), words in the description, estimated cost range, date range, and open/closed. Example: demolition permits in Bywater over $100k since June -> {neighborhood:\"Bywater\", type:\"DEMO\", min_cost:100000, since:\"2026-06-01\"}. Note: estimated cost is the applicant's own figure and is often 0 for demolitions.",
    inputSchema: {
      type: "object",
      properties: {
        neighborhood: { type: "string" }, council_district: { type: "string", description: "A-E" }, ward: { type: "string", description: "1-17" },
        historic_district: { type: "string", description: "Local historic district name, e.g. \"Bywater\"" },
        type: { type: "string", description: "Permit type code, e.g. DEMO" }, text: { type: "string", description: "Words that must appear in the description" },
        min_cost: { type: "number" }, max_cost: { type: "number" },
        since: { type: "string", description: "YYYY-MM-DD, by application date" }, until: { type: "string", description: "YYYY-MM-DD, exclusive" },
        open: { type: "boolean", description: "true = still open in the city's records, false = finished/cancelled" },
        limit: { type: "integer", description: "Default 50, max 500" },
      },
    },
    async run(env, a) {
      const q = searchPermitsQuery({
        neighborhood: await neighborhoodArg(env, a), councilDistrict: str(a, "council_district"), ward: str(a, "ward"),
        historicDistrict: str(a, "historic_district"), type: str(a, "type"), text: str(a, "text"),
        minCost: num(a, "min_cost"), maxCost: num(a, "max_cost"), since: isoDate(a, "since"), until: isoDate(a, "until"),
        open: bool(a, "open"), limit: num(a, "limit"),
      });
      const [res, total] = await env.DB.batch([env.DB.prepare(q.sql).bind(...q.params), env.DB.prepare(q.countSql).bind(...q.countParams)]);
      const rows = res!.results as (Record<string, unknown> & { geopin: number | null })[];
      const limit = Number(q.params.at(-1)) - 1;
      return {
        total: (total!.results[0] as { n: number }).n, returned: Math.min(rows.length, limit), truncated: rows.length > limit,
        permits: rows.slice(0, limit).map((r) => ({ ...r, page_url: pageUrl(env, r.geopin) })),
        as_of: await asOf(env.DB), provenance: PROVENANCE,
      };
    },
  },
  {
    name: "find_properties",
    description: "Find properties (parcels) matching conditions, using precomputed per-parcel facts. Example: properties in the Seventh Ward with open code cases and no permit activity in two years -> {neighborhood:\"Seventh Ward\", open_code_case:true, no_permit_since:\"<two years ago>\"}. Filters: neighborhood, ward, council district, zoning prefix (e.g. HU-RD), HDLC control (Full/Partial), historic district, open code case, active short-term rental, last permit before/after a date, demolition permit since a date.",
    inputSchema: {
      type: "object",
      properties: {
        neighborhood: { type: "string" }, ward: { type: "string" }, council_district: { type: "string" }, zoning_prefix: { type: "string" },
        hdlc_control: { type: "string", enum: ["Full", "Partial"] }, historic_district: { type: "string" },
        open_code_case: { type: "boolean" }, str_active: { type: "boolean" },
        no_permit_since: { type: "string", description: "YYYY-MM-DD: no permit filed on or after this date" },
        permit_since: { type: "string", description: "YYYY-MM-DD: a permit filed on or after this date" },
        demolition_since: { type: "string", description: "YYYY-MM-DD" },
        limit: { type: "integer", description: "Default 50, max 500" },
      },
    },
    async run(env, a) {
      const control = str(a, "hdlc_control");
      const q = findPropertiesQuery({
        neighborhood: await neighborhoodArg(env, a), ward: str(a, "ward"), councilDistrict: str(a, "council_district"),
        zoningPrefix: str(a, "zoning_prefix"), hdlcControl: control === "Full" || control === "Partial" ? control : undefined,
        historicDistrict: str(a, "historic_district"), openCodeCase: bool(a, "open_code_case"), strActive: bool(a, "str_active"),
        noPermitSince: isoDate(a, "no_permit_since"), permitSince: isoDate(a, "permit_since"), demolitionSince: isoDate(a, "demolition_since"),
        limit: num(a, "limit"),
      });
      const [res, total] = await env.DB.batch([env.DB.prepare(q.sql).bind(...q.params), env.DB.prepare(q.countSql).bind(...q.countParams)]);
      const rows = res!.results as (Record<string, unknown> & { geopin: number })[];
      const limit = Number(q.params.at(-1)) - 1;
      return {
        total: (total!.results[0] as { n: number }).n, returned: Math.min(rows.length, limit), truncated: rows.length > limit,
        properties: rows.slice(0, limit).map((r) => ({ ...r, str_active: !!r.str_active, page_url: pageUrl(env, r.geopin) })),
        as_of: await asOf(env.DB), provenance: PROVENANCE,
      };
    },
  },
  {
    name: "block_activity",
    description: "311 service requests and NOPD calls for service on the hundred-block around an address, by type, for recent months. Block-level only: police data may not be used to identify specific addresses or for commercial purposes (NOPD terms).",
    inputSchema: {
      type: "object",
      properties: { address: { type: "string" }, geopin: { type: "integer" }, months: { type: "integer", description: "1-60, default 12" } },
    },
    async run(env, a) {
      const geopin = await parcelFrom(env, a);
      const months = clampInt(num(a, "months"), 1, 60, 12);
      const block = await env.DB.prepare(BLOCK_FOR_PARCEL_SQL).bind(geopin).first<{ block_id: string }>();
      if (!block) throw new ToolError("No block found for that parcel.");
      const { since, sinceMonth } = activityWindow(new Date().toISOString().slice(0, 10), months);
      const [sr, police] = await env.DB.batch([
        env.DB.prepare("SELECT request_type, count(*) n FROM service_request WHERE block_id = ? AND created_date >= ? GROUP BY 1 ORDER BY 2 DESC").bind(block.block_id, since),
        env.DB.prepare("SELECT category, sum(n) n FROM police_call_month WHERE block_id = ? AND month >= ? GROUP BY 1 ORDER BY 2 DESC").bind(block.block_id, sinceMonth),
      ]);
      return {
        block: block.block_id, since_311: since, since_police_month: sinceMonth, requests_311: sr!.results, police_calls: police!.results,
        note: "Counts are for the hundred-block, not the property. NOPD calls for service are preliminary; source: Orleans Parish Communications District.",
        as_of: await asOf(env.DB),
      };
    },
  },
  {
    name: "data_freshness",
    description: "When each source dataset was last pulled and whether any is stale. Use before answering time-sensitive questions.",
    inputSchema: { type: "object", properties: {} },
    async run(env) {
      const rows = (await env.DB.prepare("SELECT source_id, name, url, license, last_success_at, upstream_updated_at, last_row_count, stale_after_hours FROM source ORDER BY name").all<Record<string, unknown> & { last_success_at: string | null; stale_after_hours: number }>()).results;
      const now = Date.now();
      const crawl = await env.DB.prepare("SELECT frontier_id, backfill_next, backfill_stop, pages_ok, updated_at FROM crawl_state WHERE id = 1").first();
      return {
        sources: rows.map((r) => ({ ...r, stale: !r.last_success_at || now - Date.parse(r.last_success_at) > r.stale_after_hours * 3_600_000 })),
        onestop_crawl: crawl,
        note: "Most city datasets refresh nightly; See Dat pulls at 09:00 UTC. Police calls before the current year are frozen annual archives, so they are expected to look stale.",
      };
    },
  },
  {
    name: "list_values",
    description: "Valid values for a filter, with counts: neighborhood, permit_type (code and description), ward, council_district, historic_district, zoning, onestop_record_type.",
    inputSchema: {
      type: "object",
      properties: { field: { type: "string", enum: ["neighborhood", "permit_type", "ward", "council_district", "historic_district", "zoning", "onestop_record_type"] } },
      required: ["field"],
    },
    async run(env, a) {
      const sql: Record<string, string> = {
        neighborhood: "SELECT neighborhood value, count(*) n FROM parcel WHERE neighborhood IS NOT NULL GROUP BY 1 ORDER BY 1",
        permit_type: "SELECT permit_type value, max(permit_type_desc) description, count(*) n FROM permit WHERE permit_type IS NOT NULL GROUP BY 1 ORDER BY 3 DESC",
        ward: "SELECT ward value, count(*) n FROM parcel WHERE ward IS NOT NULL GROUP BY 1 ORDER BY CAST(ward AS INTEGER)",
        council_district: "SELECT council_district value, count(*) n FROM parcel WHERE council_district IS NOT NULL GROUP BY 1 ORDER BY 1",
        historic_district: "SELECT local_historic_district value, hdlc_control control, count(*) n FROM parcel WHERE local_historic_district IS NOT NULL GROUP BY 1, 2 ORDER BY 1",
        zoning: "SELECT zoning value, max(zoning_desc) description, count(*) n FROM parcel WHERE zoning IS NOT NULL GROUP BY 1 ORDER BY 1",
        onestop_record_type: "SELECT record_type value, count(*) n FROM onestop_record GROUP BY 1 ORDER BY 2 DESC",
      };
      const field = str(a, "field") ?? "";
      const q = sql[field];
      if (!q) throw new ToolError(`field must be one of: ${Object.keys(sql).join(", ")}`);
      // These scan whole tables and change at most nightly: cache per isolate for an hour.
      const hit = valuesCache.get(field);
      if (hit && hit.at > Date.now() - 3_600_000) return hit.value;
      const value = { field, values: (await env.DB.prepare(q).all()).results };
      valuesCache.set(field, { at: Date.now(), value });
      return value;
    },
  },
];
