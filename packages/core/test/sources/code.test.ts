// ABOUTME: Tests for the legacy code-enforcement adapters: cases, inspections, violations and hearings.
// ABOUTME: Uses real rows; confirms case ids, open/closed, GEOPIN and state-plane coordinates, and event source keys.
import { describe, expect, it } from "vitest";
import cases from "../fixtures/code_cases.json";
import inspections from "../fixtures/uh5a-f7uw.json";
import violations from "../fixtures/3ehi-je3s.json";
import hearings from "../fixtures/44ct-56tr.json";
import { source as caseSource } from "../../src/sources/code_case_legacy";
import { source as inspectionSource } from "../../src/sources/code_inspection";
import { source as violationSource } from "../../src/sources/code_violation";
import { source as hearingSource } from "../../src/sources/code_hearing";

type Raw = Record<string, unknown>;
const rows = (x: unknown) => x as Raw[];

describe("code_case_legacy", () => {
  const [open, fresh, closed] = rows(cases) as [Raw, Raw, Raw];

  it("maps a case with a hearing and a linked permit", () => {
    expect(caseSource.sourceId).toBe("socrata:u6yx-v2tw");
    const r = caseSource.map(open)!;
    expect(caseSource.key(r)).toBe(String(r.case_id));
    expect(r).toMatchObject({
      case_id: Number(open.caseid), case_no: "19-07762-MPM", system: "legacy", address_raw: "225 14Th St", block_id: "200 FOURTEENTH ST",
      stage: "3 - Hearing", is_open: 1, filed_date: "2019-07-30T16:41:40", status_date: "2021-08-03T11:30:38",
      initial_inspection_date: "2019-09-09T15:00:00", initial_inspection_result: "Violation: No WIP",
      prev_hearing_date: "2021-08-03T11:30:38", prev_hearing_result: "Result Pending", last_permit_num: "16-41581-RTRE",
    });
  });

  it("flags closed cases", () => {
    expect(caseSource.map(closed)!.is_open).toBe(0);
  });

  it("passes the source GEOPIN and projected coordinates to the matcher", () => {
    const m = caseSource.matchInput!(open);
    expect(m.address).toBe("225 14Th St");
    expect(m.geopin).toBe("41025586");
    expect(m.lat).toBeCloseTo(30.0, 1);
    expect(m.lon).toBeCloseTo(-90.1, 1);
  });

  it("gives no coordinates for the -1 not-geocoded placeholder", () => {
    const m = caseSource.matchInput!(fresh);
    expect(m.lat ?? null).toBeNull();
    expect(m.geopin ?? null).toBeNull();
    expect(caseSource.map(fresh)).toMatchObject({ is_open: 1, last_permit_num: null });
  });

  it("falls back to geoaddress when location is missing", () => {
    expect(caseSource.map({ ...open, location: undefined })!.address_raw).toBe("225 14Th St");
  });
});

describe("code events", () => {
  it("inspections: a stable hash key when the dataset has no id", () => {
    expect(inspectionSource.table).toBe("code_event");
    const [x, y] = rows(inspections) as [Raw, Raw];
    const r = inspectionSource.map(x)!;
    expect(r).toMatchObject({ case_id: 171833, kind: "inspection", event_date: "2013-03-01", type: "Inspection", result: "Violation: No WIP", source_id: "socrata:uh5a-f7uw" });
    expect(r.source_key).toMatch(/^[0-9a-f]{14}$/);
    expect(inspectionSource.key(r)).toBe(r.source_key);
    expect(inspectionSource.map({ ...x })!.source_key).toBe(r.source_key);
    expect(inspectionSource.map(y)!.source_key).not.toBe(r.source_key);
  });

  it("inspections: never carries the inspector's name", () => {
    expect(JSON.stringify(inspectionSource.map(rows(inspections)[0]!))).not.toContain("Alexander");
  });

  it("violations: keyed by violationid", () => {
    const r = violationSource.map(rows(violations)[0]!)!;
    expect(r).toMatchObject({ case_id: 171833, kind: "violation", source_key: "547585", event_date: "2013-03-06T10:53:03", type: "28-11 Floor Joists", source_id: "socrata:3ehi-je3s" });
    expect(r.detail).toMatch(/floor joists/);
  });

  it("hearings: keyed by case and hearing date", () => {
    const r = hearingSource.map(rows(hearings)[0]!)!;
    expect(r).toMatchObject({ case_id: 329801, kind: "hearing", event_date: "2026-12-15T09:00:30", type: "Reset Hearing", result: "Result Pending", source_id: "socrata:44ct-56tr" });
    expect(r.source_key).toBe("329801:2026-12-15T09:00:30");
    expect(r.detail).toBe("Previous hearing 2026-10-15T14:45:30: Reset: Work In Progress");
  });

  it("events without a case id are dropped", () => {
    expect(violationSource.map({ ...rows(violations)[0]!, caseid: undefined })).toBeNull();
    expect(inspectionSource.map({ ...rows(inspections)[0]!, caseid: undefined })).toBeNull();
  });
});
