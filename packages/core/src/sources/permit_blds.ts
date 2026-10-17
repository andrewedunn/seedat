// ABOUTME: Adapter for Permits - BLDS (72f9-bi28), the spine of the permit table: type, status, dates, cost, fees, contractor, tax bill.
// ABOUTME: BLDS has no coordinates; permits are placed by address and by the first tax-bill number in `pin`.
import { blockIdForText } from "../block";
import { cleanDate, cleanPermitNum, dropContact, num, socrataUrl, text } from "./helpers";
import type { PermitRow, SourceDef } from "./types";

const ID = "72f9-bi28";

const oneLine = (v: unknown) => text(v)?.replace(/\s+/g, " ") ?? null;

/** `link` is an One Stop redirect whose SearchString is the 6-character reference code. */
function onestopRef(link: unknown): string | null {
  const url = typeof link === "object" && link !== null ? (link as { url?: unknown }).url : link;
  return typeof url === "string" ? (/SearchString=([A-Za-z0-9]{6})(?![A-Za-z0-9])/.exec(url)?.[1] ?? null) : null;
}

function contractor(raw: Record<string, unknown>): string | null {
  const name = oneLine(raw.contractorcompanyname);
  if (!name) return null;
  return JSON.stringify([{ name, trade: oneLine(raw.contractortrade), license: oneLine(raw.contractorlicnum) }]);
}

export const source: SourceDef<PermitRow> = {
  sourceId: `socrata:${ID}`,
  name: "Permits - BLDS",
  url: socrataUrl(ID),
  license: "CC0-1.0",
  table: "permit",
  priority: 1,
  key: (r) => r.permit_num,
  map(raw) {
    const permit_num = cleanPermitNum(raw.permitnum);
    if (!permit_num) return null;
    const description = text(raw.description);
    return {
      permit_num,
      address_raw: text(raw.originaladdress1),
      block_id: blockIdForText(text(raw.originaladdress1)),
      permit_type: text(raw.permittype), permit_type_desc: text(raw.permittypedesc),
      permit_class: text(raw.permitclass), work_class: text(raw.workclass),
      description: description === null ? null : dropContact(description) || null,
      status: text(raw.statuscurrent), status_mapped: text(raw.statuscurrentmapped), status_date: cleanDate(raw.statusdate),
      applied_date: cleanDate(raw.applieddate), issued_date: cleanDate(raw.issuedate),
      completed_date: cleanDate(raw.completedate), expires_date: cleanDate(raw.expiresdate), co_issued_date: cleanDate(raw.coissueddate),
      est_cost: num(raw.estprojectcost), fees_total: num(raw.fee),
      contractor: contractor(raw),
      tax_bill: text(raw.pin),
      onestop_ref: onestopRef(raw.link),
    };
  },
  matchInput(raw) {
    return { address: text(raw.originaladdress1), taxBill: text(raw.pin)?.split(",")[0]?.trim() || null };
  },
};
