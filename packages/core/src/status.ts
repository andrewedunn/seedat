// ABOUTME: One definition of "open" for permits, used by the page, the MCP server and the summary SQL.
// ABOUTME: Based on the BLDS status_mapped values the city actually publishes.

/** status_mapped values that mean the permit is finished one way or another. */
export const CLOSED_PERMIT_STATUSES = ["Permit Finaled", "Permit Finaled with Conditions", "Permit Cancelled", "Occupancy"] as const;

export function isPermitOpen(p: { status_mapped?: string | null; status?: string | null; is_closed?: number | null }): boolean {
  if (p.is_closed === 1) return false;
  if (p.status_mapped && (CLOSED_PERMIT_STATUSES as readonly string[]).includes(p.status_mapped)) return false;
  // Substring match, same as PERMIT_OPEN_SQL's LIKE patterns.
  return !/(VOID|CANCEL|WITHDRAWN|EXPIRED|FINAL)/i.test(p.status ?? "");
}

/** SQL predicate equivalent to isPermitOpen, for a table aliased or named `permit`. */
export const PERMIT_OPEN_SQL = `coalesce(is_closed, 0) = 0
  AND coalesce(status_mapped, '') NOT IN (${CLOSED_PERMIT_STATUSES.map((s) => `'${s}'`).join(", ")})
  AND upper(coalesce(status, '')) NOT LIKE '%VOID%' AND upper(coalesce(status, '')) NOT LIKE '%CANCEL%'
  AND upper(coalesce(status, '')) NOT LIKE '%WITHDRAWN%' AND upper(coalesce(status, '')) NOT LIKE '%EXPIRED%'
  AND upper(coalesce(status, '')) NOT LIKE '%FINAL%'`;
