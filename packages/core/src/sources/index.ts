// ABOUTME: Registry of every source adapter: the Socrata record sources (-> permit, code, STR, license, 311 tables) and NOPD calls.
// ABOUTME: Ingest looks adapters up by source_id; the loader merges sources that feed one table by `priority`.
import { source as businessLicense } from "./business_license";
import { source as codeCaseLegacy } from "./code_case_legacy";
import { source as codeHearing } from "./code_hearing";
import { source as codeInspection } from "./code_inspection";
import { source as codeViolation } from "./code_violation";
import { source as permitAib5 } from "./permit_aib5";
import { source as permitBlds } from "./permit_blds";
import { source as permitRcm3 } from "./permit_rcm3";
import { policeSources } from "./police_calls";
import { source as serviceRequest } from "./service_request";
import { source as strActive } from "./str_active";
import { source as strApplication } from "./str_application";
import { source as strNoncommercial } from "./str_noncommercial";
import type { PoliceCallSource, SourceDef } from "./types";

export type AnySource = SourceDef<object, object>;

export const recordSources: AnySource[] = [
  permitBlds, permitRcm3, permitAib5,
  codeCaseLegacy, codeInspection, codeViolation, codeHearing,
  strApplication, strActive, strNoncommercial,
  serviceRequest, businessLicense,
];

export { policeSources };

export const allSources: (AnySource | PoliceCallSource)[] = [...recordSources, ...policeSources];

export function sourceById(sourceId: string): AnySource | PoliceCallSource | undefined {
  return allSources.find((s) => s.sourceId === sourceId);
}

export * from "./types";
export * from "./helpers";
