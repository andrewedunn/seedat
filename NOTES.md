<!-- ABOUTME: Running log of decisions, dead ends, data quality problems, and open questions for See Dat. -->
<!-- ABOUTME: Newest entries at the bottom of each section; dates are absolute. -->

# See Dat — working notes

## Decisions

- **2026-10-17** — Independent code review of the ingest path (feature-dev:code-reviewer) found 10 issues. Fixed:
  - A retried step could silently drop target writes. `src_row` is now written last.
  - The crawler could wedge or skip ids. Only a 200 with the blank template counts as empty; 5xx and throttle pages back off; save errors no longer block; rechecks always advance.
  - Spurious diffs from columns that other writers own. `fieldChanges` now compares only the new row's columns.
  - Duplicate keys flapped between pages. A deterministic greater-hash rule now applies everywhere.
  - A shared situs or a block address could return a guessed parcel. These are now ambiguous or `block_level`.
  - FTS went stale nightly. Fixed with triggers (migration 0007, applied after the backfill load).
  - Statement size counted characters instead of bytes.
  - Nothing detected removals. Fixed with a removal sweep on weekly full pulls of datasets under 60k rows; it refuses when more than 20% would vanish.
  - A failed dictionary load stayed cached.
  
  Documented, not changed: backfill re-runs wipe crawler data.

- **2026-10-17** — Project slug `seedat`, per `~/dev/stack.md` naming table. Repo is **`andrewedunn/seedat`** (Andrew's actual GitHub account; the stack doc's `andrewdunn/` is a typo for this). Created private; flip to public at launch.
- **2026-10-17** — Cloudflare account is on Workers Paid (Andrew confirmed), so cron/Workflows CPU limits and D1's 10 GB cap apply. Benchmark Worker and `seedat-bench-db` deleted after the test.
- **2026-10-17** — Crawler identity for all source pulls: `User-Agent: seedat-research/0.1 (+https://seedat.dunn.us; seedat@dunn.us)`. Uses the project address rather than a personal one. **Open:** `seedat@dunn.us` needs Cloudflare Email Routing set up so the contact actually reaches someone.
- **2026-10-17** — Permits spine = BLDS `72f9-bi28`, unioned with `rcm3-fn58` and `aib5-en5t` on permit number. Validator showed rcm3 holds only about half of recent permits (no PLMB/HDLC).
- **2026-10-17** — Canonical address table = maps.nola.gov `Site_Address_Point_LAMA` (275k points, 98.2% carry GEOPIN). Canonical parcel key = GEOPIN. Assessor tax-bill number (`pin` on permits) is a secondary key we learn by matching. No public crosswalk exists.
- **2026-10-17** — Incremental loads = daily full pull + per-row hash diff, because city datasets are replaced wholesale each night (`:updated_at` is useless except for 311).
- **2026-10-17** — **Database: stay on D1. No Railway Postgres.** Benchmark (`bench/`): 151k parcels, 275k addresses, 466k permits, 183k code cases, 39k STR and 2.1M block-activity rows (340 MB) in D1. Address page = 5 indexed queries in one `batch()`. Measured from Andrew's machine over 200 random parcels:
  - **Worker time (incl. D1):** p50 25 ms, p95 38 ms, p99 57 ms.
  - **Address lookup + page:** p50 50 ms, p95 64 ms.
  - **End-to-end on a fresh TLS connection:** p50 125 ms, p95 158 ms, of which 88 ms is network + TLS baseline (a static response).
  - **Heaviest parcels** (100 permits): D1 30 ms.
  
  PostGIS would only help at ingest (spatial joins). Those run as a batch step that precomputes zoning, historic district and so on onto each parcel row, so the serving path never needs spatial SQL. Cache API on top will make repeat views faster still.
- **2026-10-17** — Publish our learned tax-bill ↔ GEOPIN crosswalk as an open dataset (CSV + API, with evidence counts). Andrew's idea; nobody publishes one.
- **2026-10-17** — **One Stop detail crawl is scoped to about the last four months** (IDs 1,122,450 down to 1,112,400), newest first. This is Andrew's call: load everything else first, then decide how far back to go or whether to ask the city. Measured limit: bursts of about 11 requests trigger a 429. One request per minute has held with no throttling, so about 1,440 pages a day. The full 1.12M-ID history would take about 2 years at that rate.
- **2026-10-17** — Nightly ingest is a Cloudflare Workflow (`seedat-nightly`), run by cron at 09:00 UTC:
  - **Sources pulled:** only datasets whose catalog `data_updated_at` changed.
  - **Window:** rows touched in the last 60 days by each dataset's own date columns (`workers/ingest/src/windows.ts`). Sundays pull everything, to catch status changes on old records.
  - **Raw pages** are snapshotted to R2 under `snapshots/<id>/<day>/`.
  - **Change detection:** per-source row hashes in `src_row`. Only changed keys are re-merged and re-matched, so D1 writes stay proportional to real changes.
  - **Matching in the Worker:** each batch prefetches only the D1 rows it could match into a small in-memory index, so the same matcher code runs in the backfill and in the Worker.
