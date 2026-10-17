// ABOUTME: Adapter for code-enforcement hearings (44ct-56tr) -> code_event rows of kind 'hearing'.
// ABOUTME: The dataset has no row id; a hearing is identified by its case and scheduled date, so a result change updates in place.
import { cleanDate, num, socrataUrl, text } from "./helpers";
import type { CodeEventRow, SourceDef } from "./types";

const ID = "44ct-56tr";

export const source: SourceDef<CodeEventRow> = {
  sourceId: `socrata:${ID}`,
  name: "Code enforcement hearings",
  url: socrataUrl(ID),
  license: "CC0-1.0",
  table: "code_event",
  priority: 1,
  key: (r) => r.source_key,
  map(raw) {
    const case_id = num(raw.caseid);
    if (case_id === null) return null;
    const event_date = cleanDate(raw.hearingdate);
    const prevDate = cleanDate(raw.prevhearing);
    const prevStat = text(raw.prevhearingstat);
    return {
      case_id, kind: "hearing", event_date,
      type: text(raw.casehistory), result: text(raw.judgment),
      detail: prevStat || prevDate ? `Previous hearing ${[prevDate, prevStat].filter(Boolean).join(": ")}` : null,
      source_id: `socrata:${ID}`, source_key: `${case_id}:${event_date ?? ""}`,
    };
  },
};
