// ABOUTME: Re-checks address resolution, record recall and precision for the spot-check fixture against the live See Dat MCP server.
// ABOUTME: Usage: npx tsx scripts/spot-check.ts [fixture.json] [--mcp URL]; exits 1 if resolution or recall is below 90%.
import { readFileSync } from "node:fs";

const MIN_RESOLUTION = 0.9;
const MIN_RECALL = 0.9;
const UA = "seedat-validation/0.1 (+https://seedat.dunn.us; seedat@dunn.us)";

interface Entry {
  address: string;
  neighborhood: string | null;
  source: string;
  truth_geopins: number[];
  expected: { permits: string[]; code_cases: string[]; str: string[] };
  accepted_extras: string[];
  doubtful_extras: string[];
  known_misses: Record<string, string>;
}

const args = process.argv.slice(2);
const mcpIdx = args.indexOf("--mcp");
const mcpUrl = mcpIdx >= 0 ? args.splice(mcpIdx, 2)[1] : "https://seedat-api.andrewdunn.workers.dev/mcp";
const fixturePath = args[0] ?? "research/validation/spot-check-fixture.json";
const fixture: { addresses: Entry[] } = JSON.parse(readFileSync(fixturePath, "utf8"));

async function tool(name: string, argsObj: Record<string, unknown>): Promise<any> {
  const res = await fetch(mcpUrl, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json", "user-agent": UA },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: argsObj } }),
  });
  if (!res.ok) throw new Error(`MCP ${name} HTTP ${res.status}`);
  const body: any = await res.json();
  const r = body.result;
  if (!r) throw new Error(`MCP ${name}: ${JSON.stringify(body.error ?? body).slice(0, 200)}`);
  if (r.structuredContent) return r.structuredContent;
  try {
    return JSON.parse(r.content[0].text);
  } catch {
    return { _error: String(r.content?.[0]?.text ?? "").slice(0, 200) };
  }
}

const pct = (n: number, d: number) => (d === 0 ? "n/a" : `${((100 * n) / d).toFixed(1)}%`);

const kinds = ["permits", "code_cases", "str"] as const;
const tally = {
  addresses: 0,
  resolved: 0,
  verifiable: 0,
  expected: 0,
  found: 0,
  byKind: { permits: [0, 0], code_cases: [0, 0], str: [0, 0] } as Record<string, number[]>,
  seedat: 0,
  seedatLegit: 0,
  seedatDoubtful: 0,
  seedatUnreviewed: 0,
};
const missLines: string[] = [];
const resolutionFailures: string[] = [];
const unreviewed: string[] = [];

for (const e of fixture.addresses) {
  tally.addresses++;
  let geopin: number | null = null;
  try {
    const l = await tool("lookup_address", { address: e.address });
    geopin = typeof l.geopin === "number" ? l.geopin : null;
  } catch (err) {
    console.error(`lookup_address failed for "${e.address}": ${(err as Error).message}`);
  }
  if (e.truth_geopins.length > 0) {
    tally.verifiable++;
    if (geopin !== null && e.truth_geopins.includes(geopin)) tally.resolved++;
    else resolutionFailures.push(`${e.address} -> ${geopin} (city says ${e.truth_geopins.join("/")})`);
  } else if (geopin !== null) {
    tally.resolved++;
    tally.verifiable++;
  } else {
    tally.verifiable++;
    resolutionFailures.push(`${e.address} -> unresolved`);
  }

  const have: Record<(typeof kinds)[number], Set<string>> = { permits: new Set(), code_cases: new Set(), str: new Set() };
  if (geopin !== null) {
    try {
      const r = await tool("get_property_records", { geopin, include_timeline: false, limit: 200 });
      for (const p of r.permits ?? []) have.permits.add(String(p.permit_num).toUpperCase());
      for (const c of r.code_cases ?? []) have.code_cases.add(String(c.case_no));
      for (const s of r.str_licenses ?? []) have.str.add(String(s.str_id));
    } catch (err) {
      console.error(`get_property_records failed for ${geopin}: ${(err as Error).message}`);
    }
  }

  const expectedAll = new Set<string>();
  for (const k of kinds) {
    for (const id of e.expected[k]) {
      expectedAll.add(id);
      tally.expected++;
      tally.byKind[k][0]++;
      if (have[k].has(id)) {
        tally.found++;
        tally.byKind[k][1]++;
      } else {
        const why = e.known_misses[id] ? ` [${e.known_misses[id]}]` : "";
        missLines.push(`  ${e.address}: ${k} ${id}${why}`);
      }
    }
  }
  const accepted = new Set(e.accepted_extras);
  const doubtful = new Set(e.doubtful_extras);
  for (const k of kinds) {
    for (const id of have[k]) {
      tally.seedat++;
      if (expectedAll.has(id) || accepted.has(id)) tally.seedatLegit++;
      else if (doubtful.has(id)) tally.seedatDoubtful++;
      else {
        tally.seedatUnreviewed++;
        unreviewed.push(`  ${e.address}: ${k} ${id}`);
      }
    }
  }
  await new Promise((r) => setTimeout(r, 150));
}

console.log(`See Dat spot check against ${mcpUrl}`);
console.log(`Fixture: ${fixturePath} (${tally.addresses} addresses)\n`);
console.log(`Address resolution: ${tally.resolved}/${tally.verifiable} = ${pct(tally.resolved, tally.verifiable)}`);
for (const f of resolutionFailures) console.log(`  FAIL ${f}`);
console.log(`Record recall:      ${tally.found}/${tally.expected} = ${pct(tally.found, tally.expected)}`);
for (const k of kinds) console.log(`  ${k.padEnd(11)} ${tally.byKind[k][1]}/${tally.byKind[k][0]} = ${pct(tally.byKind[k][1], tally.byKind[k][0])}`);
console.log(
  `Record precision:   ${tally.seedatLegit}/${tally.seedat} = ${pct(tally.seedatLegit, tally.seedat)} ` +
    `(${tally.seedatDoubtful} doubtful, ${tally.seedatUnreviewed} not yet reviewed)`,
);
if (missLines.length) {
  console.log("\nMisses:");
  for (const m of missLines) console.log(m);
}
if (unreviewed.length) {
  console.log("\nRecords returned that are neither expected nor adjudicated (review and add to the fixture):");
  for (const u of unreviewed.slice(0, 40)) console.log(u);
  if (unreviewed.length > 40) console.log(`  ... ${unreviewed.length - 40} more`);
}

const resolutionRate = tally.verifiable ? tally.resolved / tally.verifiable : 0;
const recallRate = tally.expected ? tally.found / tally.expected : 1;
const failed: string[] = [];
if (resolutionRate < MIN_RESOLUTION) failed.push(`resolution ${pct(tally.resolved, tally.verifiable)} < ${MIN_RESOLUTION * 100}%`);
if (recallRate < MIN_RECALL) failed.push(`recall ${pct(tally.found, tally.expected)} < ${MIN_RECALL * 100}%`);
if (failed.length) {
  console.log(`\nFAILED: ${failed.join("; ")}`);
  process.exit(1);
}
console.log("\nPASSED");
