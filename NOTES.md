<!-- ABOUTME: Running log of decisions, dead ends, data quality problems, and open questions for See Dat. -->
<!-- ABOUTME: Newest entries at the bottom of each section; dates are absolute. -->

# See Dat — working notes

## Decisions

- **2026-10-17** — Project slug `seedat`, per `~/dev/stack.md` naming table. Local repo at `~/dev/seedat` (git initialized locally; GitHub repo `andrewdunn/seedat` not yet created — outward-facing, waiting on Andrew).
- **2026-10-17** — Crawler identity for all source pulls: `User-Agent: seedat-research/0.1 (+https://seedat.dunn.us; seedat@dunn.us)`. Uses the project address rather than a personal one. **Open:** `seedat@dunn.us` needs Cloudflare Email Routing set up so the contact actually reaches someone.
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

Tier rationale for this first fan-out: the research tasks need judgment about what is relevant and when to stop, which haiku tends to under-do. Mechanical follow-ups (field inventories, spot checks) will go to haiku.

## Dead ends

- **2026-10-17** — nolaassessor.com sits behind a Cloudflare bot challenge (even robots.txt). Not bypassing it (guardrail: no CAPTCHA/bot-detection bypass). Canonical parcels come from the city's own published layers instead. Possible follow-up: ask the Assessor's Office for a bulk extract — a human email, Andrew's call.
- **2026-10-17** — BlightStatus (Code for America): repo 404, site TLS error. Borrow the concept, not the code.
- **2026-10-17** — OpenAddresses Orleans sources just re-ingest the city's Site Address Points; no added coverage.

## Data quality problems

## Open questions

- Cost: Railway Postgres is a recurring cost. Decide only after the D1 latency test (see brief).
- Domain: `seedat.dunn.us` DNS on Cloudflare — confirm `dunn.us` zone is on this Cloudflare account before deploying.
