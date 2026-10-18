<!-- ABOUTME: Validation report for See Dat v1: coverage, freshness, address match rates, the 50-address spot check, gaps. -->
<!-- ABOUTME: Measured 2026-10-17/18 against the live seedat-db; re-run checks with scripts/spot-check.ts and scripts/rematch.ts. -->

# Validation report

Measured October 17–18, 2026, against the live database and the deployed site and MCP server. Where a number comes from an independent check (an agent that didn't build the code), that's noted.

## Targets

| Target | Result | Status |
|---|---|---|
| Coverage: every permit, code case and STR licence the city publishes, as far back as the source goes | All live city datasets loaded in full. Several frozen historical archives are not loaded yet (see gaps) | **Mostly met** |
| Freshness: under 24 h behind sources that update daily | Data through 2026-10-16 loaded on 10-17. Nightly Workflow at 09:00 UTC. One Stop records crawled within minutes of filing | **Met** |
| Address matching ≥ 98% | Property permits **98.2%**, STR **99.1%**, code cases **96.5%** | **Met for permits and STR; code cases short (legacy data)** |
| Address page under 200 ms at the edge | Server render p50 **20 ms**, p95 **25 ms** (D1 + HTML, uncached). End to end from a New Orleans laptop: p50 164 ms uncached, 124 ms cached | **Met** |

## Coverage

| Table | Rows | Earliest | Latest | Source |
|---|---|---|---|---|
| Permits | 493,625 | 2002-02-03 | 2026-10-16 | BLDS + Permits + OBES applications, merged by permit number |
| Permit timeline events | 1,000,665+ | | | OBES milestones + One Stop detail pages |
| Code enforcement cases | 183,007 | 2008-07-28 | 2026-10-16 | Code Enforcement All Cases |
| Code events (inspections, violations, hearings) | 622,269 | | | Three datasets |
| STR applications and licenses | 40,820 | 2017-03-13 | 2026-10-16 | Applications + active + non-commercial |
| 311 requests (block level) | 1,039,503 | 2019-01-01 | 2026-10-16 | 311 OPCD calls |
| NOPD calls (block × month × category) | 4,220,191 calls | 2011-01 | 2026-10 | 16 yearly datasets |
| Business licenses | 38,067 | | | Occupational licenses |
| One Stop records (crawled) | 302 and growing ~1,000/day | 2026-10-14 | 2026-10-17 | Public detail pages |
| Parcels / address points | 151,255 / 275,110 | | | City GIS |

Every raw pull is snapshotted to R2 (`seedat-raw/snapshots/<dataset>/<day>/`), so any load can be replayed.

## Freshness

- **Nightly Workflow** (`seedat-nightly`, 09:00 UTC):
  - Pulls only datasets whose catalog timestamp changed.
  - Window: rows touched in the last 60 days. Sundays pull everything.
- **Verified runs before the first scheduled one:**
  - Full pull of 466k BLDS permits in 7 minutes.
  - 200 permits forced back through the cloud matcher came out identical to the original load.
- **City-side lag:** the city publishes most datasets nightly, so the floor is about 12 h. BLDS itself lagged two days at the time of measurement; the merged permit table compensates with the other two permit datasets.
- **One Stop crawler:**
  - Runs on a one-minute cron and catches new records (HDLC reviews, permits) within minutes of filing.
  - Measured throughput: 302 pages in about 7 hours, with 10 throttle cooldowns. That's about 1,000 pages a day.
  - The four-month backfill (to ID 1,112,400) completes in about 10 days.

## Address matching

Measured over every record, not a sample (`scripts/rematch.ts`):

| Records | Placed on a parcel | How |
|---|---|---|
| Property permits (471,564, event permits excluded) | **98.22%** | 85% exact address; the rest through ranges, units, learned street aliases, the learned tax-bill crosswalk, the parcel's own situs, and coordinates |
| STR applications and licenses (40,820) | **99.08%** | |
| Code enforcement cases (183,007) | **96.45%** | 92.6% carry the city's own GEOPIN. Most misses are a 2009 data migration with malformed numbers ("3385701 Paris Ave") |
| Business licenses (38,067) | 78.4% | Many licence holders have out-of-town mailing addresses; those are deliberately not placed |
| Event permits (22,061: parades, second lines, special events) | Not placed by design | They describe an event at a place, not work on a property |

Supporting tables the matcher learned from the city's own data:
- 290 street aliases, including renames: Caffin → Fats Domino, Jefferson Davis → Norman C. Francis, Cadillac → Roneagle Way.
- 76,544 tax-bill → GEOPIN links.
- 877 records linked to more than one parcel ("1835-1839 Louisa St").

## The 50-address spot check (independent)

An independent agent drew 50 addresses at random (seed 20261017) across **32 neighborhoods**. For each one it:
- found the city's records itself, by querying data.nola.gov directly;
- checked parcel truth against the city's GIS layers, not See Dat's tables;
- checked a sample of statuses against One Stop.

Method, the full 50-row table and every miss are in [research/validation/spot-check.md](research/validation/spot-check.md).

| Metric | First run | After fixes |
|---|---|---|
| Address → correct parcel | 50/50 (100%) | 50/50 (100%) |
| Record recall (city records at the address that See Dat shows) | 86.9% | **99.2%** (380/383) |
| Doubtful attachments (records shown that don't belong) | 39 (5.6%) | **3** |
| Status text vs One Stop (6 permits) | 6/6 | 6/6 |
| Open/closed vs One Stop | 3/6 | fixed (see below) |

What the first run caught, and the fixes:
1. **Hard caps.** STR lists stopped at 50 and permits at 200, and the MCP tool had no paging. Fix: true totals everywhere, paging (`limit`/`offset`, up to 1,000) in the MCP tool, and a "showing the latest N of M" note on the page.
2. **"Closed" permits shown as open.** A March 2025 bulk administrative closure set status "Closed" (mapped by the city to "Other"). Fix: "Closed" status or any completion date now means closed.
3. **Event and street-closure permits attached by proximity.** Fix: text that isn't an address ("Baronne St at Lafayette St", "Raymond Wedding Second Line Parade - 730 Bienville St") is never placed by map proximity.
4. **Multi-address records** appeared only on their first parcel, and a parenthetical alternate address was ignored. Fix: a `record_parcel` link table, and alternates are tried.

Remaining misses: 3 permits on one Tulane campus parcel (517 permits; reachable by paging, not in the first page the check requests). The 57 newly returned records the check hasn't adjudicated are mostly linked units and range members; they need a human review pass before counting toward precision.

The check is automated: `npx tsx scripts/spot-check.ts` re-runs it against the live MCP server and fails below 90% resolution or recall.

## Independent code reviews

Two review agents read the code without running it:

- **Ingest path: 10 issues, all fixed.** The most serious: a retried Workflow step could silently drop target writes; the crawler could wedge on one ID; duplicate keys flipped every night.
- **Web and MCP: no security issues** (escaping, bound SQL and redirects all checked). Correctness and accessibility issues, all fixed: totals reported as caps, map and typeahead races, ARIA combobox, request size and batch caps, 404s and HEAD caching.

## Known gaps

- **Historical archives not yet loaded:**
  - 311 for 2012–2018 (`3iz8-nghx`).
  - Permits before 2002, and the 2004–2012 Accela/LAMA file-download archives.
  - Legacy demolitions (BlightStatus, to 2019).
  
  All are frozen datasets: a one-time load each.
- **One Stop detail** (inspection results, review comments, fees) covers new records and a four-month backfill. Older history needs a public records request or a long crawl.
- **Owner, assessed value, sales:** not public in bulk. The Assessor's site is bot-protected.
- **Flood zones:** not loaded (FEMA NFHL).
- **NOPD calls at intersections** (about 35%) are skipped. Counting them on the block of the first-named street would stay within NOPD's block-level terms; this is pending Andrew's decision.
- **The `aib5` adapter doesn't map its own type field**, so permits that exist only there show as "Permit" without a type. Fixing it changes source hashes, so it should ship with a planned one-time re-merge.
- **Code-case misses** are concentrated in the 2009 migration. A rule for its glued house numbers ("3385701" → 3385) would recover some, but needs care to avoid false matches.
