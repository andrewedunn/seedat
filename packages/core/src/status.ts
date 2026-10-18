// ABOUTME: One definition of "open" for permits, used by the page, the MCP server and the summary SQL.
// ABOUTME: Based on the BLDS status_mapped values the city actually publishes.

/** status_mapped values that mean the permit is finished one way or another. */
export const CLOSED_PERMIT_STATUSES = ["Permit Finaled", "Permit Finaled with Conditions", "Permit Cancelled", "Occupancy"] as const;

export function isPermitOpen(p: { status_mapped?: string | null; status?: string | null; is_closed?: number | null; completed_date?: string | null }): boolean {
  if (p.is_closed === 1) return false;
  if (p.completed_date) return false;   // a completion date means finished, whatever the status text says
  if (p.status_mapped && (CLOSED_PERMIT_STATUSES as readonly string[]).includes(p.status_mapped)) return false;
  // Substring match, same as PERMIT_OPEN_SQL's LIKE patterns.
  return !/(VOID|CANCEL|WITHDRAWN|EXPIRED|FINAL|CLOSED)/i.test(p.status ?? "");
}

/** SQL predicate equivalent to isPermitOpen, for a table aliased or named `permit`. */
export const PERMIT_OPEN_SQL = `coalesce(is_closed, 0) = 0 AND completed_date IS NULL
  AND coalesce(status_mapped, '') NOT IN (${CLOSED_PERMIT_STATUSES.map((s) => `'${s}'`).join(", ")})
  AND upper(coalesce(status, '')) NOT LIKE '%VOID%' AND upper(coalesce(status, '')) NOT LIKE '%CANCEL%'
  AND upper(coalesce(status, '')) NOT LIKE '%WITHDRAWN%' AND upper(coalesce(status, '')) NOT LIKE '%EXPIRED%'
  AND upper(coalesce(status, '')) NOT LIKE '%FINAL%' AND upper(coalesce(status, '')) NOT LIKE '%CLOSED%'`;

/**
 * Event permits (special events, parades, floats, festivals, reviewing stands, tents) describe an event at a place,
 * not work on a property. They are kept but not placed by proximity, and are excluded from property match rates.
 * Identified by the type code at the end of the permit number, e.g. 18-12345-SPMA.
 */
export const EVENT_PERMIT_CODES = ["SPMA", "EFLO", "EFAI", "RVWS", "TENT", "PARA", "BRAC", "PKGL"] as const;
export const isEventPermit = (permitNum: string) => new RegExp(`-\\s*(${EVENT_PERMIT_CODES.join("|")})$`).test(permitNum);
/** SQL predicate: true for event permits, given a permit_num column expression. */
export const eventPermitSql = (col = "permit_num") => `(${EVENT_PERMIT_CODES.map((c) => `${col} LIKE '%${c}'`).join(" OR ")})`;
