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

export interface Freshness { source_id: string; name: string; last_success_at: string | null; upstream_updated_at: string | null; stale_after_hours: number }

export interface Property {
  parcel: Parcel; summary: Summary | null; addresses: { address_id: number; full_address: string; unit_id: string | null; block_id: string }[];
  permits: Permit[]; codeCases: CodeCase[]; onestop: OneStopRecord[]; strs: StrLicense[];
  block: { block_id: string | null; requests12m: { request_type: string; n: number }[]; police12m: { category: string; n: number }[] };
  freshness: Freshness[];
}

const PERMIT_COLS = `permit_num, address_raw, permit_type, permit_type_desc, work_class, description, status, status_mapped, status_date,
  applied_date, issued_date, completed_date, expires_date, est_cost, fees_total, contractor, days_to_issue, onestop_ref, match_type, match_score`;

/** Twelve months back from `today` as YYYY-MM-DD. */
const yearAgo = (today: string) => {
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCFullYear(d.getUTCFullYear() - 1);
  return d.toISOString().slice(0, 10);
};

export async function loadProperty(db: D1Database, geopin: number, today = new Date().toISOString().slice(0, 10)): Promise<Property | null> {
  const since = yearAgo(today);
  const [parcel, summary, addresses, permits, codeCases, onestop, strs, freshness] = await db.batch([
    db.prepare("SELECT * FROM parcel WHERE geopin = ?").bind(geopin),
    db.prepare("SELECT * FROM parcel_summary WHERE geopin = ?").bind(geopin),
    db.prepare("SELECT address_id, full_address, unit_id, block_id FROM address WHERE geopin = ? ORDER BY unit_id IS NOT NULL, number, unit_id LIMIT 60").bind(geopin),
    db.prepare(`SELECT ${PERMIT_COLS} FROM permit WHERE geopin = ? AND removed_at IS NULL ORDER BY coalesce(applied_date, issued_date) DESC LIMIT 200`).bind(geopin),
    db.prepare(`SELECT case_id, case_no, address_raw, stage, key_status, is_open, filed_date, status_date, next_hearing_date, prev_hearing_result, last_permit_num, match_type
      FROM code_case WHERE geopin = ? AND removed_at IS NULL ORDER BY filed_date DESC LIMIT 100`).bind(geopin),
    db.prepare(`SELECT onestop_id, reference_code, permit_num, record_type, description, submitted_date, current_status, detail_json, fetched_at
      FROM onestop_record WHERE geopin = ? ORDER BY submitted_date DESC LIMIT 100`).bind(geopin),
    db.prepare(`SELECT str_id, license_number, license_type, status, is_active, applied_date, issued_date, expiration_date, operator_name, address_raw
      FROM str_license WHERE geopin = ? AND removed_at IS NULL ORDER BY is_active DESC, coalesce(issued_date, applied_date) DESC LIMIT 50`).bind(geopin),
    db.prepare("SELECT source_id, name, last_success_at, upstream_updated_at, stale_after_hours FROM source ORDER BY source_id"),
  ]);
  const p = parcel!.results[0] as Parcel | undefined;
  if (!p) return null;

  const addrs = addresses!.results as Property["addresses"];
  const blockId = addrs.find((a) => !a.unit_id)?.block_id ?? addrs[0]?.block_id ?? null;
  const permitRows = permits!.results as Omit<Permit, "events">[];
  const caseRows = codeCases!.results as Omit<CodeCase, "events">[];

  const [permitEvents, caseEvents, requests, police] = await db.batch([
    db.prepare(`SELECT permit_num, kind, name, status, event_date, actor, detail, source_id FROM permit_event
      WHERE permit_num IN (SELECT value FROM json_each(?)) ORDER BY permit_num, event_date, seq`).bind(jsonChunks(permitRows.map((r) => r.permit_num).slice(0, 200))[0] ?? "[]"),
    db.prepare(`SELECT case_id, kind, event_date, type, result FROM code_event
      WHERE case_id IN (SELECT value FROM json_each(?)) ORDER BY case_id, event_date`).bind(JSON.stringify(caseRows.map((r) => r.case_id))),
    db.prepare(`SELECT request_type, count(*) n FROM service_request WHERE block_id = ? AND created_date >= ? GROUP BY 1 ORDER BY 2 DESC`).bind(blockId, since),
    db.prepare(`SELECT category, sum(n) n FROM police_call_month WHERE block_id = ? AND month >= ? GROUP BY 1 ORDER BY 2 DESC`).bind(blockId, since.slice(0, 7)),
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
    block: { block_id: blockId, requests12m: requests!.results as Property["block"]["requests12m"], police12m: police!.results as Property["block"]["police12m"] },
    freshness: freshness!.results as Freshness[],
  };
}
