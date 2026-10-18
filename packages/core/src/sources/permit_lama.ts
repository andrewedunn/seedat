// ABOUTME: Adapter for the LAMA permit archive (fdhh-psg3, 2004–2011): the same system and columns as rcm3, frozen in 2012.
// ABOUTME: The city publishes it as an xlsx download; scripts/convert-archive.py turns it into Socrata-shaped JSON rows.
import { blockIdForText } from "../block";
import { statePlaneToLatLon } from "../projection";
import { cleanDate, cleanPermitNum, dropContact, num, text, yesNo } from "./helpers";
import type { PermitRow, RawRow, SourceDef } from "./types";

const ID = "fdhh-psg3";
const LOCAL_PHONE = /(?<![\d-])\d{3}-\d{4}(?![\d-])/g;   // seven-digit numbers that dropContact (10-digit) leaves

/**
 * `descr` wraps the work description in import boilerplate that also holds the owner's mailing address:
 * "Work Descripton: <text>  Historical Import Type: ... Owner: <name> Owner Address: ...". Keep only <text>.
 */
function workDescription(descr: string | null): string | null {
  if (!descr) return null;
  const m = /^Work Descripton:\s*([\s\S]*?)\s*(?:Historical Import Type:|$)/.exec(descr);
  const body = m ? m[1]! : /Historical Import Type:/.test(descr) ? "" : descr;
  return dropContact(body.replace(LOCAL_PHONE, "")).replace(/\s{2,}/g, " ").trim() || null;
}

/** The owner's name from the boilerplate; the label after it is sometimes glued on ("Cedar Bayou LLCOwner Address"). */
function ownerName(descr: string | null): string | null {
  return text(/Owner:\s*(.*?)\s*Owner (?:Address|Edited By):/.exec(descr ?? "")?.[1]);
}

const point = (raw: RawRow) => statePlaneToLatLon(text(raw.x), text(raw.y));

export const source: SourceDef<PermitRow> = {
  sourceId: `socrata:${ID}`,
  name: "Permits - LAMA (historic 2004–2011)",
  url: `https://data.nola.gov/download/${ID}/application%2Fzip`,
  license: "CC0-1.0",
  table: "permit",
  priority: 4,
  frozen: true,
  key: (r) => r.permit_num,
  map(raw) {
    // About 30k mid-2011 rows carry no permit number and cannot be merged or traced; they are skipped.
    const permit_num = cleanPermitNum(raw.numstring);
    if (!permit_num) return null;
    const descr = text(raw.descr);
    const contractor = text(raw.contractors)?.replace(/\s+/g, " ");
    const p = point(raw);
    return {
      permit_num,
      address_raw: text(raw.address), block_id: blockIdForText(text(raw.address)),
      permit_type: text(raw.code), permit_type_desc: text(raw.type),
      description: workDescription(descr),
      status: text(raw.currentstatus), status_date: cleanDate(raw.currentstatusdate),
      is_closed: yesNo(raw.isclosed),
      applied_date: cleanDate(raw.filingdate), issued_date: cleanDate(raw.issuedate),
      est_cost: num(raw.constrval), fees_total: num(raw.totalfees), fees_unpaid: num(raw.unpaidfees),
      contractor: contractor ? JSON.stringify([{ name: contractor, trade: null, license: null }]) : null,
      owner_name: ownerName(descr),
      land_use: text(raw.landuse), zoning_filed: text(raw.zoning), historic_district_filed: text(raw.historicdistrict),
      council_district_filed: text(raw.councildistrict),
      tax_bill: text(raw.pin),
      lat: p?.lat ?? null, lon: p?.lon ?? null,
    };
  },
  matchInput(raw) {
    const p = point(raw);
    return { address: text(raw.address), taxBill: text(raw.pin), lat: p?.lat ?? null, lon: p?.lon ?? null };
  },
};
