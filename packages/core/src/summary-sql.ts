// ABOUTME: SQL that (re)computes parcel_summary rows from the activity tables for a JSON array of GEOPINs.
// ABOUTME: Shared by the backfill (all parcels, in chunks) and the nightly Worker (only parcels that changed).
import { PERMIT_OPEN_SQL } from "./status";

/** One bound parameter: a JSON array of GEOPINs. `now` is inlined as the computed_at timestamp. */
export function parcelSummarySql(now: string): string {
  const since5y = `date('${now.slice(0, 10)}', '-5 years')`;
  const since12m = `date('${now.slice(0, 10)}', '-12 months')`;
  return `
INSERT INTO parcel_summary (geopin, permits_total, permits_open, last_permit_date, last_permit_type, permit_value_5y,
  code_cases_total, code_cases_open, last_code_case_date, str_active, str_type, demolition_permit_date,
  block_311_12m, block_police_12m, summary_text, computed_at)
SELECT p.geopin,
  (SELECT count(*) FROM permit WHERE geopin = p.geopin),
  (SELECT count(*) FROM permit WHERE geopin = p.geopin AND removed_at IS NULL AND ${PERMIT_OPEN_SQL}),
  (SELECT max(coalesce(applied_date, issued_date)) FROM permit WHERE geopin = p.geopin),
  (SELECT permit_type FROM permit WHERE geopin = p.geopin ORDER BY coalesce(applied_date, issued_date) DESC LIMIT 1),
  (SELECT sum(est_cost) FROM permit WHERE geopin = p.geopin AND coalesce(applied_date, issued_date) >= ${since5y}),
  (SELECT count(*) FROM code_case WHERE geopin = p.geopin),
  (SELECT count(*) FROM code_case WHERE geopin = p.geopin AND +is_open = 1),
  (SELECT max(filed_date) FROM code_case WHERE geopin = p.geopin),
  (SELECT count(*) > 0 FROM str_license WHERE geopin = p.geopin AND is_active = 1),
  (SELECT license_type FROM str_license WHERE geopin = p.geopin AND is_active = 1 LIMIT 1),
  (SELECT max(coalesce(issued_date, applied_date)) FROM permit WHERE geopin = p.geopin AND (permit_type LIKE '%DEMO%' OR permit_num LIKE '%-DEMO')),
  (SELECT count(*) FROM service_request WHERE block_id = (SELECT block_id FROM address WHERE geopin = p.geopin LIMIT 1) AND created_date >= ${since12m}),
  (SELECT coalesce(sum(n), 0) FROM police_call_month WHERE block_id = (SELECT block_id FROM address WHERE geopin = p.geopin LIMIT 1) AND month >= substr(${since12m}, 1, 7)),
  NULL, '${now}'
FROM parcel p WHERE p.geopin IN (SELECT value FROM json_each(?))
ON CONFLICT (geopin) DO UPDATE SET permits_total = excluded.permits_total, permits_open = excluded.permits_open,
  last_permit_date = excluded.last_permit_date, last_permit_type = excluded.last_permit_type, permit_value_5y = excluded.permit_value_5y,
  code_cases_total = excluded.code_cases_total, code_cases_open = excluded.code_cases_open, last_code_case_date = excluded.last_code_case_date,
  str_active = excluded.str_active, str_type = excluded.str_type, demolition_permit_date = excluded.demolition_permit_date,
  block_311_12m = excluded.block_311_12m, block_police_12m = excluded.block_police_12m, computed_at = excluded.computed_at;`;
}
