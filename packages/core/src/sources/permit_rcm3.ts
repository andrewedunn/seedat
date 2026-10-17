// ABOUTME: Adapter for Permits (rcm3-fn58): owner, fees, closed flag, land use, filed zoning/district, and coordinates that BLDS lacks.
// ABOUTME: Also fills address, status and dates for permits BLDS omits; the loader merges by priority so BLDS wins shared columns.
import { blockIdForText } from "../block";
import { cleanDate, cleanPermitNum, dropContact, num, pointFrom, socrataUrl, text, yesNo } from "./helpers";
import type { PermitRow, RawRow, SourceDef } from "./types";

const ID = "rcm3-fn58";

function point(raw: RawRow) {
  const loc = (typeof raw.location_1 === "object" && raw.location_1 !== null ? raw.location_1 : {}) as { latitude?: unknown; longitude?: unknown };
  return pointFrom(loc.latitude, loc.longitude);
}

export const source: SourceDef<PermitRow> = {
  sourceId: `socrata:${ID}`,
  name: "Permits",
  url: socrataUrl(ID),
  license: "CC0-1.0",
  table: "permit",
  priority: 2,
  key: (r) => r.permit_num,
  map(raw) {
    const permit_num = cleanPermitNum(raw.numstring);
    if (!permit_num) return null;
    const p = point(raw);
    const description = text(raw.description);
    return {
      permit_num,
      address_raw: text(raw.address), block_id: blockIdForText(text(raw.address)),
      permit_type: text(raw.code), permit_type_desc: text(raw.type),
      description: description === null ? null : dropContact(description) || null,
      status: text(raw.currentstatus), status_date: cleanDate(raw.currentstatusdate),
      is_closed: yesNo(raw.isclosed),
      applied_date: cleanDate(raw.filingdate), issued_date: cleanDate(raw.issuedate),
      est_cost: num(raw.constrval), fees_total: num(raw.totalfees), fees_unpaid: num(raw.unpaidfees),
      owner_name: text(raw.owner),
      land_use: text(raw.landuse), zoning_filed: text(raw.zoning), historic_district_filed: text(raw.historicdistrict),
      council_district_filed: text(raw.councildist),
      tax_bill: text(raw.pin),
      lat: p?.lat ?? null, lon: p?.lon ?? null,
    };
  },
  matchInput(raw) {
    const p = point(raw);
    return { address: text(raw.address), taxBill: text(raw.pin)?.split(",")[0]?.trim() || null, lat: p?.lat ?? null, lon: p?.lon ?? null };
  },
};
