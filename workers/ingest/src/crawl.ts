// ABOUTME: One Stop detail crawler, one page per cron minute: new ids above the frontier first, then the backfill
// ABOUTME: going down, then re-checks of open records. Backs off 10 minutes on any 429. Raw page to R2, parsed record to D1.
import { blockIdForText } from "@seedat/core/src/block";
import { matchRecord } from "@seedat/core/src/match";
import { detailToEvents, parseOneStopDetail } from "@seedat/core/src/onestop";
import { insertSql, sqlValue } from "@seedat/core/src/sql";
import { prefetchIndex } from "./prefetch";
import type { Env } from "./workflow";

const UA = "seedat-ingest/0.1 (+https://seedat.dunn.us; seedat@dunn.us)";
const FORWARD_EMPTY_LIMIT = 20;      // ids can be sparse; stop probing upward after this many empties in a row
const COOLDOWN_MS = 10 * 60_000;
const RECHECK_AFTER_DAYS = 7;

interface CrawlState {
  frontier_id: number; empty_streak: number; backfill_next: number; backfill_stop: number;
  resume_after: string | null; pages_ok: number; pages_empty: number; throttled: number;
}

type Pick = { id: number; mode: "forward" | "backfill" | "recheck" };

async function pickNext(db: D1Database, st: CrawlState, minute: number): Promise<Pick | null> {
  // New records appear above the frontier all day; re-arm the upward probe at the top of every hour.
  const streak = minute === 0 ? 0 : st.empty_streak;
  if (streak < FORWARD_EMPTY_LIMIT) return { id: st.frontier_id + 1 + streak, mode: "forward" };
  if (st.backfill_next >= st.backfill_stop) return { id: st.backfill_next, mode: "backfill" };
  const stale = await db.prepare(
    `SELECT onestop_id FROM onestop_record WHERE fetched_at < datetime('now', '-${RECHECK_AFTER_DAYS} days')
     AND coalesce(current_status, '') NOT IN ('Permit Closed', 'Closed', 'Complete', 'Completed', 'Expired', 'Withdrawn', 'Void')
     ORDER BY fetched_at LIMIT 1`).first<{ onestop_id: number }>();
  return stale ? { id: stale.onestop_id, mode: "recheck" } : null;
}

async function saveRecord(env: Env, id: number, html: string, now: string) {
  const d = parseOneStopDetail(html, id);
  const linked = d.permitNum ? null : d.referenceCode
    ? await env.DB.prepare("SELECT permit_num FROM permit WHERE onestop_ref = ? LIMIT 1").bind(d.referenceCode).first<{ permit_num: string }>()
    : null;
  const permitNum = d.permitNum ?? linked?.permit_num ?? null;
  const index = await prefetchIndex(env.DB, [{ address: d.location }]);
  const m = matchRecord({ address: d.location }, index);
  const done = d.statuses.filter((s) => s.complete);
  const record = {
    onestop_id: id, reference_code: d.referenceCode, permit_num: permitNum, record_type: d.type,
    geopin: m.geopin, address_id: m.addressId, match_type: m.matchType, match_score: m.score,
    address_raw: d.location, block_id: blockIdForText(d.location), description: d.description,
    submitted_date: d.statuses[0]?.date ?? null, current_status: done[done.length - 1]?.name ?? null,
    detail_json: JSON.stringify({ ...d, reviews: d.reviews.map(({ reviewer: _r, ...rest }) => rest) }),
    fetched_at: now, first_seen_at: now, last_seen_at: now,
  };
  const stmts = insertSql("onestop_record", Object.keys(record), [record], { upsertKey: ["onestop_id"] })
    .map((s) => s.replace(", first_seen_at = excluded.first_seen_at", ""));
  if (permitNum) {
    d.permitNum = permitNum;
    const events = detailToEvents(d);
    stmts.push(`DELETE FROM permit_event WHERE permit_num = ${sqlValue(permitNum)} AND source_id = 'onestop:detail';`);
    stmts.push(...insertSql("permit_event", ["permit_num", "seq", "kind", "name", "status", "event_date", "actor", "detail", "source_id"], events as unknown as Record<string, unknown>[]));
    stmts.push(`UPDATE permit SET onestop_id = ${id}, detail_fetched_at = ${sqlValue(now)} WHERE permit_num = ${sqlValue(permitNum)};`);
  }
  await env.DB.batch(stmts.map((s) => env.DB.prepare(s)));
}

export async function crawlTick(env: Env, scheduled: Date): Promise<string> {
  const st = await env.DB.prepare("SELECT * FROM crawl_state WHERE id = 1").first<CrawlState>();
  if (!st) return "no crawl_state row";
  const now = scheduled.toISOString();
  if (st.resume_after && now < st.resume_after) return `cooling down until ${st.resume_after}`;
  const pick = await pickNext(env.DB, st, scheduled.getUTCMinutes());
  if (!pick) return "nothing to do";

  const res = await fetch(`https://onestopapp.nola.gov/SummaryContent.aspx?type=Permit&id=${pick.id}`, {
    headers: { "User-Agent": UA, Accept: "text/html" }, redirect: "manual",
  });
  const update = (sql: string, ...binds: unknown[]) => env.DB.prepare(`UPDATE crawl_state SET ${sql}, updated_at = ? WHERE id = 1`).bind(...binds, now).run();

  if (res.status === 429) {
    await update("resume_after = ?, throttled = throttled + 1", new Date(scheduled.getTime() + COOLDOWN_MS).toISOString());
    return `429 on ${pick.id}; cooling down`;
  }
  const html = await res.text();
  const empty = res.status !== 200 || parseOneStopDetail(html, pick.id).isEmpty;
  if (!empty) {
    await env.RAW.put(`onestop/${pick.id}/${now.slice(0, 10)}.html`, html, { httpMetadata: { contentType: "text/html" } });
    await saveRecord(env, pick.id, html, now);
  }

  if (pick.mode === "forward") {
    if (empty) await update("empty_streak = ?, pages_empty = pages_empty + 1", (scheduled.getUTCMinutes() === 0 ? 0 : st.empty_streak) + 1);
    else await update("frontier_id = ?, empty_streak = 0, pages_ok = pages_ok + 1", pick.id);
  } else if (pick.mode === "backfill") {
    await update(`backfill_next = ?, ${empty ? "pages_empty = pages_empty + 1" : "pages_ok = pages_ok + 1"}`, pick.id - 1);
  } else {
    await update("pages_ok = pages_ok + 1");
  }
  return `${pick.mode} ${pick.id}: ${empty ? "empty" : "saved"}`;
}
