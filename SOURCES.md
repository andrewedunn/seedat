<!-- ABOUTME: Inventory of every data source See Dat uses: contents, update cadence, pull method, and join keys. -->
<!-- ABOUTME: Synthesized from research/sources/*.md and corrected by research/validation/claims.md. -->

# Sources

Inventoried 2026-10-17. Per-source detail is in [`research/sources/`](research/sources/). Every dataset, field list and three sample rows are in [socrata.md](research/sources/socrata.md) and its `samples/`. Claims below were re-checked by an independent validator ([claims.md](research/validation/claims.md)). Where the first-pass inventories were wrong, this file uses the corrected version.

All pulls identify as `seedat-research/0.1 (+https://seedat.dunn.us; seedat@dunn.us)` with at least 1 s between requests (3 s for One Stop).

## The short version

| Domain | Primary source | Rows | Fresh? | Pull | Parcel key on the record |
|---|---|---|---|---|---|
| Permits | data.nola.gov **`72f9-bi28` Permits – BLDS** + **`rcm3-fn58` Permits** + **`aib5-en5t` OBES permit applications** (union on permit number) | 466k / 349k / 229k | Nightly-ish; BLDS lagged 2 days at check | SODA, full pull nightly + diff | `pin` = assessor **tax bill number** (90%). **No GEOPIN.** Lat/lon on rcm3 and aib5, not BLDS |
| Permit detail (inspections, reviews, fees, status history, contractors) | One Stop `SummaryContent.aspx?type=Permit&id=N` | ~1.1M ids | Real time | Polite HTML crawl, priority queue | Tax bill number + lot/block |
| Code enforcement | `u6yx-v2tw` cases, `uh5a-f7uw` inspections, `3ehi-je3s` violations, `44ct-56tr` hearings, `xv8z-gn8b` abatements | 183k / 246k / 273k / 103k / 7k | Nightly full replace | SODA full pull + diff | **GEOPIN** on cases and hearings (~93–95%). Inspections/violations join via `caseid` |
| Code enforcement (OBES system) | `wy29-i338` cases, `uzyk-jrck` hearings, `f5zm-xkyr` fines | 114k / 53k / 225k | Nightly | SODA | Address + lat/lon |
| Short-term rentals | `en36-xvxg` applications (2017–), `ufdg-ajws` active licenses, `2ei9-wqw2` non-commercial licenses | 39k / 4.3k / 1.2k | Nightly | SODA | Address + lat/lon |
| 311 | `2jgv-pqrq` (2012–present), `3iz8-nghx` historic 2012–2018 | 1.04M / 304k | Nightly, true upsert | SODA incremental on `:updated_at` | Address + lat/lon → **block level only** in the UI |
| 911 / NOPD calls for service | One dataset per year: 2026 `es9j-6y5d` … 2011 `28ec-c8d6` | ~300–500k/yr | Current year nightly, past years frozen | SODA | **Block level by design.** Never joined to a parcel (terms) |
| Business licenses | `hjcd-grvu`, `iqay-p646` | 38k / 17k | Nightly | SODA | Address + lat/lon (24% ungeocoded) |
| Canonical addresses | maps.nola.gov **`Addresses/Site_Address_Point_LAMA/MapServer/0`** | 275,122 points, 98.2% with GEOPIN | Unknown (no editingInfo); diff weekly | ArcGIS REST paging | **GEOPIN** (string) |
| Canonical parcels | maps.nola.gov `Assessor/Landbase_Layers/MapServer/0` (= Socrata `v9q5-fz7t`) | 151,255 polygons | ~weekly | ArcGIS REST / SODA | **GEOPIN** (int) |
| Zoning, overlays, FLU, historic, landmarks, neighborhoods, council | maps.nola.gov LandUsePlanning, Historic_Preservation, Reference, Administrative layers | 5 – 1,500 polygons each | Rare changes | Whole-layer pull, diff | None: spatial join to parcels at ingest |
| Building footprints | `Basemap/BuildingFootprints/MapServer/0` | 162k | 2026-08 | ArcGIS REST | GEOPIN |
| Flood zones | FEMA NFHL (not on city servers) | — | — | ArcGIS REST | Spatial join |
| Sales / disposition | `hpm5-48nj` NORA sold properties, `5ktx-e9wc` NORA inventory | 5.6k / 189 | Periodic | SODA | GEOPIN |
| Historic permits | `f7tt-z5vu` historical permits (to 2009), `rw6e-a9x3` Accela 2004–2012, `fdhh-psg3` LAMA 2004–2011 | 86k / file / file | Frozen | One-time load (the latter two are file downloads) | Address only |
| Demolitions (historic) | `e3wd-h7q2` BlightStatus demolitions | 3,940 | Frozen 2019-09 | One-time | GEOPIN |

## The join-key problem, measured

The brief asked us to check whether permit numbers, parcel IDs and addresses really join cleanly. They don't.

- **Permit numbers do join.** `numstring` (rcm3) = `permitnum` (BLDS) = `permitnumber` (aib5) = code-enforcement `lastpermit` = One Stop detail page. Format `YY-NNNNN-TYPE` (`26-30446-RENO`); legacy `06ELC-30362`, `10BLD-05574`. Some legacy numbers are in no dataset.
- **The three permit datasets are *not* the same set of permits.** For September 2026 filings: rcm3 1,152, BLDS 2,484, aib5 2,117. rcm3 leaves out plumbing and HDLC permits and most renovation and new-construction permits. Treat BLDS as the spine, union in rcm3/aib5, and keep the source of every field.
- **There are two parcel ID systems and no public crosswalk between them.**
  - Permits carry the assessor's **tax bill number** (`39W401319`, `614225802`).
  - Code enforcement, NORA, footprints, address points and parcels carry the city's **GEOPIN** (`41036019`).
  - "Parcels To Join" (`pzqp-4ri7`) looked like the bridge, but its `parid` is an address-derived key (`3655-FLORENCEAV`), not a tax bill number. 0 of 500 permit pins matched it.
  - Consequence: **permits can only be placed on a parcel through their address or coordinates.** The tax-bill number becomes a secondary key we learn as we go: once a permit is address-matched to a GEOPIN, its pin gets recorded against that GEOPIN, building our own crosswalk.
- **Code enforcement → parcel is clean.** 474/474 non-null GEOPINs exist in the parcel layer (non-null on ~95% of recent cases).
- **Address points → parcel is clean.** 270,170 / 270,201 LAMA GEOPINs exist in the parcel layer.
- **Addresses are the hard part.** A naive uppercase match of 1,000 recent permits against LAMA addresses: **0.4–0.6%**, because LAMA spells out "Street", "Avenue". With suffix abbreviations and unit stripping: **92.9% (BLDS), 93.7% (rcm3)**. The remaining ~7% are multi-address fields ("5415-5417 Elysian Fields Ave"), notes embedded in the address, and renamed streets. This is the 93% → 98% gap the matcher has to close.

## Update cadence and incremental strategy

Measured, not taken from metadata:

- Most city datasets are **replaced wholesale every night**, so every row gets a fresh `:updated_at` (code enforcement cases share one timestamp across all rows). rcm3 and aib5 are replaced in about 50k-row chunks over about 7 minutes. So `:updated_at` cannot be used to find changed rows.
- **311 (`2jgv-pqrq`) is a true upsert.** About 2,300 rows are touched every 2 days, so `:updated_at` works there.
- Strategy: (1) once a day, check `rowsUpdatedAt` for every source in one Discovery API call; (2) for changed datasets, do a full pull (the largest is 1.04M rows) to R2; (3) compute a hash per row against the previous snapshot and apply inserts, updates and deletes. That gives true change history ("this permit's status changed on Oct 16") even though the city doesn't publish one. The tables are small enough that a full nightly pull is cheap.
- Daily window: city refreshes finish by about 08:30 UTC (CFS around 08:00, 311 around 07:10, code enforcement around 04:10, permits around 04:53). Schedule ingestion at **09:00 UTC (4 am Central)**.
- NOPD may reclassify a call for up to 36 h, so re-pull the last 3 days of CFS.
- On Jan 1 a new CFS dataset id appears; detect it through a catalog search.

## Source notes and gotchas

- **One Stop**
  - Detail pages are plain GET, need no cookies, and have no robots.txt (404). The ids are sequential but sparse: `N+1` can return an empty shell while `N+2` is a real permit.
  - Detail pages are the **only** source for inspection results, plan reviews, fee lines and status history.
  - Review comments include staff emails and phone numbers, so strip them.
  - The monthly "Open Data" reports are ASP.NET postbacks and add nothing over Socrata, so they are not used.
  - Advanced search needs a login, so it is not used.
- **BLDS `72f9-bi28`**: the `location` column is empty (0 rows). It has no coordinates.
- **Coordinates**: the address points' `LAT`/`LONG` fields and `xpos`/`ypos` are Louisiana South state-plane feet (EPSG:3452), not degrees. Use the geometry with `outSR=4326`, or reproject.
- **Junk dates**: code enforcement and adjudication contain dates in years 1905, 2915, 5015 and 7201, plus placeholder 1753/1900 dates. Clamp to 1990..today+2y and flag the rest.
- **Duplicates to ignore**:
  - Code enforcement: `6ha4-bwyc`, `d4d6-yab5`, `c3as-66tn`, `gjzc-adg8` (stale copies) and `mrcm-dtu5` (copy of hearings).
  - 311: `ezfk-aiyx`, `3dnv-gjst` (filter views).
  - Permits: `nbcf-m6c2` (stale since 2025-08).
- **HDLC solar review area** service is broken (no layers). Rebuild it from Historic_Preservation layers following its published definition: full-control districts, plus the Esplanade Ridge and Tremé partial-control districts, plus landmarks.
- **Flood zones** are not on city servers. Use FEMA NFHL.
- **Assessor (nolaassessor.com)** is behind a Cloudflare bot challenge, so we don't use it. Owner, value and sales data are out of scope unless the Assessor provides an extract. No assessor roll or sales data is on the portal.

## Terms of use

- Permits, code enforcement, STR applications, 311, address points: **CC0** or no license set (city open data). Show "Source: data.nola.gov, retrieved <date>" on every record.
- **NOPD calls for service**: dataset text bars commercial use ("Any use of the information for commercial purposes is strictly prohibited") and deriving specific addresses. See Dat is non-commercial, keeps calls at block level, never joins them to a parcel, shows the NOPD disclaimer and OPCD attribution, and does not use NOPD marks.
- **Personal data**: STR and business-license datasets include operator phone numbers and emails, permits include owner, applicant and contractor names, and One Stop review comments include staff contact details. Policy: show names the city already shows on its own record pages (owner on permit, contractor), and **drop phones and emails everywhere**.
- The portal-wide terms at data.nola.gov were not fetched; check them before launch.

## How records link (target model)

```
                        ┌──────────── tax bill no. (learned crosswalk)
permit ─(address/lat-lon match)─► address point ─GEOPIN─► parcel ◄─GEOPIN─ code case ─caseid─► inspections, violations, hearings
  │  permit no.                                              ▲  ▲
  └─► One Stop detail (inspections, reviews, status)         │  └─ spatial ─ zoning, overlays, historic, NR, flood, neighborhood, council
STR / 311 / business license ─(address/lat-lon match)────────┘
NOPD calls ─► block (never parcel)
```
