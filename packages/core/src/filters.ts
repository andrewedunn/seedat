// ABOUTME: Builds parameterized SQL for the MCP server's search tools (permits and properties) and matches loose
// ABOUTME: neighborhood names ("7th ward", "Treme") to the city's official names. Every value is bound, never inlined.
import { PERMIT_OPEN_SQL } from "./status";

const ORDINALS: Record<string, string> = { "1st": "first", "2nd": "second", "3rd": "third", "4th": "fourth", "5th": "fifth", "6th": "sixth", "7th": "seventh", "8th": "eighth", "9th": "ninth", "10th": "tenth", "11th": "eleventh", "12th": "twelfth", "13th": "thirteenth", "14th": "fourteenth", "15th": "fifteenth", "16th": "sixteenth", "17th": "seventeenth" };

function normHood(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, " ").trim()
    .split(" ").map((w) => ORDINALS[w] ?? w).filter((w) => w !== "the").join(" ");
}

/** Official neighborhood name for loose input, or null when nothing (or more than one thing) matches. */
export function matchNeighborhood(input: string, official: string[]): string | null {
  const q = normHood(input);
  if (!q) return null;
  const exact = official.filter((h) => normHood(h) === q);
  if (exact.length === 1) return exact[0]!;
  const prefix = official.filter((h) => normHood(h).startsWith(`${q} `) || normHood(h) === q);
  return prefix.length === 1 ? prefix[0]! : null;
}

export interface Query { sql: string; params: (string | number)[]; countSql: string; countParams: (string | number)[] }
const MAX_LIMIT = 500;
/** Ask for one extra row so callers can say whether results were truncated. */
const limitParam = (n: number | undefined) => Math.min(Math.max(1, Math.floor(n ?? 50)), MAX_LIMIT) + 1;

export interface PermitFilters {
  neighborhood?: string; councilDistrict?: string; ward?: string; historicDistrict?: string;
  type?: string; text?: string; minCost?: number; maxCost?: number; since?: string; until?: string; open?: boolean; limit?: number;
}

export function searchPermitsQuery(f: PermitFilters): Query {
  const where: string[] = ["p.removed_at IS NULL"], params: (string | number)[] = [];
  const add = (clause: string, v?: string | number) => { where.push(clause); if (v !== undefined) params.push(v); };
  if (f.neighborhood) add("pa.neighborhood = ?", f.neighborhood);
  if (f.councilDistrict) add("pa.council_district = ?", f.councilDistrict.toUpperCase());
  if (f.ward) add("pa.ward = ?", String(f.ward));
  if (f.historicDistrict) add("pa.local_historic_district = ?", f.historicDistrict);
  if (f.type) add("p.permit_type = ?", f.type.toUpperCase());
  if (f.text) {
    // Quote each word so FTS syntax characters in user text are treated literally.
    const terms = f.text.split(/\s+/).map((w) => w.replace(/"/g, "")).filter(Boolean).map((w) => `"${w}"`).join(" ");
    if (terms) add("p.rowid IN (SELECT rowid FROM permit_fts WHERE permit_fts MATCH ?)", terms);
  }
  if (f.minCost !== undefined) add("p.est_cost >= ?", f.minCost);
  if (f.maxCost !== undefined) add("p.est_cost <= ?", f.maxCost);
  if (f.since) add("coalesce(p.applied_date, p.issued_date) >= ?", f.since);
  if (f.until) add("coalesce(p.applied_date, p.issued_date) < ?", f.until);
  if (f.open === true) add(`(${PERMIT_OPEN_SQL.replace(/\b(is_closed|status_mapped|status|completed_date)\b/g, "p.$1")})`);
  if (f.open === false) add(`NOT (${PERMIT_OPEN_SQL.replace(/\b(is_closed|status_mapped|status|completed_date)\b/g, "p.$1")})`);
  const countSql = `SELECT count(*) n FROM permit p LEFT JOIN parcel pa ON pa.geopin = p.geopin WHERE ${where.join(" AND ")}`;
  const countParams = [...params];
  params.push(limitParam(f.limit));
  return {
    countSql, countParams,
    sql: `SELECT p.permit_num, p.permit_type, p.permit_type_desc, p.work_class, p.description, p.status, p.status_mapped,
  p.applied_date, p.issued_date, p.completed_date, p.est_cost, p.days_to_issue, p.geopin, p.address_raw, p.match_type,
  pa.neighborhood, pa.council_district, pa.local_historic_district
FROM permit p LEFT JOIN parcel pa ON pa.geopin = p.geopin
WHERE ${where.join(" AND ")}
ORDER BY coalesce(p.applied_date, p.issued_date) DESC LIMIT ?`,
    params,
  };
}

export interface PropertyFilters {
  neighborhood?: string; ward?: string; councilDistrict?: string; zoningPrefix?: string; hdlcControl?: "Full" | "Partial";
  historicDistrict?: string; openCodeCase?: boolean; strActive?: boolean; noPermitSince?: string; permitSince?: string;
  demolitionSince?: string; limit?: number;
}

export function findPropertiesQuery(f: PropertyFilters): Query {
  const where: string[] = [], params: (string | number)[] = [];
  const add = (clause: string, v?: string | number) => { where.push(clause); if (v !== undefined) params.push(v); };
  if (f.neighborhood) add("pa.neighborhood = ?", f.neighborhood);
  if (f.ward) add("pa.ward = ?", String(f.ward));
  if (f.councilDistrict) add("pa.council_district = ?", f.councilDistrict.toUpperCase());
  if (f.zoningPrefix) add("pa.zoning LIKE ?", `${f.zoningPrefix.toUpperCase()}%`);
  if (f.hdlcControl) add("pa.hdlc_control = ?", f.hdlcControl);
  if (f.historicDistrict) add("pa.local_historic_district = ?", f.historicDistrict);
  if (f.openCodeCase === true) add("s.code_cases_open > 0");
  if (f.openCodeCase === false) add("s.code_cases_open = 0");
  if (f.strActive === true) add("s.str_active = 1");
  if (f.noPermitSince) add("(s.last_permit_date IS NULL OR s.last_permit_date < ?)", f.noPermitSince);
  if (f.permitSince) add("s.last_permit_date >= ?", f.permitSince);
  if (f.demolitionSince) add("s.demolition_permit_date >= ?", f.demolitionSince);
  const countSql = `SELECT count(*) n FROM parcel pa JOIN parcel_summary s ON s.geopin = pa.geopin ${where.length ? `WHERE ${where.join(" AND ")}` : ""}`;
  const countParams = [...params];
  params.push(limitParam(f.limit));
  return {
    countSql, countParams,
    sql: `SELECT pa.geopin, (SELECT full_address FROM address WHERE geopin = pa.geopin AND unit_id IS NULL LIMIT 1) AS address,
  pa.neighborhood, pa.ward, pa.council_district, pa.zoning, pa.local_historic_district, pa.hdlc_control,
  s.permits_total, s.permits_open, s.last_permit_date, s.code_cases_open, s.last_code_case_date, s.str_active, s.demolition_permit_date
FROM parcel pa JOIN parcel_summary s ON s.geopin = pa.geopin
${where.length ? `WHERE ${where.join(" AND ")}` : ""}
ORDER BY s.code_cases_open DESC, s.last_code_case_date DESC LIMIT ?`,
    params,
  };
}
