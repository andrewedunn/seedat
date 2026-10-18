// ABOUTME: Adapter for the Accela permit archive (rw6e-a9x3, March 2004 – March 2012), a shapefile download.
// ABOUTME: Records carry the city's own GEOPIN, tax bill and state-plane point; staff names in the file are never read.
import { blockIdForText } from "../block";
import { statePlaneToLatLon } from "../projection";
import { cleanDate, cleanPermitNum, dropContact, num, text } from "./helpers";
import type { PermitRow, RawRow, SourceDef } from "./types";

const ID = "rw6e-a9x3";

/**
 * The public number is B1_ALT_ID ("04BLD-00046"). Kiosk and online post-Katrina repair approvals have none, so they
 * are keyed on Accela's internal id. "$$08MCH-00000-11406" rows are empty placeholder copies of real numbers.
 */
function permitNum(raw: RawRow): string | null {
  const alt = text(raw.b1_alt_id);
  if (alt) return alt.startsWith("$$") ? null : cleanPermitNum(alt);
  const id = text(raw.permit_id);
  return id ? `ACCELA-${id}` : null;
}

/** The filed address: house number (or the "1930-1932" range of a double), street, then any unit. */
function address(raw: RawRow): string | null {
  const nums = [text(raw.b1_hse_nbr), text(raw.sec_house_)].filter((n): n is string => !!n)
    .sort((a, b) => Number(a) - Number(b));
  const parts = [[...new Set(nums)].join("-"), text(raw.b1_str_dir), text(raw.b1_str_nam), text(raw.b1_str_suf), text(raw.b1_unit_ty), text(raw.b1_unit_st)];
  return text(parts.filter(Boolean).join(" "));
}

const point = (raw: RawRow) => statePlaneToLatLon(text(raw.x), text(raw.y));
// 41021509 (a real parcel, 100 St John Ct) is a default: 17,347 permits on 1,202 different streets carry it.
const DEFAULT_GEOPINS = new Set(["0", "41021509"]);
const geopin = (raw: RawRow) => (text(raw.geopin) && !DEFAULT_GEOPINS.has(text(raw.geopin)!) ? text(raw.geopin) : null);

export const source: SourceDef<PermitRow> = {
  sourceId: `socrata:${ID}`,
  name: "Permits - Accela (historic 2004–2012)",
  url: `https://data.nola.gov/download/${ID}/application%2Fzip`,
  license: "CC0-1.0",
  table: "permit",
  priority: 5,
  frozen: true,
  key: (r) => r.permit_num,
  map(raw) {
    const permit_num = permitNum(raw);
    if (!permit_num) return null;
    const addr = address(raw);
    const description = text(raw.b1_work_de);
    const p = point(raw);
    return {
      permit_num,
      address_raw: addr, block_id: blockIdForText(addr),
      permit_type: /^\d{2}([A-Z]{3})-/.exec(permit_num)?.[1] ?? null,
      permit_type_desc: text(raw.b1_per_typ), permit_class: text(raw.b1_per_sub), work_class: text(raw.b1_per_cat),
      description: description === null ? null : dropContact(description) || null,
      status: text(raw.b1_appl_st), status_date: cleanDate(raw.b1_appl__1),
      applied_date: cleanDate(raw.b1_file_dd) ?? cleanDate(raw.rec_date),
      est_cost: num(raw.job_value), fees_total: num(raw.total_fee), fees_unpaid: num(raw.balance),
      owner_name: text(raw.b1_owner_f),
      land_use: text(raw.existing_u), council_district_filed: text(raw.councildis),
      tax_bill: text(raw.taxbill),
      lat: p?.lat ?? null, lon: p?.lon ?? null,
    };
  },
  matchInput(raw) {
    const p = point(raw);
    return { address: address(raw), geopin: geopin(raw), taxBill: text(raw.taxbill), lat: p?.lat ?? null, lon: p?.lon ?? null };
  },
};
