// ABOUTME: Adapter for Historical Permit Data (f7tt-z5vu, 1995–2009, nearly all 2000–2004): the pre-Accela permit system.
// ABOUTME: Numbers look like "B00000007" (B building, E electrical, M mechanical, S sign); the property key embeds the tax bill.
import { blockIdForText } from "../block";
import { statePlaneToLatLon } from "../projection";
import { cleanDate, cleanPermitNum, dropContact, socrataUrl, text } from "./helpers";
import type { PermitRow, RawRow, SourceDef } from "./types";

const ID = "f7tt-z5vu";
const KIND: Record<string, string> = { B: "Building", E: "Electrical", M: "Mechanical", S: "Sign" };

/** "600 MAZANT ST, NEW ORLEANS, LA 70150" -> "600 MAZANT ST" (the city and ZIP are often wrong). */
const address = (raw: RawRow) => text(text(raw.matchaddress)?.split(",")[0]);

/** "39W10560400001" = tax bill "39W105604" + a 5-digit sequence; "GENERATED01880" and typos of it carry none. */
function taxBill(raw: RawRow): string | null {
  const m = /^([0-9]{2}[0-9W][0-9]{6})[0-9]{5}$/.exec(text(raw.propertykey) ?? "");
  return m && !/^0+$/.test(m[1]!) ? m[1]! : null;
}

const point = (raw: RawRow) => statePlaneToLatLon(text(raw.x), text(raw.y));

export const source: SourceDef<PermitRow> = {
  sourceId: `socrata:${ID}`,
  name: "Historical permits (to 2009)",
  url: socrataUrl(ID),
  license: "CC0-1.0",
  table: "permit",
  priority: 6,
  frozen: true,
  key: (r) => r.permit_num,
  map(raw) {
    const permit_num = cleanPermitNum(raw.permitnumber);
    if (!permit_num) return null;
    const addr = address(raw);
    const description = text(raw.description)?.replace(/\s+/g, " ") ?? null;
    const p = point(raw);
    return {
      permit_num,
      address_raw: addr, block_id: blockIdForText(addr),
      permit_type_desc: KIND[permit_num[0]!] ?? null,
      description: description === null ? null : dropContact(description) || null,
      applied_date: cleanDate(raw.applicationdate), issued_date: cleanDate(raw.issuedate),
      owner_name: text(raw.parcelowner), zoning_filed: text(raw.zoning),
      tax_bill: taxBill(raw),
      lat: p?.lat ?? null, lon: p?.lon ?? null,
    };
  },
  matchInput(raw) {
    const p = point(raw);
    return { address: address(raw), taxBill: taxBill(raw), lat: p?.lat ?? null, lon: p?.lon ?? null };
  },
};
