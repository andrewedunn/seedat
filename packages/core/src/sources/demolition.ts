// ABOUTME: Adapter for BlightStatus demolitions (e3wd-h7q2, 2009–2019): program (NORA, IDC, FEMA, SDER), units and dates.
// ABOUTME: The dataset has no record id, so rows are keyed on a hash of program, address and start date.
import { blockIdForText } from "../block";
import { cleanDate, hash53, num, socrataUrl, text } from "./helpers";
import type { DemolitionRow, RawRow, SourceDef } from "./types";

const ID = "e3wd-h7q2";

/** "2443 Louisa Street, New Orleans" -> "2443 Louisa Street". */
const address = (raw: RawRow) => text(text(raw.full_address)?.replace(/,\s*New Orleans\s*$/i, ""));
const geopin = (raw: RawRow) => (text(raw.geopin) && text(raw.geopin) !== "0" ? text(raw.geopin) : null);

export const source: SourceDef<DemolitionRow> = {
  sourceId: `socrata:${ID}`,
  name: "BlightStatus demolitions",
  url: socrataUrl(ID),
  license: "CC0-1.0",
  table: "demolition",
  priority: 1,
  frozen: true,
  key: (r) => r.demolition_id,
  map(raw) {
    const addr = address(raw);
    const start_date = cleanDate(raw.demolition_start);
    if (!addr && !start_date) return null;
    const program = text(raw.program);
    return {
      demolition_id: hash53(`${program ?? ""}|${addr?.toUpperCase() ?? ""}|${start_date ?? ""}`).toString(16).padStart(14, "0"),
      address_raw: addr, block_id: blockIdForText(addr),
      program, case_id: text(raw.caseid), units: num(raw.units), council_district_filed: text(raw.council_district),
      start_date, complete_date: cleanDate(raw.demolition_complete),
    };
  },
  matchInput(raw) {
    return { address: address(raw), geopin: geopin(raw) };
  },
};
