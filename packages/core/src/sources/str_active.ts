// ABOUTME: Adapter for the active short-term-rental license list (ufdg-ajws); presence in this list sets is_active.
// ABOUTME: Shares the application's reference_code key, so the loader merges it onto the en36-xvxg row.
import { socrataUrl, text } from "./helpers";
import { operatorName, strBase, strMatchInput } from "./str_common";
import type { SourceDef, StrLicenseRow } from "./types";

const ID = "ufdg-ajws";

export const source: SourceDef<StrLicenseRow> = {
  sourceId: `socrata:${ID}`,
  name: "Active short-term rental licenses",
  url: socrataUrl(ID),
  license: "CC0-1.0",
  table: "str_license",
  priority: 2,
  key: (r) => r.str_id,
  map(raw) {
    const reference_code = text(raw.reference_code);
    if (!reference_code) return null;
    return {
      str_id: reference_code, license_number: text(raw.license_number), reference_code,
      license_type: text(raw.license_type), is_active: 1,
      operator_name: operatorName(raw.operator_name),
      ...strBase(raw),
    };
  },
  matchInput: strMatchInput,
};
