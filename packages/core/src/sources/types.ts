// ABOUTME: Types shared by the source adapters: SourceDef (one upstream dataset -> one of our tables) and the row shapes it emits.
// ABOUTME: Rows carry content columns only; the loader adds match columns, row_hash and first/last_seen_at.
import type { MatchInput } from "../match";

/** A mapped row. Absent (undefined) columns mean "this source does not say", so partial sources can be merged. */
export type Cell = string | number | null | undefined;

export interface PermitRow {
  permit_num: string;
  address_raw?: Cell; block_id?: Cell;
  permit_type?: Cell; permit_type_desc?: Cell; permit_class?: Cell; work_class?: Cell;
  description?: Cell;
  status?: Cell; status_mapped?: Cell; status_date?: Cell;
  is_closed?: Cell;
  applied_date?: Cell; issued_date?: Cell; completed_date?: Cell; expires_date?: Cell; co_issued_date?: Cell;
  est_cost?: Cell; fees_total?: Cell; fees_unpaid?: Cell;
  contractor?: Cell;                 // JSON array [{name, trade, license}]
  owner_name?: Cell;
  land_use?: Cell; zoning_filed?: Cell; historic_district_filed?: Cell; council_district_filed?: Cell;
  tax_bill?: Cell;
  lat?: Cell; lon?: Cell;
  onestop_ref?: Cell;
}

export interface PermitEventRow {
  permit_num: string;
  seq: number;
  kind: "status";
  name: string;
  status: null;
  event_date: string;
  source_id: string;
}

export interface CodeCaseRow {
  case_id: number;
  case_no?: Cell;
  system: "legacy" | "obes";
  address_raw?: Cell; block_id?: Cell;
  stage?: Cell; key_status?: Cell; is_open?: Cell;
  filed_date?: Cell; status_date?: Cell;
  initial_inspection_date?: Cell; initial_inspection_result?: Cell;
  next_hearing_date?: Cell; prev_hearing_date?: Cell; prev_hearing_result?: Cell;
  last_permit_num?: Cell;
}

export interface CodeEventRow {
  case_id: number;
  kind: "inspection" | "violation" | "hearing";
  event_date: Cell;
  type: Cell; result: Cell; detail: Cell;
  source_id: string;
  source_key: string;
}

export interface StrLicenseRow {
  str_id: string;
  license_number?: Cell; reference_code?: Cell;
  address_raw?: Cell; block_id?: Cell;
  license_type?: Cell; status?: Cell;
  is_active?: Cell;                  // set only by the active-licences list; other sources leave it absent
  applied_date?: Cell; issued_date?: Cell; expiration_date?: Cell;
  operator_name?: Cell;
  lat?: Cell; lon?: Cell;
}

export interface BusinessLicenseRow {
  license_id: string;
  address_raw?: Cell; block_id?: Cell;
  business_name?: Cell; business_type?: Cell; status?: Cell; issued_date?: Cell;
}

export interface ServiceRequestRow {
  request_id: string;
  block_id: string | null;
  request_type?: Cell; request_reason?: Cell;
  status?: Cell; created_date?: Cell; closed_date?: Cell;
}

export type RawRow = Record<string, unknown>;

export interface SourceDef<Row extends object = object, Event extends object = never> {
  sourceId: string;
  name: string;
  url: string;
  license: string;
  table: "permit" | "code_case" | "code_event" | "str_license" | "business_license" | "service_request";
  /** Merge order when several sources feed one table: lower numbers win a column, later ones only fill gaps. */
  priority: number;
  /** Natural key in our table (for code_event, the source_key). */
  key(row: Row): string;
  /** One raw Socrata row -> our row, or null when the row is unusable (no key, deleted upstream). */
  map(raw: RawRow): Row | null;
  /** What the matcher needs; absent for tables that are never matched to a parcel (code_event, service_request). */
  matchInput?(raw: RawRow): MatchInput;
  /** Extra permit_event / code_event style rows derived from the same raw row. */
  events?(raw: RawRow): Event[];
}

/** One year of NOPD calls for service; aggregated into police_call_month, never stored per call. */
export interface PoliceCallMonth {
  block_id: string;
  month: string;          // 'YYYY-MM'
  category: PoliceCategory;
}

export const POLICE_CATEGORIES = [
  "violent", "domestic", "property", "disturbance", "traffic", "suspicious", "welfare", "proactive", "other",
] as const;
export type PoliceCategory = (typeof POLICE_CATEGORIES)[number];

export interface PoliceCallSource {
  sourceId: string;
  name: string;
  url: string;
  license: string;
  year: number;
  table: "police_call_month";
  /** Returns null for calls with no usable block (intersections, missing address) or no valid date. */
  map(raw: RawRow): PoliceCallMonth | null;
}
