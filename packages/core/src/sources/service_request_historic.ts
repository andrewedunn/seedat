// ABOUTME: Adapter for historic 311 calls 2012–2018 (3iz8-nghx): type, title, status, dates and the hundred-block only.
// ABOUTME: The live dataset re-published these tickets with 2019-01-01/02 as their created date; this one has the true times.
import { blockIdForText } from "../block";
import { cleanDate, socrataUrl, text } from "./helpers";
import type { ServiceRequestRow, SourceDef } from "./types";

const ID = "3iz8-nghx";

export const source: SourceDef<ServiceRequestRow> = {
  sourceId: `socrata:${ID}`,
  name: "311 calls (historic 2012–2018)",
  url: socrataUrl(ID),
  license: "CC0-1.0",
  table: "service_request",
  // The live 2jgv-pqrq copy wins type and status (current taxonomy, later closures); this archive wins the dates.
  priority: 2,
  wins: ["created_date", "closed_date"],
  frozen: true,
  key: (r) => r.request_id,
  map(raw) {
    const request_id = text(raw.ticket_id);
    if (!request_id) return null;
    return {
      request_id,
      block_id: blockIdForText(text(raw.street_address)),
      request_type: text(raw.issue_type), request_reason: text(raw.case_title),
      status: text(raw.ticket_status),
      created_date: cleanDate(raw.ticket_created_date_time), closed_date: cleanDate(raw.ticket_closed_date_time),
    };
  },
};
