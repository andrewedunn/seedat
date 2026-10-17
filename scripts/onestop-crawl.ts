// ABOUTME: Polite, self-pacing crawler for One Stop permit detail pages, newest id first. Saves raw HTML gzipped
// ABOUTME: to data/raw/onestop/, logs every request to data/crawl/log.jsonl, and backs off hard on HTTP 429.
//
// Usage: npx tsx scripts/onestop-crawl.ts [startId] [stopId]
// Pacing: starts at one request per 30 s, shortens the gap 10% after every 10 straight successes (never below
// MIN_GAP_S), and on a 429 sleeps COOLDOWN_S then doubles the gap. Only ever GETs SummaryContent.aspx; it never
// follows links on the page (the "Download permit CSV" link is a bot honeypot).
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

const ROOT = join(import.meta.dirname, "..", "data");
const RAW = join(ROOT, "raw", "onestop");
const CRAWL = join(ROOT, "crawl");
const STATE = join(CRAWL, "state.json");
const LOG = join(CRAWL, "log.jsonl");
const UA = "seedat-research/0.1 (+https://seedat.dunn.us; seedat@dunn.us)";
const MIN_GAP_S = 5;
const MAX_GAP_S = 600;
const COOLDOWN_S = 600;

mkdirSync(RAW, { recursive: true });
mkdirSync(CRAWL, { recursive: true });

interface State { nextId: number; stopId: number; gapS: number; streak: number; ok: number; empty: number; throttled: number; errors: number }

const state: State = existsSync(STATE)
  ? JSON.parse(readFileSync(STATE, "utf8"))
  : { nextId: Number(process.argv[2] ?? 1122400), stopId: Number(process.argv[3] ?? 1), gapS: 30, streak: 0, ok: 0, empty: 0, throttled: 0, errors: 0 };

const sleep = (s: number) => new Promise((r) => setTimeout(r, s * 1000));
const save = () => writeFileSync(STATE, JSON.stringify(state, null, 2));
const log = (entry: object) => appendFileSync(LOG, JSON.stringify({ t: new Date().toISOString(), ...entry }) + "\n");

let stopping = false;
process.on("SIGINT", () => { stopping = true; });
process.on("SIGTERM", () => { stopping = true; });

async function fetchOne(id: number) {
  const url = `https://onestopapp.nola.gov/SummaryContent.aspx?type=Permit&id=${id}`;
  const t0 = Date.now();
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "text/html" }, redirect: "manual", signal: AbortSignal.timeout(30_000) });
  const body = await res.text();
  return { status: res.status, body, ms: Date.now() - t0 };
}

log({ event: "start", ...state });
while (!stopping && state.nextId >= state.stopId) {
  const id = state.nextId;
  try {
    const { status, body, ms } = await fetchOne(id);
    if (status === 429) {
      state.throttled++;
      state.streak = 0;
      state.gapS = Math.min(MAX_GAP_S, state.gapS * 2);
      log({ event: "429", id, ms, nextGapS: state.gapS, cooldownS: COOLDOWN_S });
      save();
      await sleep(COOLDOWN_S);
      continue; // retry the same id
    }
    // An unused id returns the same template with every field blank, including Type.
    const isEmpty = status === 200 && /Type:<\/td>\s*<td class='summary-table'>\s*<\/td>/.test(body);
    if (status === 200 && !isEmpty) {
      writeFileSync(join(RAW, `${id}.html.gz`), gzipSync(body));
      state.ok++;
    } else if (status === 200) {
      state.empty++;
    } else {
      state.errors++;
    }
    state.streak++;
    if (state.streak >= 10) { state.gapS = Math.max(MIN_GAP_S, state.gapS * 0.9); state.streak = 0; }
    log({ event: "page", id, status, ms, bytes: body.length, empty: isEmpty, gapS: Number(state.gapS.toFixed(1)) });
    state.nextId = id - 1;
  } catch (err) {
    state.errors++;
    log({ event: "error", id, message: String(err) });
    state.gapS = Math.min(MAX_GAP_S, state.gapS * 1.5);
  }
  save();
  await sleep(state.gapS);
}
log({ event: "stop", ...state });
save();