- **2026-10-17** — `src_row` holds a hash for every source row. It holds the mapped row JSON only for tables with several sources (permits ×3, STR ×3), which keeps it small.
- **2026-10-17** — D1 limits hit and handled: 100 KB per statement (byte-capped batches), 100 bound parameters (literal-SQL upserts and JSON-array parameters through `json_each`), and enforced foreign keys (load parcels before their children).
- **2026-10-17** — Phase 0 runs before any build code, per the brief. Research outputs live in `research/`, final deliverables (`PRIOR_ART.md`, `SOURCES.md`) at repo root.

## Subagent task log (model tier → task)

| Date | Task | Tier | Notes |
|---|---|---|---|
| 2026-10-17 | Prior art: New Orleans tools | sonnet (mid) | web research, write `research/prior-art/nola.md` |
| 2026-10-17 | Prior art: other cities + address matching (Philly AIS etc.) | sonnet (mid) | `research/prior-art/other-cities.md` |
| 2026-10-17 | Prior art: national/commercial + MCP servers | sonnet (mid) | `research/prior-art/national.md` |
| 2026-10-17 | Source: One Stop reports, search, detail pages, hidden endpoints | sonnet (mid) | needs judgment about scraping politeness, so not haiku |
| 2026-10-17 | Source: data.nola.gov full catalog + relevant datasets | sonnet (mid) | scripted catalog pull |
| 2026-10-17 | Source: maps.nola.gov ArcGIS service crawl | sonnet (mid) | scripted crawl |
| 2026-10-17 | Source: assessor, GEOPIN, canonical address options, normalizers | sonnet (mid) | |
| 2026-10-17 | Prior art national, second pass | sonnet (mid), same agent resumed | First pass was ~8 searches and too thin; sent back with a specific list. Lesson: give research briefs a minimum search budget. |
| 2026-10-17 | Independent validation of 9 key claims | sonnet (mid), fresh agent | Refuted 1 major claim (Parcels To Join is not a tax-bill crosswalk), corrected 9 others. Worth the cost. |
| 2026-10-17 | Pull real data and build benchmark SQLite | sonnet (mid) | Mechanical but multi-source; haiku likely fine next time. Wrongly concluded code cases lack geopin (Socrata omits nulls). |
| 2026-10-17 | Source adapters for 13 datasets + helpers + 68 tests | sonnet (mid) | Good quality. I replaced its BigInt FNV hash (too slow) with cyrb53. Useful schema notes (STR key, duplicate permit numbers). |
| 2026-10-17 | Parcel spatial attributes (PIP, representative points) | sonnet (mid) | Excellent: 7 s runtime, 0 representative points outside their polygon, sensible spot checks. |
| 2026-10-17 | One Stop detail-page parser | sonnet (mid) | Running. |
| 2026-10-17 | Normalizer, match ladder, alias/crosswalk learning, diff, loader, Worker | me (orchestrator) | Kept in the top tier: matching quality and nightly correctness are expensive to get wrong. |

Tier rationale for this first fan-out: the research tasks need judgment about what is relevant and when to stop, which haiku tends to under-do. Mechanical follow-ups (field inventories, spot checks) will go to haiku.

## Dead ends

- **2026-10-17** — One Stop's "Download permit CSV" link on every detail page is a **honeypot** (`class="hp-link"`, `aria-hidden`, `rel="nofollow"`, `?__hpClick=1`, plus a hidden `website` input). The crawler must never follow `hp-link` anchors or fill hidden inputs.
- **2026-10-17** — One Stop rate-limits: after about 11 detail requests spaced roughly 4–6 s apart (3 s sleep plus slow responses), it returned HTTP 429 "Too many requests in a short time. Please slow down and try again in a minute." Response times climbed from 1.0 to 3.8 s just before. The crawl pace must be set from a measured safe rate, not the 1 request / 2 s assumed in onestop.md.

- **2026-10-17** — nolaassessor.com sits behind a Cloudflare bot challenge (even robots.txt). Not bypassing it (guardrail: no CAPTCHA/bot-detection bypass). Canonical parcels come from the city's own published layers instead. Possible follow-up: ask the Assessor's Office for a bulk extract — a human email, Andrew's call.
- **2026-10-17** — BlightStatus (Code for America): repo 404, site TLS error. Borrow the concept, not the code.
- **2026-10-17** — OpenAddresses Orleans sources just re-ingest the city's Site Address Points; no added coverage.

