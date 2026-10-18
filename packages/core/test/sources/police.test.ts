// ABOUTME: Tests for the NOPD calls-for-service mapper (block, month, category) and the source registry.
// ABOUTME: Category cases use real NOPD type texts; calls without a block-level address are skipped.
import { describe, expect, it } from "vitest";
import calls from "../fixtures/es9j-6y5d.json";
import { policeCategory, policeSources } from "../../src/sources/police_calls";
import { allSources, sourceById } from "../../src/sources";

type Raw = Record<string, unknown>;

describe("police calls", () => {
  const [tow, areaCheck] = calls as Raw[] as [Raw, Raw];
  const src2026 = policeSources.find((s) => s.year === 2026)!;

  it("registers every yearly dataset 2011-2026", () => {
    expect(policeSources.map((s) => s.year).sort()).toEqual(Array.from({ length: 16 }, (_, i) => 2011 + i));
    expect(src2026.sourceId).toBe("socrata:es9j-6y5d");
    expect(policeSources.find((s) => s.year === 2019)!.sourceId).toBe("socrata:qf6q-pp4b");
    expect(src2026.license).toMatch(/NOPD/);
  });

  it("maps a call to block, month and category and nothing else", () => {
    expect(src2026.map(tow!)).toEqual({ block_id: "300 CANAL ST", month: "2026-01", category: "other" });
    expect(src2026.map(areaCheck!)).toEqual({ block_id: "6400 PONTCHARTRAIN BLVD", month: "2026-01", category: "proactive" });
  });

  it("uses the initial type when the final type was reclassified, and falls back on older datasets", () => {
    expect(src2026.map({ ...tow, initialtypetext: "SHOOTING" })!.category).toBe("violent");
    const { initialtypetext: _a, initialtype: _b, ...old } = tow as Raw;
    expect(src2026.map({ ...old, typetext: "BURGLARY (RESIDENCE)" })!.category).toBe("property");
  });

  it("skips intersections and calls with no address or date", () => {
    expect(src2026.map({ ...tow, block_address: "Terpsichore St & Baronne St" })).toBeNull();
    expect(src2026.map({ ...tow, block_address: undefined })).toBeNull();
    expect(src2026.map({ ...tow, timecreate: undefined })).toBeNull();
  });

  it("groups common NOPD call types", () => {
    const cases: Record<string, string> = {
      "SHOOTING": "violent", "ARMED ROBBERY": "violent", "AGGRAVATED BATTERY BY SHOOTING": "violent", "SIMPLE BATTERY": "violent",
      "DOMESTIC DISTURBANCE": "domestic", "BATTERY DOMESTIC": "domestic", "DOMESTIC VIOLENCE": "domestic",
      "BURGLARY (RESIDENCE)": "property", "THEFT": "property", "AUTO THEFT": "property", "VANDALISM": "property", "SHOPLIFTING": "property",
      "DISTURBANCE (OTHER)": "disturbance", "NOISE COMPLAINT": "disturbance", "FIREWORKS": "disturbance", "FIGHT": "disturbance",
      "TRAFFIC STOP": "traffic", "HIT AND RUN": "traffic", "TRAFFIC INCIDENT": "traffic", "PARKING VIOLATION": "traffic", "DWI": "traffic",
      "SUSPICIOUS PERSON": "suspicious", "PROWLER": "suspicious", "SUSPICIOUS VEHICLE": "suspicious",
      "COMPLAINT OTHER": "other", "MISSING JUVENILE": "welfare", "MENTAL PATIENT": "welfare", "MEDICAL": "welfare", "AREA CHECK": "proactive", "PATROL": "proactive",
      "TOW IMPOUNDED VEHICLE (PRIVATE)": "other", "": "other",
    };
    for (const [t, want] of Object.entries(cases)) expect([t, policeCategory(t)]).toEqual([t, want]);
  });
});

describe("registry", () => {
  it("lists every socrata source once with a unique id", () => {
    const ids = allSources.map((s) => s.sourceId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(expect.arrayContaining([
      "socrata:72f9-bi28", "socrata:rcm3-fn58", "socrata:aib5-en5t", "socrata:u6yx-v2tw", "socrata:uh5a-f7uw", "socrata:3ehi-je3s",
      "socrata:44ct-56tr", "socrata:en36-xvxg", "socrata:ufdg-ajws", "socrata:2ei9-wqw2", "socrata:2jgv-pqrq", "socrata:hjcd-grvu", "socrata:es9j-6y5d",
    ]));
    expect(sourceById("socrata:72f9-bi28")!.table).toBe("permit");
    expect(sourceById("socrata:nope")).toBeUndefined();
  });
  it("every source has a url on data.nola.gov and a license", () => {
    const fileArchives = new Set(["socrata:rw6e-a9x3", "socrata:fdhh-psg3"]);   // published as zip downloads, not SODA
    for (const s of allSources) {
      const id = s.sourceId.replace("socrata:", "");
      expect(s.url).toBe(fileArchives.has(s.sourceId) ? `https://data.nola.gov/download/${id}/application%2Fzip` : `https://data.nola.gov/resource/${id}.json`);
      expect(s.license.length).toBeGreaterThan(0);
    }
  });
});
