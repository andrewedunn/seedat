// ABOUTME: Adapter for code-enforcement violations (3ehi-je3s) -> code_event rows of kind 'violation', keyed by violationid.
// ABOUTME: type is the cited violation title, detail is the code's plain-language description.
import { cleanDate, num, socrataUrl, text } from "./helpers";
import type { CodeEventRow, SourceDef } from "./types";

const ID = "3ehi-je3s";

export const source: SourceDef<CodeEventRow> = {
  sourceId: `socrata:${ID}`,
  name: "Code enforcement violations",
  url: socrataUrl(ID),
  license: "CC0-1.0",
  table: "code_event",
  priority: 1,
  key: (r) => r.source_key,
  map(raw) {
    const case_id = num(raw.caseid);
    const violationId = text(raw.violationid);
    if (case_id === null || violationId === null) return null;
    return {
      case_id, kind: "violation", event_date: cleanDate(raw.violationdate),
      type: text(raw.violation) ?? text(raw.codesection), result: null, detail: text(raw.description),
      source_id: `socrata:${ID}`, source_key: violationId,
    };
  },
};
