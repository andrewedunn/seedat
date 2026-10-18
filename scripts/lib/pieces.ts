// ABOUTME: Reads one source's downloaded rows and keeps one mapped version per key (the same preferRow rule the
// ABOUTME: nightly Worker uses). Shared by the backfill and the rematch script so both see identical inputs.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { MatchInput } from "../../packages/core/src/match";
import { preferRow, rowHash, type AnySource } from "../../packages/core/src/sources";
import { RAW } from "./raw";

export interface Best { row: Record<string, unknown>; match: MatchInput | undefined; h: string; raw: Record<string, unknown> }

export function* rawRows(sourceId: string): Generator<Record<string, unknown>> {
  const dir = join(RAW, "src", sourceId.replace("socrata:", ""));
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".json")).sort()) {
    for (const r of JSON.parse(readFileSync(join(dir, f), "utf8"))) yield r;
  }
}

export function collectSource(src: AnySource): { best: Map<string, Best>; mapped: number; dropped: number } {
  const best = new Map<string, Best>();
  let mapped = 0, dropped = 0;
  for (const raw of rawRows(src.sourceId)) {
    const row = src.map(raw) as Record<string, unknown> | null;
    if (!row) { dropped++; continue; }
    mapped++;
    const key = src.key(row as never);
    const match = src.matchInput?.(raw);
    const h = rowHash({ ...row, __match: match ?? null });
    const seen = best.get(key);
    if (!seen || preferRow({ row, hash: h }, { row: seen.row, hash: seen.h })) best.set(key, { row, match, h, raw });
  }
  return { best, mapped, dropped };
}
