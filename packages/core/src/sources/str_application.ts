// ABOUTME: Adapter for short-term-rental applications and licenses (en36-xvxg), 2017 onward; one row per application.
// ABOUTME: Keyed by reference_code because renewals reuse a license number; applications never issued have no license number at all.
import { socrataUrl, text } from "./helpers";
import { operatorName, strBase, strMatchInput } from "./str_common";
import type { SourceDef, StrLicenseRow } from "./types";

const ID = "en36-xvxg";

export const source: SourceDef<StrLicenseRow> = {
  sourceId: `socrata:${ID}`,
  name: "Short-term rental applications",
  url: socrataUrl(ID),
  license: "CC0-1.0",
  table: "str_license",
  priority: 1,
  key: (r) => r.str_id,
  map(raw) {
    const reference_code = text(raw.reference_code);
    if (!reference_code) return null;
    return {
      str_id: reference_code, license_number: text(raw.license_number), reference_code,
      license_type: text(raw.license_type), status: text(raw.current_status),
      operator_name: operatorName(raw.contact_name),
      ...strBase(raw),
    };
  },
  matchInput: strMatchInput,
};
