// ABOUTME: Adapter for occupational (business) licences (hjcd-grvu): name, type, start date and address; owner, phone and mailing address are dropped.
// ABOUTME: Licences with an out-of-town address are kept but not offered to the New Orleans address matcher.
import { blockIdForText } from "../block";
import { cleanDate, pointFrom, socrataUrl, text } from "./helpers";
import type { BusinessLicenseRow, SourceDef } from "./types";

const ID = "hjcd-grvu";

const inCity = (raw: Record<string, unknown>) => {
  const city = text(raw.city);
  return city === null || /^new orleans$/i.test(city);
};

export const source: SourceDef<BusinessLicenseRow> = {
  sourceId: `socrata:${ID}`,
  name: "Occupational licenses",
  url: socrataUrl(ID),
  license: "CC0-1.0",
  table: "business_license",
  priority: 1,
  key: (r) => r.license_id,
  map(raw) {
    const license_id = text(raw.businesslicensenumber);
    if (!license_id) return null;
    const name = text(raw.businessname);
    return {
      license_id,
      address_raw: text(raw.address), block_id: inCity(raw) ? blockIdForText(text(raw.address)) : null,
      business_name: name === "0" ? null : name,
      business_type: text(raw.businesstype),
      issued_date: cleanDate(raw.businessstartdate),
    };
  },
  matchInput(raw) {
    if (!inCity(raw)) return { address: null };
    const p = pointFrom(raw.latitude, raw.longitude);
    return { address: text(raw.address), lat: p?.lat ?? null, lon: p?.lon ?? null };
  },
};
