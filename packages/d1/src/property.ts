// ABOUTME: Loads everything public about one parcel from D1 in two round trips: the property page and the MCP
// ABOUTME: server both read through this, so the page and the agents always see the same facts.
import { jsonChunks } from "./prefetch";

export interface Parcel {
  geopin: number; situs: string | null; lat: number; lon: number; acres: number | null;
  zoning: string | null; zoning_desc: string | null; overlays: string | null; future_land_use: string | null;
  local_historic_district: string | null; hdlc_control: "Full" | "Partial" | null; nr_district: string | null;
  is_landmark: number; hdlc_solar_review: number; flood_zone: string | null;
  neighborhood: string | null; council_district: string | null; ward: string | null; planning_district: string | null;
}

export interface Summary {
  permits_total: number; permits_open: number; last_permit_date: string | null; last_permit_type: string | null;
  permit_value_5y: number | null; code_cases_total: number; code_cases_open: number; last_code_case_date: string | null;
  str_active: number; str_type: string | null; demolition_permit_date: string | null;
  block_311_12m: number; block_police_12m: number; computed_at: string;
}

export interface Event { kind: string; name: string | null; status: string | null; event_date: string | null; actor: string | null; detail: string | null; source_id: string }

export interface Permit {
  permit_num: string; address_raw: string | null; permit_type: string | null; permit_type_desc: string | null;
  work_class: string | null; description: string | null; status: string | null; status_mapped: string | null; status_date: string | null;
  applied_date: string | null; issued_date: string | null; completed_date: string | null; expires_date: string | null;
  est_cost: number | null; fees_total: number | null; contractor: string | null; days_to_issue: number | null;
  onestop_ref: string | null; match_type: string; match_score: number; events: Event[];
}

export interface CodeCase {
  case_id: number; case_no: string | null; address_raw: string | null; stage: string | null; key_status: string | null; is_open: number;
  filed_date: string | null; status_date: string | null; next_hearing_date: string | null; prev_hearing_result: string | null;
  last_permit_num: string | null; match_type: string; events: { kind: string; event_date: string | null; type: string | null; result: string | null }[];
}

export interface OneStopRecord {
  onestop_id: number; reference_code: string | null; permit_num: string | null; record_type: string | null;
  description: string | null; submitted_date: string | null; current_status: string | null; detail_json: string; fetched_at: string;
}

export interface StrLicense {
  str_id: string; license_number: string | null; license_type: string | null; status: string | null; is_active: number;
  applied_date: string | null; issued_date: string | null; expiration_date: string | null; operator_name: string | null; address_raw: string | null;
}

/** A BlightStatus demolition (NORA, IDC, FEMA, SDER, NOSD programs, 2009–2019). */
export interface Demolition {
  demolition_id: string; address_raw: string | null; program: string | null; case_id: string | null; units: number | null;
  start_date: string | null; complete_date: string | null; match_type: string;
}

export interface Freshness { source_id: string; name: string; last_success_at: string | null; upstream_updated_at: string | null; stale_after_hours: number }

export interface Property {
  parcel: Parcel; summary: Summary | null; addresses: { address_id: number; full_address: string; unit_id: string | null; block_id: string }[];
  permits: Permit[]; codeCases: CodeCase[]; onestop: OneStopRecord[]; strs: StrLicense[]; demolitions: Demolition[];
  block: { block_id: string | null; requests12m: { request_type: string; n: number }[]; police12m: { category: string; n: number }[] };
  freshness: Freshness[];
  /** True totals; the lists above are capped at SHOWN. */
  totals: { permits: number; code_cases: number; code_cases_open: number; units: number; strs: number; demolitions: number };
}

const PERMIT_COLS = `permit_num, address_raw, permit_type, permit_type_desc, work_class, description, status, status_mapped, status_date,
  applied_date, issued_date, completed_date, expires_date, est_cost, fees_total, contractor, days_to_issue, onestop_ref, match_type, match_score`;

/**
 * The hundred-block a parcel's block-level activity is counted on: its lowest-numbered building address.
 * One definition for the page, the MCP server and parcel_summary, so corner lots always report the same block.
 */
export const BLOCK_FOR_PARCEL_SQL =
  "SELECT block_id FROM address WHERE geopin = ? ORDER BY unit_id IS NOT NULL, number, address_id LIMIT 1";

