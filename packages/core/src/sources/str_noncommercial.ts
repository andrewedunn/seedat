// ABOUTME: Adapter for non-commercial short-term-rental licenses (2ei9-wqw2): status, type and operator name per license.
// ABOUTME: The dataset also names the owner; only the operator name is kept, matching the other STR sources.
import { cleanDate, socrataUrl, text } from "./helpers";
import { operatorName, strBase, strMatchInput } from "./str_common";
import type { SourceDef, StrLicenseRow } from "./types";

const ID = "2ei9-wqw2";

export const source: SourceDef<StrLicenseRow> = {
  sourceId: `socrata:${ID}`,
  name: "Non-commercial short-term rental licenses",
  url: socrataUrl(ID),
  license: "CC0-1.0",
  table: "str_license",
  priority: 3,
  key: (r) => r.str_id,
  map(raw) {
    const reference_code = text(raw.reference_code);
    if (!reference_code) return null;
    return {
      str_id: reference_code, license_number: text(raw.license_number), reference_code,
      license_type: text(raw.type), status: text(raw.current_status),
      operator_name: operatorName(raw.operator),
      ...strBase(raw),
      expiration_date: cleanDate(raw.expiration_date),
    };
  },
  matchInput: strMatchInput,
};
