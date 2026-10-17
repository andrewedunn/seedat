// ABOUTME: Summarizes One Stop crawler progress from data/crawl/log.jsonl: pages, throttles, sustained rate and ETA.
// ABOUTME: Usage: npx tsx scripts/crawl-status.ts [windowMinutes]
import { readFileSync } from "node:fs";
import { join } from "node:path";

const LOG = join(import.meta.dirname, "..", "data", "crawl", "log.jsonl");
const STATE = join(import.meta.dirname, "..", "data", "crawl", "state.json");
const windowMin = Number(process.argv[2] ?? 60);

const rows = readFileSync(LOG, "utf8").trim().split("\n").map((l) => JSON.parse(l));
const state = JSON.parse(readFileSync(STATE, "utf8"));
const pages = rows.filter((r) => r.event === "page");
const throttles = rows.filter((r) => r.event === "429");
const now = Date.now();
const recent = pages.filter((r) => now - Date.parse(r.t) <= windowMin * 60_000);
const first = pages[0] ? Date.parse(pages[0].t) : now;
const spanMin = Math.max(1, (now - Math.max(first, now - windowMin * 60_000)) / 60_000);
const perHour = (recent.length / spanMin) * 60;
const remaining = state.nextId - state.stopId + 1;
const etaDays = perHour > 0 ? remaining / perHour / 24 : Infinity;
const ms = recent.map((r) => r.ms).sort((a, b) => a - b);

console.log(JSON.stringify({
  pagesTotal: pages.length, saved: state.ok, empty: state.empty, errors: state.errors, throttled429: throttles.length,
  lastId: state.nextId + 1, currentGapS: Number(state.gapS.toFixed(1)),
  windowMin, pagesInWindow: recent.length, ratePerHour: Math.round(perHour),
  medianResponseMs: ms[Math.floor(ms.length / 2)] ?? null,
  remainingIds: remaining, etaDaysAtThisRate: Number.isFinite(etaDays) ? Number(etaDays.toFixed(1)) : null,
}));
