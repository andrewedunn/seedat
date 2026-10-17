// ABOUTME: The nightly ingest Workflow: for each city dataset that changed upstream, pull it page by page,
// ABOUTME: snapshot raw pages to R2, apply changes to D1, then refresh summaries and NOPD block-month counts.
import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import { policeSources, recordSources } from "@seedat/core/src/sources";
import { insertSql } from "@seedat/core/src/sql";
import { parcelSummarySql } from "@seedat/core/src/summary-sql";
import { applyPage, applyRemovals, mapRows } from "./apply";
import { jsonChunks } from "./prefetch";
import { PAGE_SIZE, catalogUpdatedAt, fetchPage } from "./socrata";
import { NIGHTLY_WINDOW_DAYS, WINDOWS } from "./windows";

export interface Env { DB: D1Database; RAW: R2Bucket; NIGHTLY: Workflow }
export interface NightlyParams { full?: boolean; only?: string[] }

const datasetId = (sourceId: string) => sourceId.replace("socrata:", "");
const MAX_PAGES = 200;   // 2M rows: a guard against a runaway loop, far above any dataset we pull
const REMOVAL_SWEEP_MAX_ROWS = 60_000;   // full pulls of datasets this small also detect rows removed upstream

async function readSnapshotKeys(bucket: R2Bucket, prefix: string, src: Parameters<typeof mapRows>[0]): Promise<Set<string>> {
  const keys = new Set<string>();
  let cursor: string | undefined;
  do {
    const list = await bucket.list({ prefix, ...(cursor ? { cursor } : {}) });
    for (const obj of list.objects) {
      const body = await bucket.get(obj.key);
      if (!body) continue;
      const raws = await new Response(body.body.pipeThrough(new DecompressionStream("gzip"))).json<Record<string, unknown>[]>();
      for (const k of mapRows(src, raws).keys()) keys.add(k);
    }
    cursor = list.truncated ? list.cursor : undefined;
  } while (cursor);
  return keys;
}

/** Gzipped JSON, buffered: R2 put needs a known length, which a compression stream does not have. */
async function gzipJson(value: unknown): Promise<ArrayBuffer> {
  return new Response(new Blob([JSON.stringify(value)]).stream().pipeThrough(new CompressionStream("gzip"))).arrayBuffer();
}