/**
 * Window for "the past N months" of block activity: 311 counts from the exact start date; police counts are monthly,
 * so they start at the first whole month after it (never more than N months).
 */
export function activityWindow(today: string, months: number): { since: string; sinceMonth: string } {
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() - months);
  const since = d.toISOString().slice(0, 10);
  const m = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
  return { since, sinceMonth: m.toISOString().slice(0, 7) };
}

/** Rows shown per kind; totals come from separate counts so a capped list never reads as the total. */
export const SHOWN = { permits: 200, codeCases: 100, onestop: 100, strs: 50, demolitions: 50, units: 60 } as const;

/**
 * Everything about one parcel. `page` overrides how many rows of each list to return and from where (the MCP tool
 * pages through big parcels this way); the page itself uses the SHOWN defaults.
 */
export async function loadProperty(
  db: D1Database, geopin: number, today = new Date().toISOString().slice(0, 10), page: { limit?: number; offset?: number } = {},
): Promise<Property | null> {
  const off = Math.max(0, Math.floor(page.offset ?? 0));
  const lim = (dflt: number) => Math.min(Math.max(1, Math.floor(page.limit ?? dflt)), 1000);
  const { since, sinceMonth } = activityWindow(today, 12);
  const [parcel, summary, addresses, permits, codeCases, onestop, strs, demolitions, freshness, totals, blockRow] = await db.batch([
    db.prepare("SELECT * FROM parcel WHERE geopin = ?").bind(geopin),
    db.prepare("SELECT * FROM parcel_summary WHERE geopin = ?").bind(geopin),
    db.prepare(`SELECT address_id, full_address, unit_id, block_id FROM address WHERE geopin = ? ORDER BY unit_id IS NOT NULL, number, unit_id LIMIT ${SHOWN.units}`).bind(geopin),
    db.prepare(`SELECT ${PERMIT_COLS} FROM permit WHERE (geopin = ?1 OR permit_num IN (SELECT entity_id FROM record_parcel WHERE entity = 'permit' AND geopin = ?1)) AND removed_at IS NULL ORDER BY coalesce(applied_date, issued_date) DESC LIMIT ${lim(SHOWN.permits)} OFFSET ${off}`).bind(geopin),
    db.prepare(`SELECT case_id, case_no, address_raw, stage, key_status, is_open, filed_date, status_date, next_hearing_date, prev_hearing_result, last_permit_num, match_type
      FROM code_case WHERE (geopin = ?1 OR case_id IN (SELECT CAST(entity_id AS INTEGER) FROM record_parcel WHERE entity = 'code_case' AND geopin = ?1)) AND removed_at IS NULL ORDER BY filed_date DESC LIMIT ${lim(SHOWN.codeCases)} OFFSET ${off}`).bind(geopin),
    db.prepare(`SELECT onestop_id, reference_code, permit_num, record_type, description, submitted_date, current_status, detail_json, fetched_at
      FROM onestop_record WHERE geopin = ? ORDER BY submitted_date DESC LIMIT ${lim(SHOWN.onestop)} OFFSET ${off}`).bind(geopin),
    db.prepare(`SELECT str_id, license_number, license_type, status, is_active, applied_date, issued_date, expiration_date, operator_name, address_raw
      FROM str_license WHERE (geopin = ?1 OR str_id IN (SELECT entity_id FROM record_parcel WHERE entity = 'str_license' AND geopin = ?1)) AND removed_at IS NULL ORDER BY is_active DESC, coalesce(issued_date, applied_date) DESC LIMIT ${lim(SHOWN.strs)} OFFSET ${off}`).bind(geopin),
    db.prepare(`SELECT demolition_id, address_raw, program, case_id, units, start_date, complete_date, match_type
      FROM demolition WHERE (geopin = ?1 OR demolition_id IN (SELECT entity_id FROM record_parcel WHERE entity = 'demolition' AND geopin = ?1)) AND removed_at IS NULL ORDER BY coalesce(complete_date, start_date) DESC LIMIT ${lim(SHOWN.demolitions)} OFFSET ${off}`).bind(geopin),
    db.prepare("SELECT source_id, name, last_success_at, upstream_updated_at, stale_after_hours FROM source ORDER BY source_id"),
    db.prepare(`SELECT (SELECT count(*) FROM permit WHERE (geopin = ?1 OR permit_num IN (SELECT entity_id FROM record_parcel WHERE entity = 'permit' AND geopin = ?1)) AND removed_at IS NULL) permits,
      (SELECT count(*) FROM code_case WHERE (geopin = ?1 OR case_id IN (SELECT CAST(entity_id AS INTEGER) FROM record_parcel WHERE entity = 'code_case' AND geopin = ?1)) AND removed_at IS NULL) code_cases,
      (SELECT count(*) FROM code_case WHERE (geopin = ?1 OR case_id IN (SELECT CAST(entity_id AS INTEGER) FROM record_parcel WHERE entity = 'code_case' AND geopin = ?1)) AND removed_at IS NULL AND +is_open = 1) code_cases_open,
      (SELECT count(*) FROM address WHERE geopin = ?1 AND unit_id IS NOT NULL) units,
      (SELECT count(*) FROM str_license WHERE (geopin = ?1 OR str_id IN (SELECT entity_id FROM record_parcel WHERE entity = 'str_license' AND geopin = ?1)) AND removed_at IS NULL) strs,
      (SELECT count(*) FROM demolition WHERE (geopin = ?1 OR demolition_id IN (SELECT entity_id FROM record_parcel WHERE entity = 'demolition' AND geopin = ?1)) AND removed_at IS NULL) demolitions`).bind(geopin),
    db.prepare(BLOCK_FOR_PARCEL_SQL).bind(geopin),
  ]);
  const p = parcel!.results[0] as Parcel | undefined;
  if (!p) return null;

  const addrs = addresses!.results as Property["addresses"];
  const blockId = (blockRow!.results[0] as { block_id: string } | undefined)?.block_id ?? null;
  const permitRows = permits!.results as Omit<Permit, "events">[];
  const caseRows = codeCases!.results as Omit<CodeCase, "events">[];

  const [permitEvents, caseEvents, requests, police] = await db.batch([
    db.prepare(`SELECT permit_num, kind, name, status, event_date, actor, detail, source_id FROM permit_event
      WHERE permit_num IN (SELECT value FROM json_each(?)) ORDER BY permit_num, event_date, seq`).bind(JSON.stringify(permitRows.map((r) => r.permit_num))),
    db.prepare(`SELECT case_id, kind, event_date, type, result FROM code_event
      WHERE case_id IN (SELECT value FROM json_each(?)) ORDER BY case_id, event_date`).bind(JSON.stringify(caseRows.map((r) => r.case_id))),
    db.prepare(`SELECT request_type, count(*) n FROM service_request WHERE block_id = ? AND created_date >= ? GROUP BY 1 ORDER BY 2 DESC`).bind(blockId, since),
    db.prepare(`SELECT category, sum(n) n FROM police_call_month WHERE block_id = ? AND month >= ? GROUP BY 1 ORDER BY 2 DESC`).bind(blockId, sinceMonth),
  ]);

  const evByPermit = new Map<string, Event[]>();
  for (const e of permitEvents!.results as (Event & { permit_num: string })[]) {
    const list = evByPermit.get(e.permit_num) ?? [];
    list.push(e);
    evByPermit.set(e.permit_num, list);
  }
  const evByCase = new Map<number, CodeCase["events"]>();
  for (const e of caseEvents!.results as (CodeCase["events"][number] & { case_id: number })[]) {
    const list = evByCase.get(e.case_id) ?? [];
    list.push(e);
    evByCase.set(e.case_id, list);
  }

  return {
    parcel: p,
    summary: (summary!.results[0] as Summary | undefined) ?? null,
    addresses: addrs,
    permits: permitRows.map((r) => ({ ...r, events: evByPermit.get(r.permit_num) ?? [] })),
    codeCases: caseRows.map((r) => ({ ...r, events: evByCase.get(r.case_id) ?? [] })),
    onestop: onestop!.results as OneStopRecord[],
    strs: strs!.results as StrLicense[],
    demolitions: demolitions!.results as Demolition[],
    block: { block_id: blockId, requests12m: requests!.results as Property["block"]["requests12m"], police12m: police!.results as Property["block"]["police12m"] },
    freshness: freshness!.results as Freshness[],
    totals: totals!.results[0] as Property["totals"],
  };
}
