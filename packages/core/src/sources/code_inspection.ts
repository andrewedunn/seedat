// ABOUTME: Adapter for code-enforcement inspections (uh5a-f7uw) -> code_event rows of kind 'inspection'.
// ABOUTME: The dataset has no row id, so the source key is a hash of the row; the inspector's name is deliberately not kept.
import { cleanDate, num, rowHash, socrataUrl, text } from "./helpers";
import type { CodeEventRow, SourceDef } from "./types";

const ID = "uh5a-f7uw";

export const source: SourceDef<CodeEventRow> = {
  sourceId: `socrata:${ID}`,
  name: "Code enforcement inspections",
  url: socrataUrl(ID),
  license: "CC0-1.0",
  table: "code_event",
  priority: 1,
  key: (r) => r.source_key,
  map(raw) {
    const case_id = num(raw.caseid);
    if (case_id === null) return null;
    const event_date = cleanDate(raw.inspectiondate);
    const type = text(raw.inspectiontype);
    const result = text(raw.inspectionresult);
    return {
      case_id, kind: "inspection", event_date, type, result, detail: null,
      source_id: `socrata:${ID}`,
      source_key: rowHash({ case_id, event_date, type, result, inspector: text(raw.inspector) }),
    };
  },
};
