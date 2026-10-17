// ABOUTME: Adapter for OBES permit applications (aib5-en5t): coordinates and review milestone dates, plus a permit_event per milestone.
// ABOUTME: Milestone events use fixed sequence numbers from 900 so they never collide with One Stop detail-page events.
import { blockIdForText } from "../block";
import { statePlaneToLatLon } from "../projection";
import { cleanDate, cleanPermitNum, dropContact, pointFrom, socrataUrl, text, yesNo } from "./helpers";
import type { PermitEventRow, PermitRow, RawRow, SourceDef } from "./types";

const ID = "aib5-en5t";

/** Column, label, in pipeline order. The position is the event's sequence number offset. */
const MILESTONES = [
  ["application_submitted", "Application submitted"],
  ["application_review", "Application review"],
  ["zoning_review", "Zoning review"],
  ["plan_review", "Plan review"],
  ["permit_approved", "Permit approved"],
  ["issue_date", "Issue date"],
  ["date_of_first_inspection", "First inspection"],
] as const;
export const MILESTONE_SEQ_BASE = 900;

function point(raw: RawRow) {
  return pointFrom(raw.latitude, raw.longitude) ?? statePlaneToLatLon(text(raw.x), text(raw.y));
}

export const source: SourceDef<PermitRow, PermitEventRow> = {
  sourceId: `socrata:${ID}`,
  name: "OBES permit applications",
  url: socrataUrl(ID),
  license: "CC0-1.0",
  table: "permit",
  priority: 3,
  key: (r) => r.permit_num,
  map(raw) {
    const permit_num = cleanPermitNum(raw.permitnumber);
    if (!permit_num || yesNo(raw.isdeleted) === 1) return null;
    const p = point(raw);
    const description = text(raw.descr);
    return {
      permit_num,
      address_raw: text(raw.address), block_id: blockIdForText(text(raw.address)),
      description: description === null ? null : dropContact(description) || null,
      status: text(raw.currentstatus), status_date: cleanDate(raw.currentstatusdate),
      is_closed: yesNo(raw.isclosed),
      applied_date: cleanDate(raw.application_submitted), issued_date: cleanDate(raw.issue_date),
      co_issued_date: cleanDate(raw.certificate_of_occupancy),
      land_use: text(raw.landuse),
      lat: p?.lat ?? null, lon: p?.lon ?? null,
    };
  },
  matchInput(raw) {
    const p = point(raw);
    return { address: text(raw.address), lat: p?.lat ?? null, lon: p?.lon ?? null };
  },
  events(raw) {
    const permit_num = cleanPermitNum(raw.permitnumber);
    if (!permit_num) return [];
    const out: PermitEventRow[] = [];
    MILESTONES.forEach(([col, name], i) => {
      const event_date = cleanDate(raw[col]);
      if (event_date) out.push({ permit_num, seq: MILESTONE_SEQ_BASE + i, kind: "status", name, status: null, event_date, source_id: `socrata:${ID}` });
    });
    return out;
  },
};
