// ABOUTME: Adapter for 311 service requests (2jgv-pqrq): type, reason, status, dates and the hundred-block only.
// ABOUTME: Address, coordinates and agency/contractor columns are never read; 311 must not be shown at address level.
import { blockIdForText } from "../block";
import { cleanDate, socrataUrl, text } from "./helpers";
import type { ServiceRequestRow, SourceDef } from "./types";

const ID = "2jgv-pqrq";

export const source: SourceDef<ServiceRequestRow> = {
  sourceId: `socrata:${ID}`,
  name: "311 service requests",
  url: socrataUrl(ID),
  license: "CC0-1.0",
  table: "service_request",
  priority: 1,
  key: (r) => r.request_id,
  map(raw) {
    const request_id = text(raw.service_request);
    if (!request_id) return null;
    return {
      request_id,
      block_id: blockIdForText(text(raw.final_address)),
      request_type: text(raw.request_type), request_reason: text(raw.request_reason),
      status: text(raw.request_status),
      created_date: cleanDate(raw.date_created), closed_date: cleanDate(raw.case_close_date),
    };
  },
};