## Data quality problems

- **2026-10-17** — **Match ladder measured on 20k random records per source** (`scripts/measure-match.ts`):
  - **Permits (BLDS, coordinates from rcm3/aib5): 98.3%.** 84.5% exact address; 3.4% range members; 0.9% via our learned tax-bill crosswalk; 0.6% nearest point.
  - **STR applications: 98.4%.**
  - **Code cases: 96.3%.** 92.4% carry their own GEOPIN. Two-thirds of the cases with no GEOPIN come from a single 2009 legacy import, and some have glued house numbers ("3385701 Paris Ave").
  - Report match rates by era in the validation report.
- **2026-10-17** — Street renames are learned from coordinates, with no hand-made list. For records whose street is unknown, the nearest address point's street votes on what the name means:
  - Caffin Ave → Fats Domino Ave (421 votes)
  - S Jefferson Davis Pkwy → S Norman C Francis Pkwy (76)
  - Cadillac St → Roneagle Way (69)
  - Gov Nicholls → Governor Nicholls (137)
  - M L King → Martin Luther King
- **2026-10-17** — The learned tax-bill → GEOPIN crosswalk covers **76,544 tax bills**. 1,533 more were seen with conflicting parcels and dropped (condos, splits). This is the dataset to publish.
- **2026-10-17** — City address points use accents (Villeré, Dupré, Sài Gòn, De Boré); city permits never do.

- **2026-10-17** — Good news: `aib5-en5t` already publishes permit milestones for 2018+ construction permits: application_submitted, application_review, zoning_review, plan_review, permit_approved, issue_date, date_of_first_inspection, plus `days_to_*`. Much of the permit timeline needs no crawling. Detail pages are still the only source for inspection *results*, review comments and fee lines.

- **2026-10-17** — Two parcel keyspaces: permits use the assessor tax-bill number, everything else uses GEOPIN, and the city publishes no crosswalk. `pzqp-4ri7.parid` looks like a crosswalk but is an address slug (`3655-FLORENCEAV`); 0/500 permit pins matched.
- **2026-10-17** — rcm3 vs BLDS vs aib5 permit sets differ substantially (Sep 2026 filings: 1,152 / 2,484 / 2,117).
- **2026-10-17** — BLDS `location` column is empty for every row.
- **2026-10-17** — Junk dates in code enforcement and adjudication: years 1905, 2915, 5015, 7201, and placeholder 1753/1900.
- **2026-10-17** — Address point `LAT`/`LONG` fields are state-plane feet, not degrees.
- **2026-10-17** — `pin` null on about 10% of permits since 2024; GEOPIN null on about 5–7% of code cases (new cases before geocoding).
- **2026-10-17** — HDLC solar review area ArcGIS service is broken (no layers). Rebuild it from its published definition.
- **2026-10-17** — Socrata JSON **omits null fields per row**. Never infer a dataset's schema from row 1; read `/api/views/{id}.json` columns. (A subagent concluded code cases had no geopin this way.)
- **2026-10-17** — Naive permit-address match against LAMA: 0.5%; with suffix and unit normalization: about 93%. The remaining 7% is multi-address strings, notes in the address field, and renamed streets.

## Open questions

- **Expected one-time noise 2026-10-18:** the initial backfill kept the *last* row for duplicate keys (245 BLDS permit numbers). The Worker and the regenerated backfill now keep the row with the *greater hash*. The first full nightly run may rewrite those ~245 permits once and log matching `change_log` rows. Not a data error; filter by date if analyzing change history.

- Cost: Railway Postgres is a recurring cost. Decide only after the D1 latency test (see brief).
- Ask the city (onestopapp@nola.gov / data@nola.gov) for a bulk feed of One Stop detail data before a ~26-day polite crawl? Contacting them is Andrew's call.
- Ask the Assessor's Office for a bulk roll/sales extract? Same.
- NOPD calls at intersections ("Terpsichore St & Baronne St") are about 35% of calls and are currently skipped. Counting them on the block of the first-named street would stay block-level (within the terms). Decide before the address page ships.
- One Stop crawl runs from Cloudflare's network since 2026-10-17 ~19:05 UTC. Watch for 429s or a block; the local crawler is the fallback.
- One Stop record types beyond permits (HDLC COA, VCC, special events, film, dumpster, curb cut) live in `onestop_record`. Decide which ones the address page shows.
- D1 size: free tier caps a database at 500 MB, paid at 10 GB. NOPD calls for service 2011–2026 is about 6M rows. Store them as block-month aggregates in D1 and keep raw rows in R2 only.
- Domain: `seedat.dunn.us` DNS on Cloudflare — confirm `dunn.us` zone is on this Cloudflare account before deploying.