export class NightlyIngest extends WorkflowEntrypoint<Env, NightlyParams> {
  async run(event: WorkflowEvent<NightlyParams>, step: WorkflowStep) {
    const ts = new Date(event.timestamp).getTime();
    const runAt = new Date(ts).toISOString();
    const runDay = runAt.slice(0, 10);
    // Sundays (and on request) pull everything, which catches status changes on old records.
    const full = event.payload.full ?? new Date(ts).getUTCDay() === 0;
    const since = new Date(ts - NIGHTLY_WINDOW_DAYS * 86_400_000).toISOString().slice(0, 10);

    const changed = await step.do("check catalog", async () => {
      const upstream = await catalogUpdatedAt();
      const known = new Map((await this.env.DB.prepare("SELECT source_id, upstream_updated_at FROM source").all<{ source_id: string; upstream_updated_at: string | null }>())
        .results.map((r) => [r.source_id, r.upstream_updated_at]));
      return recordSources
        .filter((s) => !event.payload.only || event.payload.only.includes(s.sourceId))
        .map((s) => ({ sourceId: s.sourceId, upstream: upstream.get(datasetId(s.sourceId)) ?? null }))
        .filter((s) => full || !s.upstream || s.upstream !== known.get(s.sourceId));
    });

    const touched = new Set<number>();
    for (const { sourceId, upstream } of changed) {
      const src = recordSources.find((s) => s.sourceId === sourceId)!;
      const id = datasetId(sourceId);
      const where = full || !WINDOWS[id] ? null : WINDOWS[id]!(since);
      const snapshotId = await step.do(`${id}: open snapshot`, async () => {
        const r = await this.env.DB.prepare("INSERT INTO snapshot (source_id, fetched_at, r2_key, status) VALUES (?, ?, ?, 'running') RETURNING snapshot_id")
          .bind(sourceId, runAt, `snapshots/${id}/${runDay}/`).first<{ snapshot_id: number }>();
        return r!.snapshot_id;
      });
      let totals = { rows: 0, changed: 0, inserted: 0, updated: 0 };
      for (let pageNo = 0; pageNo < MAX_PAGES; pageNo++) {
        const res = await step.do(`${id}: page ${pageNo}`, { retries: { limit: 3, delay: "30 seconds", backoff: "exponential" }, timeout: "10 minutes" }, async () => {
          const raws = await fetchPage(id, pageNo * PAGE_SIZE, where);
          await this.env.RAW.put(`snapshots/${id}/${runDay}/page_${String(pageNo).padStart(4, "0")}.json.gz`, await gzipJson(raws), {
            httpMetadata: { contentType: "application/json", contentEncoding: "gzip" },
            customMetadata: { where: where ?? "", fetchedAt: runAt },
          });
          const applied = await applyPage(this.env.DB, src, raws, runAt, snapshotId);
          return { ...applied, fetched: raws.length };
        });
        totals = { rows: totals.rows + res.rows, changed: totals.changed + res.changed, inserted: totals.inserted + res.inserted, updated: totals.updated + res.updated };
        for (const g of res.geopins) touched.add(g);
        if (res.fetched < PAGE_SIZE) break;
      }
      if (!where && totals.rows <= REMOVAL_SWEEP_MAX_ROWS) {
        const swept = await step.do(`${id}: removals`, { timeout: "10 minutes" }, async () => {
          const seen = await readSnapshotKeys(this.env.RAW, `snapshots/${id}/${runDay}/`, src);
          return applyRemovals(this.env.DB, src, seen, runAt, snapshotId);
        });
        for (const g of swept.geopins) touched.add(g);
        if (swept.refused) console.warn(`${id}: removal sweep refused: ${swept.refused}`);
      }
      await step.do(`${id}: close snapshot`, async () => {
        await this.env.DB.batch([
          this.env.DB.prepare("UPDATE snapshot SET row_count = ?, inserted = ?, updated = ?, status = 'ok' WHERE snapshot_id = ?")
            .bind(totals.rows, totals.inserted, totals.updated, snapshotId),
          this.env.DB.prepare("UPDATE source SET upstream_updated_at = ?, last_pulled_at = ?, last_success_at = ?, last_row_count = coalesce(?, last_row_count) WHERE source_id = ?")
            .bind(upstream, runAt, runAt, where ? null : totals.rows, sourceId),
        ]);
      });
    }

    // NOPD calls: re-aggregate the current year in full (terms: block-level counts only, never per call).
    await step.do("police: current year", { timeout: "15 minutes" }, async () => {
      const year = new Date(ts).getUTCFullYear();
      const src = policeSources.find((s) => s.year === year);
      if (!src) return { skipped: `no NOPD dataset registered for ${year}` };
      const counts = new Map<string, number>();
      for (let pageNo = 0; pageNo < MAX_PAGES; pageNo++) {
        const raws = await fetchPage(datasetId(src.sourceId), pageNo * PAGE_SIZE, null);
        for (const raw of raws) {
          const m = src.map(raw);
          if (m) counts.set(`${m.block_id}|${m.month}|${m.category}`, (counts.get(`${m.block_id}|${m.month}|${m.category}`) ?? 0) + 1);
        }
        if (raws.length < PAGE_SIZE) break;
      }
      const rows = [...counts].map(([k, n]) => { const [block_id, month, category] = k.split("|"); return { block_id, month, category, n }; });
      const stmts = [`DELETE FROM police_call_month WHERE month LIKE '${year}-%';`, ...insertSql("police_call_month", ["block_id", "month", "category", "n"], rows)];
      for (let i = 0; i < stmts.length; i += 50) await this.env.DB.batch(stmts.slice(i, i + 50).map((s) => this.env.DB.prepare(s)));
      return { rows: rows.length };
    });

    await step.do("parcel summaries", { timeout: "15 minutes" }, async () => {
      const sql = parcelSummarySql(runAt);
      for (const chunk of jsonChunks([...touched])) await this.env.DB.prepare(sql).bind(chunk).run();
      return { parcels: touched.size };
    });

    return { sources: changed.length, parcelsTouched: touched.size, full };
  }
}
