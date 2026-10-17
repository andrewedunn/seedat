// ABOUTME: Per-dataset SoQL windows for nightly pulls: rows created or touched in the last N days.
// ABOUTME: Weekly full pulls (no window) catch status changes on older records and removals upstream.

const D = (cols: string[]) => (since: string) => cols.map((c) => `${c} >= '${since}'`).join(" OR ");

/** source dataset id -> window builder. Absent = always pull in full (small datasets). */
export const WINDOWS: Record<string, (since: string) => string> = {
  "72f9-bi28": D(["applieddate", "issuedate", "completedate", "statusdate"]),
  "rcm3-fn58": D(["filingdate", "issuedate", "currentstatusdate"]),
  "aib5-en5t": D(["d_create", "currentstatusdate", "issue_date", "lastcomment"]),
  "u6yx-v2tw": D(["casefiled", "statdate", "initinspection"]),
  "uh5a-f7uw": D(["inspectiondate"]),
  "3ehi-je3s": D(["violationdate", "lastupload"]),
  "44ct-56tr": D(["hearingdate", "caseestablished", "inspected"]),
  "en36-xvxg": D(["application_date", "issue_date", "expiration_date"]),
  // 311 is a true upsert upstream, so its system :updated_at is a reliable change marker.
  "2jgv-pqrq": (since) => `:updated_at >= '${since}'`,
};

export const NIGHTLY_WINDOW_DAYS = 60;
