// ABOUTME: Adapter for legacy code-enforcement cases (u6yx-v2tw): stage, status, inspection and hearing summary, linked permit.
// ABOUTME: Cases carry their own GEOPIN and state-plane coordinates, so the matcher can place most of them without the address.
import { blockIdForText } from "../block";
import { statePlaneToLatLon } from "../projection";
import { cleanDate, num, socrataUrl, text } from "./helpers";
import type { CodeCaseRow, SourceDef } from "./types";

const ID = "u6yx-v2tw";

export const source: SourceDef<CodeCaseRow> = {
  sourceId: `socrata:${ID}`,
  name: "Code enforcement cases (legacy system)",
  url: socrataUrl(ID),
  license: "CC0-1.0",
  table: "code_case",
  priority: 1,
  key: (r) => String(r.case_id),
  map(raw) {
    const case_id = num(raw.caseid);
    if (case_id === null) return null;
    const address = text(raw.location) ?? text(raw.geoaddress);
    return {
      case_id, case_no: text(raw.caseno), system: "legacy",
      address_raw: address, block_id: blockIdForText(address),
      stage: text(raw.stage), key_status: text(raw.keystatus),
      is_open: text(raw.o_c) === null ? null : /^o/i.test(text(raw.o_c)!) ? 1 : 0,
      filed_date: cleanDate(raw.casefiled), status_date: cleanDate(raw.statdate),
      initial_inspection_date: cleanDate(raw.initinspection), initial_inspection_result: text(raw.initinspresult),
      next_hearing_date: cleanDate(raw.nexthearingdate),
      prev_hearing_date: cleanDate(raw.prevhearingdate), prev_hearing_result: text(raw.prevhearingresult),
      last_permit_num: text(raw.lastpermit),
    };
  },
  matchInput(raw) {
    const p = statePlaneToLatLon(text(raw.xpos), text(raw.ypos));
    return { address: text(raw.location) ?? text(raw.geoaddress), geopin: text(raw.geopin), lat: p?.lat ?? null, lon: p?.lon ?? null };
  },
};
