<!-- ABOUTME: Explains the See Dat database schema: why it is shaped this way and how it supports future projects. -->
<!-- ABOUTME: The schema itself is db/migrations/0001_init.sql. -->

# Schema

The schema lives in [`db/migrations/0001_init.sql`](../db/migrations/0001_init.sql). It runs on Cloudflare D1 (SQLite). See [NOTES.md](../NOTES.md) for why it's D1 and not Postgres. Short version: the address page measured 25 ms of Worker time on 3.2M real rows.

## Four ideas

1. **The parcel is the key.** Every activity record (permit, code case, STR license, business license) resolves to a `geopin`, the city's GIS parcel ID. The address page is a lookup in front of that key, not a text search across tables. This is how NYC (BBL) and Philadelphia (AIS) do it.
2. **Every join says how it was made.** Activity tables share four columns: `geopin`, `address_id`, `match_type`, `match_score`, plus `address_raw` exactly as the city published it. Coverage can be measured per source and per match rung, and unmatched records are a queryable view (`unmatched`), not silently dropped. See [address-matching.md](address-matching.md).
3. **Spatial questions are answered at ingest, never at request time.** Zoning, overlays, historic district, HDLC control, landmark, solar review, flood zone, neighborhood and council district are columns on `parcel`, assigned once by point-in-polygon on the parcel's representative point and refreshed when a layer changes. Nearest-address lookups use a ~100 m grid `cell` column instead of spatial SQL.
4. **We keep history the city doesn't.** The city publishes current state and replaces most tables nightly. Every pull is snapshotted to R2 (`snapshot.r2_key`). Consecutive snapshots are diffed row by row (`row_hash`), and each changed field goes to `change_log`. That's how we know a permit moved from "Plan Review" to "Issued" on Oct 16, even though no city dataset says so. Records that vanish upstream get `removed_at`; nothing is deleted.

## Tables

| Group | Table | What it holds |
|---|---|---|
| Provenance | `source` | Every upstream dataset/layer: URL, license, observed cadence, last success, staleness threshold. Drives the "data freshness" panel and MCP tool. |
| | `snapshot` | One row per pull, pointing at the raw file in R2, with insert/update/delete counts. |
| | `change_log` | Field-level diffs between snapshots. |
| Geography | `parcel` | GEOPIN, situs, representative point, and every precomputed spatial attribute. |
| | `address` | City address points (LAMA): number, normalized `street_key`, unit, status, GEOPIN, grid cell, hundred-block. |
| | `street_alias` | Variant → canonical street names, learned and manual (see matching doc). |
| | `tax_bill_geopin` | Our learned crosswalk from assessor tax-bill number (on permits) to GEOPIN. The city publishes none. |
| | `block` | Hundred-blocks (`1100 GRAVIER ST`), the unit for 311 and police calls. |
| Activity | `permit` | One row per permit number, unioned across the three city permit datasets (`sources` says which). BLDS field names where they exist. |
| | `permit_event` | Timeline: status milestones, plan reviews, inspections, fees (One Stop detail pages), plus `observed_change` rows from our diffs. |
| | `code_case`, `code_event` | Both code-enforcement systems (`system` = legacy / obes). Events = inspections, violations, hearings, abatements, fines. |
| | `str_license` | Applications and licences in one table; `is_active` = present in today's active list. |
| | `business_license` | Occupational licences. |
| | `service_request` | 311, block level only. |
| | `police_call_month` | NOPD calls aggregated to block × month × category. Raw rows stay in R2 (terms forbid deriving addresses; 6M rows would also crowd D1). |
| Read path | `parcel_summary` | Precomputed counts and the plain-English summary per parcel, so the page and MCP filters read one row. |
| | `permit_fts` | Full-text search over permit descriptions. |
| | `unmatched` (view) | Everything we couldn't place, for the public list and the city feedback loop. |

## Privacy rules enforced in the schema

- No phone or email columns anywhere. They are dropped at ingest from STR, business license and One Stop review comments.
- Names appear only where the city's own public record page shows them (permit owner, contractor, STR operator name).
- 311 has no address or point columns. Police calls exist only as block-month counts, never linked to a parcel.

## How the future projects sit on this

| Future project | What it uses |
|---|---|
| **Permit time predictions** | `permit` (type, class, work class, est_cost, historic district, zoning, applied/issued dates, `days_to_issue`) plus `permit_event` (time spent in each review stage) plus `change_log` (exact dates of status changes as we observe them). Training data accumulates nightly from day one, so starting snapshots now matters even before the model exists. |
| **Neighborhood digests** | `change_log` filtered by `observed_at` and joined to `parcel.neighborhood`: "new permits, new code cases, STR licences issued this week in Bywater". The `change_time` index is there for this. |
| **Blight early warning** | `code_case` and `code_event` stage progression, `parcel_summary` (open cases, years since last permit), `service_request` per block (illegal dumping, high grass), `police_call_month`, NORA dispositions. Signals stay at parcel and block level, and the schema deliberately has no score column (see PRIOR_ART.md). |
| **Building histories** | `permit` back to the 1990s eras (historic datasets load into the same table with their own `sources`), `permit_event`, `code_case`, landmark/NR status on `parcel`, and `change_log`. Footprints (`GEOPIN` on the footprint layer) can be added as a `building` table without touching the rest. |

## Conventions

- Dates are ISO-8601 text (`YYYY-MM-DD` or full timestamps in UTC). Junk upstream dates (years 1905, 2915, 5015, …) are nulled at ingest and counted in the snapshot's quality stats.
- `*_filed` columns hold what the applicant or city wrote on the record (e.g. `zoning_filed`). Our authoritative value is on `parcel`. When they disagree, that's a data-quality finding, not an error.
- Upstream identifiers are kept verbatim (`permit_num`, `case_no`, `request_id`) so every row can be traced back to the city's record.
