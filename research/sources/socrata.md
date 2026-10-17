<!-- ABOUTME: Inventory of data.nola.gov Socrata datasets relevant to See Dat. -->
<!-- ABOUTME: Produced by a source-inventory subagent. -->
# data.nola.gov (Socrata) inventory for See Dat

Probed 2026-10-17 with `User-Agent: seedat-research/0.1 (+https://seedat.dunn.us; seedat@dunn.us)`, >=1.1 s between requests, no app token. Catalog: 298 assets on the domain (`samples/socrata/catalog.json`, from `https://api.us.socrata.com/api/catalog/v1?domains=data.nola.gov&limit=1000`; `resultSetSize` was 298 so no paging was needed). All 298 are listed in `socrata_catalog.csv` (id, name, category, type, data_updated_at, row_count for probed ones, relevance flags, stale flag). 94 relevant datasets were probed in detail (metadata, 3 sample rows, `count(*)`, min/max of date columns, `max(:updated_at)`). Scripts: `scripts/socrata_catalog.py`, `scripts/socrata_probe.py`, `scripts/socrata_report.py` (notes in `scripts/socrata_notes.json`).

## Headline findings

1. **Freshness is good for the live feeds, and most are nightly.** Permits (`rcm3-fn58`), code enforcement (cases, inspections, violations, hearings), STR licenses/applications, occupational licenses, 311 and current-year NOPD calls for service all refreshed within the last 24 h (data through 2026-10-16). Meets the <24h goal if we poll daily after about 08:30 UTC.
2. **`:updated_at` is NOT a usable delta key for almost everything.** The nightly jobs replace the whole table: 346,904 of 349,078 permit rows (and every row of CFS 2026, code enforcement cases, inspections, violations, hearings, STR, licenses) carry the same `:updated_at` from the last refresh. Only 311 (`2jgv-pqrq`) behaves like a real upsert (about 2,300 rows touched per 2 days). Plan: delta by natural date column plus a rolling re-pull window, or hash-diff full pulls (sizes are small: largest live table is 1.04M rows 311).
3. **No assessor roll and no market sales data on Socrata.** The Parcels layer (`v9q5-fz7t`, 151,255 rows) is geometry + situs address + GEOPIN only (no owner, value, land use). Sales: only NORA dispositions (`hpm5-48nj`, 5,618) and Sheriff sales to 2018 (frozen). Both need other sources (Assessor, Land Records, Clerk of Civil District Court).
4. **Permit `pin` is not the GEOPIN.** Permits carry assessor-style IDs (`513840022`, `37W104909`), parcels use 8-digit GEOPIN (`41027259`). `Parcels To Join` (`pzqp-4ri7`) maps GEOPIN to an address-like `parid`, not the assessor PIN. Code enforcement cases/hearings DO carry GEOPIN. For the >=98% address-to-parcel target, use Site Address Points (`hfvu-md72`) plus point-in-polygon on Parcels.
5. **Demolitions dataset is dead**: BlightStatus Demolitions ends 2019-09 (3,940 rows). No successor on Socrata.
6. **Sewerage & Water Board: only RoadWork projects** (`bsnu-de3a`). No SWB billing/leak/service data.
7. **NOPD calls for service**: one dataset per year, 2011-2026, plus a 2020 dataset with a different title ("Call for Service 2020", `hp7u-i9hf`). 2019 (`qf6q-pp4b`) contains rows through 2020-03-31 (overlaps 2020), 2013 starts 2012-12-31: dedupe on `nopd_item`. Addresses are block-level (`011XX Gravier St`); terms prohibit commercial use and deriving addresses (see Terms).
8. **Several duplicates / filter views to ignore**: `mrcm-dtu5` (copy of `44ct-56tr`), `ezfk-aiyx` and `3dnv-gjst` (views of 311), `68qb-xc34` (empty filter view), `8pqz-ftzc` (open subset of cases), four stale copies of code enforcement (`6ha4-bwyc`, `d4d6-yab5`, `c3as-66tn`, `gjzc-adg8`).
9. **Date garbage must be cleaned**: code enforcement `initinspection` min 1905-03-23 and max 2026-11-08, `recordationdate` max year 5015; adjudication `lastinspection` max 2915, `d_due` max 7201, placeholders 1753/1900; STR `expiration_date` max 2027 is legitimate. Grass cutting `initialcomplaintdate` year 3202.
10. **Two code-enforcement systems**: legacy case system (`u6yx-v2tw` family: caseno `26-11902-MPM`, caseid numeric, 2008-present, 183k cases) and the OBES/OneStop system (`wy29-i338` family: `numstring`, `codeincidid`, 114k cases from 2009). Overlap/identity of case numbers across the two needs verification before loading.
11. **Geocode quality varies**: 311 has lat/lon 0.0 for about 4% overall (0.1% since 2025); BLDS permits (`72f9-bi28`) have no coordinates at all (location column empty) but 90% have `pin`; `rcm3-fn58` has `location_1` on 100% rows, `pin` on 90%; code enforcement `geopin` on 93% of cases; business licenses (`hjcd-grvu`) 24% un-geocoded.

## Summary table

Status LIVE = refreshed within 90 days of 2026-10-17, STALE otherwise (annual CFS archives are frozen by design). "Age" is days since `rowsUpdatedAt`.

| ID | Name | Group | Rows | Refreshed | Age (d) | Status | Cadence | Location |
|---|---|---|---|---|---|---|---|---|
| rcm3-fn58 | Permits | Permits | 349078 | 2026-10-17 | 0 | LIVE | Nightly full replace (every row :updated_at = refresh time) | address text + location_1 (lat/lon, 100% filled) + pin |
| 72f9-bi28 | Permits - BLDS | Permits | 466337 | 2026-10-15 | 2 | LIVE | Refreshed ~nightly/every 1-2 days (last 2026-10-15) | originaladdress1 + city/state/zip, pin (90% filled); location column is declared but empty (0 rows) |
| aib5-en5t | Permit Application Data for the Office of Business and External Services | Permits | 228560 | 2026-10-17 | 0 | LIVE | Nightly full replace (every row :updated_at = refresh time) | address + x/y (state plane) + lat/lon + location point |
| nbcf-m6c2 | Building Permits (2018-present) | Permits | 35720 | 2025-08-17 | 426 | STALE | STALE/frozen | see fields |
| fja2-5dmw | Buildings | Permits | 162486 | 2026-08-08 | 70 | LIVE | Periodic GIS refresh (last 2026-08-08) | polygons (the_geom) |
| f7tt-z5vu | Historical Permit Data | Permits | 85899 | 2015-04-24 | 4194 | STALE | Frozen | address |
| rw6e-a9x3 | NOLA Permits - Accela (Historic Data: 3/2004 - 3/2012) | Permits | n/a | 2011-08-26 | 5531 | STALE | Frozen | n/a |
| fdhh-psg3 | NOLA Permits - LAMA (Historic Data: 2004-2011) | Permits | n/a | 2012-12-14 | 5055 | STALE | Frozen | n/a |
| aj8a-ghih | Live Entertainment Permits | Permits | 149 | 2025-08-17 | 426 | STALE | Frozen since 2025-08 | see fields |
| 68qb-xc34 | CBD multi-family permits | Permits | 0 | 2026-10-17 | 0 | LIVE | Derived filter view | n/a |
| u6yx-v2tw | Code Enforcement All Cases | Code enforcement | 183007 | 2026-10-17 | 0 | LIVE | Nightly full replace (every row :updated_at = refresh time) | location = address text; geopin filled for only ~93% (169,523 of 183,007); xpos/ypos state plane, -1 when unknown (174,636 have >0) |
| 8pqz-ftzc | Code Enforcement Active Pipeline | Code enforcement | 44067 | 2026-10-17 | 0 | LIVE | Nightly full replace (every row :updated_at = refresh time) | see fields |
| uh5a-f7uw | Code Enforcement All Inspections | Code enforcement | 246064 | 2026-10-17 | 0 | LIVE | Nightly full replace (every row :updated_at = refresh time) | location = address text only |
| 3ehi-je3s | Code Enforcement All Violations | Code enforcement | 272896 | 2026-10-17 | 0 | LIVE | Nightly full replace (every row :updated_at = refresh time) | location = address text only |
| 44ct-56tr | Code Enforcement All Hearings | Code enforcement | 103309 | 2026-10-17 | 0 | LIVE | Nightly full replace (every row :updated_at = refresh time) | propertyaddress text, geoaddress, geopin (95,560 of 103,309), xpos/ypos |
| mrcm-dtu5 | CE Hearings Detail | Code enforcement | 103309 | 2026-10-17 | 0 | LIVE | Nightly full replace (every row :updated_at = refresh time) | same as 44ct-56tr |
| w6gf-dnv6 | Code Enforcement Hearings | Code enforcement | 5014 | 2026-10-17 | 0 | LIVE | Nightly full replace (every row :updated_at = refresh time) | see fields |
| c8uq-kxp3 | OneStop Hearings | Code enforcement | 5006 | 2026-10-17 | 0 | LIVE | Nightly full replace (every row :updated_at = refresh time) | see fields |
| xhih-vxs6 | Grass Cutting (Lot Abatement/Chapter 66) | Code enforcement | 23437 | 2026-10-17 | 0 | LIVE | Nightly full replace (every row :updated_at = refresh time) | address + x/y + lat/lon |
| xv8z-gn8b | Code Enforcement - Abatements | Code enforcement | 7240 | 2026-10-16 | 1 | LIVE | Nightly | address + xpos/ypos |
| a2w6-xuk2 | Code Enforcement Rodent Harborage | Code enforcement | 30957 | 2026-10-17 | 0 | LIVE | Nightly full replace (every row :updated_at = refresh time) | address text |
| wy29-i338 | Adjudication Enforcement Cases for the Office of Business and External Services | Code enforcement | 114020 | 2026-10-17 | 0 | LIVE | Nightly full replace (every row :updated_at = refresh time) | address + x/y + lat/lon + location |
| uzyk-jrck | Adjudication Enforcement Detailed Hearings Data for the Office of Business and External Services | Code enforcement | 52563 | 2026-10-17 | 0 | LIVE | Nightly full replace (every row :updated_at = refresh time) | see fields |
| f5zm-xkyr | Adjudication Enforcement Fines and Fees Data for the Office of Business and External Services | Code enforcement | 224946 | 2026-10-17 | 0 | LIVE | Nightly full replace (every row :updated_at = refresh time) | see fields |
| 6ha4-bwyc | Code Enforcement All Cases | Code enforcement | 171089 | 2024-07-09 | 830 | STALE | STALE | n/a |
| d4d6-yab5 | Code Enforcement Active Pipeline | Code enforcement | 9928 | 2024-07-09 | 830 | STALE | STALE | n/a |
| c3as-66tn | Code Enforcement All Cases | Code enforcement | 171089 | 2025-02-24 | 600 | STALE | STALE | n/a |
| gjzc-adg8 | Code Enforcement Active Pipeline | Code enforcement | 9928 | 2025-02-24 | 600 | STALE | STALE | n/a |
| d2is-2r79 | Accela Legacy Hearings | Code enforcement | 2957 | 2013-10-31 | 4734 | STALE | Frozen 2013 | n/a |
| grqp-bvwk | Historical Inspection Requests | Code enforcement | 19020 | 2015-05-20 | 4168 | STALE | Frozen 2015 | n/a |
| e3wd-h7q2 | BlightStatus Demolitions | Demolitions | 3940 | 2019-11-26 | 2517 | STALE | Frozen 2019-11 | full_address, geopin |
| fcuq-eeca | Katrina 2005 FEMA Demolition Requests | Demolitions | 9334 | 2025-09-02 | 410 | STALE | Frozen | GPS |
| 2jgv-pqrq | 311 OPCD Calls (2012-Present) | 311 | 1039503 | 2026-10-17 | 0 | LIVE | Nightly ~07:10 UTC, true upsert (about 2,300 rows touched per 2 days), date_created has 1-day lag | final_address text (1,026,296 non-null), lat/lon (0.0 when ungeocoded; 998,565 non-zero of 1.04M; 2025+: 99.9%), geocoded_column |
| ezfk-aiyx | 311 OPCD Francine Calls | 311 | 199111 | 2026-10-17 | 0 | LIVE | Nightly | same as 2jgv-pqrq |
| 3dnv-gjst | Missed Trash Pick-Ups Dec 22-Jan 23 | 311 | 8518 | 2026-10-17 | 0 | LIVE | Filter view | same |
| 3iz8-nghx | 311 Calls (Historic Data: 2012-2018) | 311 | 303735 | 2019-01-08 | 2839 | STALE | Frozen 2019-01 | see fields |
| i57e-74kx | Residential Recycling Requests | 311 | 27501 | 2019-01-08 | 2839 | STALE | Frozen 2019-01 | see fields |
| es9j-6y5d | Calls for Service 2026 | Calls for service and police reports | 274866 | 2026-10-17 | 0 | LIVE | Nightly ~08:00 UTC full replace; created through previous day 23:59 | block_address ("011XX Gravier St", "Terpsichore St & Baronne St" for intersections), location Point (lat/lon already block-snapped), mapx/mapy state plane, zip, beat, policedistrict |
| 4xwx-sfte | Calls for Service 2025 | Calls for service and police reports | 329770 | 2026-01-01 | 289 | STALE | Closed year (final refresh 2026-01-01) | same as 2026 |
| 2zcj-b6ts | Calls for Service 2024 | Calls for service and police reports | 327696 | 2025-01-01 | 654 | STALE | Closed year, final refresh at year-end (2024) | block_address / location (older years may differ in field names) |
| pc5d-tvaw | Calls for Service 2023 | Calls for service and police reports | 325091 | 2024-01-01 | 1020 | STALE | Closed year, final refresh at year-end (2023) | block_address / location (older years may differ in field names) |
| nci8-thrr | Calls for Service 2022 | Calls for service and police reports | 354207 | 2023-01-01 | 1385 | STALE | Closed year, final refresh at year-end (2022) | block_address / location (older years may differ in field names) |
| 3pha-hum9 | Calls for Service 2021 | Calls for service and police reports | 428315 | 2022-01-01 | 1750 | STALE | Closed year, final refresh at year-end (2021) | block_address / location (older years may differ in field names) |
| hp7u-i9hf | Call for Service 2020 | Calls for service and police reports | 432892 | 2021-01-05 | 2111 | STALE | Closed year, final refresh at year-end (2020) | block_address / location (older years may differ in field names) |
| qf6q-pp4b | Calls for Service 2019 | Calls for service and police reports | 487362 | 2020-04-01 | 2390 | STALE | Closed year, final refresh at year-end (2019) | block_address / location (older years may differ in field names) |
| 9san-ivhk | Calls for Service 2018 | Calls for service and police reports | 460874 | 2019-01-01 | 2846 | STALE | Closed year, final refresh at year-end (2018) | block_address / location (older years may differ in field names) |
| bqmt-f3jk | Calls for Service 2017 | Calls for service and police reports | 444111 | 2018-01-01 | 3211 | STALE | Closed year, final refresh at year-end (2017) | block_address / location (older years may differ in field names) |
| wgrp-d3ma | Calls for Service 2016 | Calls for service and police reports | 404062 | 2017-04-05 | 3482 | STALE | Closed year, final refresh at year-end (2016) | block_address / location (older years may differ in field names) |
| w68y-xmk6 | Calls for Service 2015 | Calls for service and police reports | 432733 | 2016-07-28 | 3733 | STALE | Closed year, final refresh at year-end (2015) | block_address / location (older years may differ in field names) |
| jsyu-nz5r | Calls for Service 2014 | Calls for service and police reports | 447462 | 2016-07-28 | 3733 | STALE | Closed year, final refresh at year-end (2014) | block_address / location (older years may differ in field names) |
| 5fn8-vtui | Calls for Service 2013 | Calls for service and police reports | 463619 | 2015-11-02 | 4002 | STALE | Closed year, final refresh at year-end (2013) | block_address / location (older years may differ in field names) |
| rv3g-ypg7 | Calls for Service 2012 | Calls for service and police reports | 505012 | 2015-11-02 | 4002 | STALE | Closed year, final refresh at year-end (2012) | block_address / location (older years may differ in field names) |
| 28ec-c8d6 | Calls for Service 2011 | Calls for service and police reports | 510153 | 2015-11-02 | 4002 | STALE | Closed year, final refresh at year-end (2011) | block_address / location (older years may differ in field names) |
| em4n-zidu | Calls for Service - Hurricane Francine 9/11/24 - 9/12/24 | Calls for service and police reports | 72 | 2025-01-01 | 654 | STALE | Frozen | same |
| agqi-9adb | Electronic Police Report 2025 | Calls for service and police reports | 51195 | 2026-07-06 | 103 | STALE | Appears monthly/irregular (2025 last refresh 2026-07-06; 2024 on 2026-06-30) | location = text block address (no lat/lon) |
| c5iy-ew8n | Electronic Police Report 2024 | Calls for service and police reports | 690329 | 2026-06-30 | 109 | STALE | Monthly-ish | text block address |
| ufdg-ajws | Active Short-Term Rental Licenses | Short-term rentals and lodging | 4318 | 2026-10-17 | 0 | LIVE | Nightly full replace (every row :updated_at = refresh time) | address text, x/y, lat/lon, location point (100%) |
| 2ei9-wqw2 | Non-Commercial Short-Term Rental Licenses | Short-term rentals and lodging | 1235 | 2026-10-17 | 0 | LIVE | Nightly full replace (every row :updated_at = refresh time) | address, x/y, location point |
| en36-xvxg | Short-Term Rental Permit Applications | Short-term rentals and lodging | 39027 | 2026-10-17 | 0 | LIVE | Nightly full replace (every row :updated_at = refresh time) | address text, x/y, location |
| rbhq-zbz9 | Vacation Rentals (Hotels, B&B, short-term rentals, etc.) | Short-term rentals and lodging | 1393 | 2025-01-04 | 651 | STALE | STALE (2025-01-04) | see fields |
| ns2v-hzec | Hotels Motels BBs | Short-term rentals and lodging | 391 | 2024-07-16 | 823 | STALE | STALE (2024-07) | see fields |
| iqay-p646 | Active Occupational Licenses | Business licenses | 16655 | 2026-10-17 | 0 | LIVE | Nightly | address components + locationx/locationy + the_geom point |
| hjcd-grvu | Occupational Business Licenses | Business licenses | 38077 | 2026-10-17 | 0 | LIVE | Daily (per metadata) | address components, lat/lon (0.0 for 24% = ungeocoded, many out-of-town addresses) |
| abc4-h3u3 | Occupational Business License Data for the Office of Business and External Services | Business licenses | 21115 | 2026-10-17 | 0 | LIVE | Nightly full replace (every row :updated_at = refresh time) | address + x/y + lat/lon + location point |
| c77v-v89q | Historical Occupational Business Licenses 2012 | Business licenses | 12869 | 2018-03-22 | 3131 | STALE | Frozen 2018 | address components |
| tc3j-b7gd | Historical Occupational Business Licenses 2013 | Business licenses | 12892 | 2018-03-22 | 3131 | STALE | Frozen 2018 | address components |
| xw7z-p5m2 | Historical Occupational Business Licenses 2014 | Business licenses | 13553 | 2018-02-07 | 3174 | STALE | Frozen 2018 | address components |
| yc4x-fza2 | Historical Occupational Business Licenses 2015 | Business licenses | 13860 | 2018-02-07 | 3174 | STALE | Frozen 2018 | address components |
| xy7w-r8a6 | Historical Occupational Business Licenses 2016 | Business licenses | 14011 | 2018-02-07 | 3174 | STALE | Frozen 2018 | address components |
| sbc5-uppx | Historical Occupational Business Licenses 2017 | Business licenses | 13669 | 2018-02-07 | 3174 | STALE | Frozen 2018 | address components |
| v9q5-fz7t | Parcels | Parcels | 151255 | 2026-10-15 | 2 | LIVE | Weekly-ish GIS refresh (2026-10-15) | MultiPolygon geometry; situs_number/street/type/dir (no city/zip) |
| pzqp-4ri7 | Parcels To Join | Parcels | 162773 | 2026-09-25 | 22 | LIVE | Updated 2026-09-25 | geopin + parid |
| m5br-772y | Lots | Parcels | 190009 | 2026-10-15 | 2 | LIVE | Updated 2026-10-15 | MultiPolygon |
| hfvu-md72 | Site Address Point | Parcels | 268595 | 2026-08-25 | 53 | LIVE | Weekly (metadata) | Point geometry, fulladdr "721 Robert Street", addrnum, fullname (street full name), pointtype; lat/long fields here are STATE PLANE not degrees |
| cym7-cw5z | Tabular Address Points | Parcels | 225956 | 2018-07-02 | 3029 | STALE | Frozen 2018 | address table |
| prh5-qsuf | Building Footprint | Parcels | 162486 | 2026-08-08 | 70 | LIVE | Updated 2026-08-08 | MultiPolygon |
| hpm5-48nj | NORA Sold Properties | Parcels | 5618 | 2026-08-11 | 67 | LIVE | Periodic (2026-08-11) | address, geopin (100%), lat/lon |
| 5ktx-e9wc | NORA Uncommitted Property Inventory | Parcels | 189 | 2026-10-09 | 8 | LIVE | Periodic | address, geopin_2 |
| d52w-8nva | Sheriff Sales - Lien Foreclosures | Parcels | 1771 | 2018-11-16 | 2892 | STALE | STALE (2018-11) | see fields |
| 9a4m-i64z | Assessment Areas | Parcels | 18 | 2025-08-18 | 425 | STALE | Static | polygons |
| bsqt-btyi | Public Land | Parcels | 2149 | 2025-11-10 | 341 | STALE | 2025-11 | polygons |
| aned-jbk9 | Post-Katrina Damage Assessment | Parcels | 165564 | 2013-04-03 | 4945 | STALE | Frozen 2013 | points |
| bizp-xi7c | Zoning Districts | Zoning | 1494 | 2026-08-08 | 70 | LIVE | GIS refresh (2026) | polygons |
| kb74-hpue | Overlay and Interim Zoning | Zoning | 202 | 2026-08-08 | 70 | LIVE | GIS refresh (2026) | polygons |
| ecst-qwxv | Conditional Use | Zoning | 1450 | 2026-08-08 | 70 | LIVE | GIS refresh (2026) | polygons |
| xxb5-5azv | CPC Projects | Zoning | 15611 | 2026-10-17 | 0 | LIVE | Nightly full replace (every row :updated_at = refresh time) | address + x/y + lat/lon |
| hea7-kccz | Local Historic District | Zoning | 22 | 2026-07-09 | 100 | STALE | GIS refresh (2026) | polygons |
| 25e8-s5xx | HDLC Landmarks | Zoning | 342 | 2026-10-07 | 10 | LIVE | 2026-10-07 | points |
| jcvy-gbgr | Mandatory Inclusionary Zoning | Zoning | 3 | 2026-06-06 | 133 | STALE | GIS refresh (2026) | polygons |
| bsnu-de3a | RoadWork SWB Projects | Infrastructure (SWB and DPW) | 8416 | 2026-10-17 | 0 | LIVE | Nightly full replace (every row :updated_at = refresh time) | geometry (road work) |
| u5mk-y9z4 | RoadWork DPW Projects | Infrastructure (SWB and DPW) | 14297 | 2026-10-17 | 0 | LIVE | Nightly full replace (every row :updated_at = refresh time) | geometry |
| 2zer-6wpb | Catch Basin Cleanings / Inspections | Infrastructure (SWB and DPW) | 103767 | 2026-10-17 | 0 | LIVE | Nightly metadata refresh but mdate max 2025-01-02 | catch basin id |
| se4p-ierc | Catch Basins | Infrastructure (SWB and DPW) | 80553 | 2026-04-29 | 171 | STALE | 2026-04-29 | points |
| fdkj-rjrv | Street Name | Infrastructure (SWB and DPW) | 28526 | 2026-07-06 | 103 | STALE | 2026-07-06 | table |

## Stale or dead (not refreshed in over 90 days as of 2026-10-17)

Datasets that matter most: **BlightStatus Demolitions** (ends 2019), **historical 311** (2012-2018, one-time backfill), **historical permits** (1995-2009; the 2004-2012 Accela/LAMA ones are file downloads with no API rows), **Sheriff Sales** (ends 2018), 2012-2017 occupational license snapshots, and the closed-year NOPD CFS archives (frozen by design). Stale duplicates to avoid: four old Code Enforcement copies, `nbcf-m6c2` permits (ends 2024-12), `rbhq-zbz9` STR list, `cym7-cw5z` address points. `2zer-6wpb` (catch basin cleanings) is refreshed nightly but its newest event is 2025-01-02, so it is effectively dead.

| ID | Name | Last refreshed | Age (d) | Rows | Why it matters |
|---|---|---|---|---|---|
| nbcf-m6c2 | Building Permits (2018-present) | 2025-08-17 | 426 | 35720 | superseded permits snapshot |
| f7tt-z5vu | Historical Permit Data | 2015-04-24 | 4194 | 85899 | history only, needed for full history |
| rw6e-a9x3 | NOLA Permits - Accela (Historic Data: 3/2004 - 3/2012) | 2011-08-26 | 5531 | None | file download only, no API rows |
| fdhh-psg3 | NOLA Permits - LAMA (Historic Data: 2004-2011) | 2012-12-14 | 5055 | None | file download only, no API rows |
| aj8a-ghih | Live Entertainment Permits | 2025-08-17 | 426 | 149 | tiny, not updated |
| 6ha4-bwyc | Code Enforcement All Cases | 2024-07-09 | 830 | 171089 | superseded duplicate of code enforcement cases |
| d4d6-yab5 | Code Enforcement Active Pipeline | 2024-07-09 | 830 | 9928 | superseded duplicate |
| c3as-66tn | Code Enforcement All Cases | 2025-02-24 | 600 | 171089 | superseded duplicate |
| gjzc-adg8 | Code Enforcement Active Pipeline | 2025-02-24 | 600 | 9928 | superseded duplicate |
| d2is-2r79 | Accela Legacy Hearings | 2013-10-31 | 4734 | 2957 | history only (2011-2012) |
| grqp-bvwk | Historical Inspection Requests | 2015-05-20 | 4168 | 19020 | history only |
| e3wd-h7q2 | BlightStatus Demolitions | 2019-11-26 | 2517 | 3940 | demolitions data ends 2019-09; no replacement dataset |
| fcuq-eeca | Katrina 2005 FEMA Demolition Requests | 2025-09-02 | 410 | 9334 | historical 2005-2009 |
| 3iz8-nghx | 311 Calls (Historic Data: 2012-2018) | 2019-01-08 | 2839 | 303735 | historical 2012-2018, needed once |
| i57e-74kx | Residential Recycling Requests | 2019-01-08 | 2839 | 27501 | subset of historic 311 |
| 4xwx-sfte | Calls for Service 2025 | 2026-01-01 | 289 | 329770 | annual archive; frozen by design (2025 closed) |
| 2zcj-b6ts | Calls for Service 2024 | 2025-01-01 | 654 | 327696 | annual archive; frozen by design (not a failure) |
| pc5d-tvaw | Calls for Service 2023 | 2024-01-01 | 1020 | 325091 | annual archive; frozen by design (not a failure) |
| nci8-thrr | Calls for Service 2022 | 2023-01-01 | 1385 | 354207 | annual archive; frozen by design (not a failure) |
| 3pha-hum9 | Calls for Service 2021 | 2022-01-01 | 1750 | 428315 | annual archive; frozen by design (not a failure) |
| hp7u-i9hf | Call for Service 2020 | 2021-01-05 | 2111 | 432892 | annual archive; frozen by design (not a failure) |
| qf6q-pp4b | Calls for Service 2019 | 2020-04-01 | 2390 | 487362 | annual archive; frozen by design (not a failure) |
| 9san-ivhk | Calls for Service 2018 | 2019-01-01 | 2846 | 460874 | annual archive; frozen by design (not a failure) |
| bqmt-f3jk | Calls for Service 2017 | 2018-01-01 | 3211 | 444111 | annual archive; frozen by design (not a failure) |
| wgrp-d3ma | Calls for Service 2016 | 2017-04-05 | 3482 | 404062 | annual archive; frozen by design (not a failure) |
| w68y-xmk6 | Calls for Service 2015 | 2016-07-28 | 3733 | 432733 | annual archive; frozen by design (not a failure) |
| jsyu-nz5r | Calls for Service 2014 | 2016-07-28 | 3733 | 447462 | annual archive; frozen by design (not a failure) |
| 5fn8-vtui | Calls for Service 2013 | 2015-11-02 | 4002 | 463619 | annual archive; frozen by design (not a failure) |
| rv3g-ypg7 | Calls for Service 2012 | 2015-11-02 | 4002 | 505012 | annual archive; frozen by design (not a failure) |
| 28ec-c8d6 | Calls for Service 2011 | 2015-11-02 | 4002 | 510153 | annual archive; frozen by design (not a failure) |
| em4n-zidu | Calls for Service - Hurricane Francine 9/11/24 - 9/12/24 | 2025-01-01 | 654 | 72 | event subset |
| agqi-9adb | Electronic Police Report 2025 | 2026-07-06 | 103 | 51195 | out-of-scope EPR; refreshes monthly-ish, not nightly |
| c5iy-ew8n | Electronic Police Report 2024 | 2026-06-30 | 109 | 690329 | out-of-scope EPR |
| rbhq-zbz9 | Vacation Rentals (Hotels, B&B, short-term rentals, etc.) | 2025-01-04 | 651 | 1393 | superseded STR list |
| ns2v-hzec | Hotels Motels BBs | 2024-07-16 | 823 | 391 | static lodging list |
| c77v-v89q | Historical Occupational Business Licenses 2012 | 2018-03-22 | 3131 | 12869 | annual historical snapshots, one-time load |
| tc3j-b7gd | Historical Occupational Business Licenses 2013 | 2018-03-22 | 3131 | 12892 | annual historical snapshots, one-time load |
| xw7z-p5m2 | Historical Occupational Business Licenses 2014 | 2018-02-07 | 3174 | 13553 | annual historical snapshots, one-time load |
| yc4x-fza2 | Historical Occupational Business Licenses 2015 | 2018-02-07 | 3174 | 13860 | annual historical snapshots, one-time load |
| xy7w-r8a6 | Historical Occupational Business Licenses 2016 | 2018-02-07 | 3174 | 14011 | annual historical snapshots, one-time load |
| sbc5-uppx | Historical Occupational Business Licenses 2017 | 2018-02-07 | 3174 | 13669 | annual historical snapshots, one-time load |
| cym7-cw5z | Tabular Address Points | 2018-07-02 | 3029 | 225956 | superseded by Site Address Point |
| d52w-8nva | Sheriff Sales - Lien Foreclosures | 2018-11-16 | 2892 | 1771 | sheriff sales end 2018 |
| 9a4m-i64z | Assessment Areas | 2025-08-18 | 425 | 18 | GIS/reference layer, changes rarely (not a failure) |
| bsqt-btyi | Public Land | 2025-11-10 | 341 | 2149 | GIS/reference layer, changes rarely (not a failure) |
| aned-jbk9 | Post-Katrina Damage Assessment | 2013-04-03 | 4945 | 165564 | archived 2013 |
| hea7-kccz | Local Historic District | 2026-07-09 | 100 | 22 | GIS/reference layer, changes rarely (not a failure) |
| jcvy-gbgr | Mandatory Inclusionary Zoning | 2026-06-06 | 133 | 3 | GIS/reference layer, changes rarely (not a failure) |
| se4p-ierc | Catch Basins | 2026-04-29 | 171 | 80553 | asset layer, not event data |
| fdkj-rjrv | Street Name | 2026-07-06 | 103 | 28526 | GIS/reference layer, changes rarely (not a failure) |

## SODA features for incremental loads

- **Endpoints**: SODA2 `https://data.nola.gov/resource/{id}.json` (also `.csv`, `.geojson` for geo columns). SoQL via `$select`, `$where`, `$order`, `$limit`, `$offset`, `$group`, `$q`. Metadata `https://data.nola.gov/api/views/{id}.json` (`rowsUpdatedAt` epoch, `viewLastModified`, `columns`). SODA3 `/api/v3/views/{id}/query.json` also answered (HTTP 200) but returned system columns only for my trivial query; unauthenticated use is documented as requiring an app token, so prefer SODA2 plus a token.
- **Paging**: default limit is 1000 rows. `$limit=60000` returned 60,000 rows on a single call (no 50k hard cap observed), but use `$order=:id` (or a stable key) with `$offset` paging in chunks of about 50k to be safe. Whole-table export: `/api/views/{id}/rows.csv?accessType=DOWNLOAD` (not exercised) is cheaper for the 1M-row 311 table.
- **System fields**: `:id`, `:created_at`, `:updated_at`, `:version` are available via `$select=:*,*` or by name. Filter with `$where=:updated_at > '2026-10-16T00:00:00'`. **Caveat (measured)**: for nearly every dataset all rows share the last refresh's `:updated_at` (full replacement), so this filter returns the whole table. It is a useful change detector only for the table level (`rowsUpdatedAt` / `max(:updated_at)`) and for 311 `2jgv-pqrq` (true row-level upsert) and `xv8z-gn8b`.
- **Recommended incremental strategy**: (a) poll `/api/views/{id}.json` `rowsUpdatedAt` daily and only fetch when it changed; (b) for append-heavy tables, pull `$where=<date column> >= now-14d` (permits `filingdate`/`applieddate`, cases `casefiled`, violations `violationdate`, 311 `date_created` plus `date_modified`, CFS `timecreate`) and upsert on natural key; (c) status changes on old records (permit status, case stage, hearings) are NOT captured by a creation-date window, so also do a weekly full reload and diff with a row hash. Tables are small enough (largest live: 311 at 1.04M, permits 466k) for a full nightly pull to be viable.
- **Text-typed timestamps**: CFS 2025/2026 columns `timecreate` etc. are `text` (ISO string, sortable and comparable lexically), while 2024 and earlier are calendar dates. Handle both.
- **Calls for service for current year**: `es9j-6y5d` is entire-year, replaced nightly around 08:00 UTC through the previous day 23:59. NOPD may reclassify for 36 hours, so re-pull at least the last 3 days. At year rollover a new dataset id appears (2026 id differs from 2025): detect by catalog search for "Calls for Service 20NN" with `category=Public Safety and Preparedness`.
- **App token**: not needed for this volume, but register one (`X-App-Token` header) to avoid per-IP throttling; Socrata does not publish a fixed limit for unauthenticated requests. No rate-limit headers were returned in the one response inspected (`X-Socrata-RequestId`, `X-Socrata-Region` only). Keep a 1 s gap, retry on 429/5xx with backoff.
- **Geo columns** in JSON come as GeoJSON Point / MultiPolygon objects (`location`, `the_geom`) or `{latitude, longitude}` strings (older `location` type, e.g. `location_1`); numeric strings everywhere (values are quoted).
- **Discovery**: Catalog API `api.us.socrata.com/api/catalog/v1?domains=data.nola.gov` returns `resource.data_updated_at` per asset: one cheap call tells us everything that changed.

## Terms of use

- **Portal default**: most datasets are labelled Creative Commons 1.0 Universal (Public Domain Dedication, CC0) in metadata (124 of 298 in the catalog). Where no license is set (162 of 298, including all NOPD calls-for-service datasets, Parcels, business licenses, Active STR license list) the metadata is silent; the data.nola.gov Terms of Use apply (not independently fetched in this pass: confirm at https://data.nola.gov/terms or the City's open data policy before launch).
- **NOPD calls for service (`es9j-6y5d`, 2011-2025 yearly sets) and Electronic Police Reports**: the dataset description says (paraphrased): data are preliminary and unverified, NOPD gives no warranty; "All data visualizations on maps should be considered approximate and attempts to derive specific addresses are strictly prohibited"; "Any use of the information for commercial purposes is strictly prohibited"; unauthorized use of the NOPD name/logo is unlawful; addresses are block-level to protect victims; some call types (cruelty to juveniles, juvenile attachment, missing juvenile) are removed, and coordinates are removed for sexual offences/prostitution. Metadata license is not set (so CC0 does NOT apply here) and attribution is "Orleans Parish Communications District" on some years. Implications for See Dat: free non-commercial use is permitted, never show or store these as exact addresses (keep block level, do not join CFS rows to specific parcels/addresses), display the NOPD disclaimer and OPCD attribution, and do not use NOPD marks.
- **311 (`2jgv-pqrq`)**: CC0 1.0, attribution "Orleans Parish Communications District".
- **Permits, code enforcement, STR applications**: CC0 1.0 (or unset), attribution Safety and Permits / Code Enforcement. 
- **PII**: STR license datasets contain license holder / operator names, phones and emails (`ufdg-ajws`, `2ei9-wqw2`, `en36-xvxg`); occupational licenses contain owner names, mailing addresses and phone numbers (`hjcd-grvu`, `iqay-p646`); permits include owner, applicant and contractor names. Legal to ingest, but decide before publishing what to expose (recommend dropping phones/emails).
- **Disclaimers**: City datasets generally carry "no warranty" language; show "Source: data.nola.gov, retrieved <date>" on every record.

## Join keys across datasets

| Link | Key(s) | Notes |
|---|---|---|
| Permits across the 3 permit exports | `rcm3-fn58.numstring` = `72f9-bi28.permitnum` = `aib5-en5t.permitnumber` (format `YY-NNNNN-TYPE`, e.g. 26-28966-FGAS) | Unverified overlap; assume the same universe, choose one canonical (BLDS has most rows and mapped enums, rcm3 has coords/fees/zoning). |
| Permit to parcel | `pin` (assessor-style: 9 digits or like 37W104909) vs Parcels `geopin` (8 digits) | Not equal. No crosswalk on Socrata. Use address to Site Address Point to Parcel (point-in-polygon). |
| Code enforcement chain | `caseid` (numeric) across cases, inspections, violations, hearings, abatements; `caseno`/`casenumber` text | Hearings and cases include `geopin`. Inspections/violations have only `location` text address. |
| Code enforcement to permits | none direct | Cases carry `lastpermit`, `permittype`, `permitstatus`, `permitfiling` on the case row (partial link, verify format). |
| Code enforcement (legacy) vs OBES | `caseno` vs `numstring`/`codeincidid` | Different systems, unclear overlap. |
| Code enforcement to parcel | `geopin` (cases ~93%, hearings ~93%, demolitions has a geopin column, fill rate not measured) | Direct join to `v9q5-fz7t.geopin` (numeric vs text typing differs). |
| STR licenses to applications | `license_number` (e.g. 25-XSTR-45204), `reference_code` | Active list is a subset of applications dataset; `reference_code` appears in the OneStop `link` URL (`SearchString=Q657QJ`). STR address only, no GEOPIN: use lat/lon or address match. |
| 311 | `service_request` (e.g. 2021-847416); `final_address` text + lat/lon | No parcel key. Address/geo match only. |
| Calls for service | `nopd_item`; `block_address`, `location` (block-snapped) | Block-level only, by terms must not be matched to individual addresses. EPR `item_number` links to CFS `nopd_item` (same NOPD item numbers). |
| Business licenses | `businesslicensenumber`, address components, lat/lon | Application workflow (`abc4-h3u3.numstring`) vs issued (`hjcd-grvu`): no shared key confirmed. |
| NORA | `geopin` / `geopin_2` | Direct to Parcels. |
| Building footprints | `geopin`, `structureid` | Direct to Parcels. |
| Address normalization | `hfvu-md72` (`fulladdr`, `addrnum`, `fullname`, `siteaddid`), `fdkj-rjrv` Street Name | Seeds the geocoder for the >=98% target. Note `lat`/`long` fields on Site Address Point are state plane feet; use `the_geom`. |
| Spatial layers | zoning, historic districts, council district, NSA, police district | Point-in-polygon only. Permits already carry `zoning`, `historicdistrict`, `councildist`, `subdivision`. |

## Datasets considered and skipped

Not in scope or not relevant: Mardi Gras and demographic/GIS reference layers, schools, libraries, MVA, streetlights, trees, parking, transit, etc. (in `socrata_catalog.csv`). Interesting adjacent: NOPD Use of Force, Stop and Search, Misconduct Complaints, Public Records Requests (`jsrk-e98x`), Short-Term Rental map views (`j5u3-2ueh`, `x5fx-4tmu`: views), Restaurant Inspections (`4eex-dv6s`, external href, 2015), Alcohol Beverage Outlets (`qfg2-kjjz`), Hotels (`ns2v-hzec`). Not found anywhere in the catalog: assessor roll, property sales/transfers, Sewerage & Water Board service data, zoning violations beyond code enforcement, building inspections other than code enforcement inspections (permit inspections count only in `totalinspections` on `rcm3-fn58`).

# Per-dataset detail

Fields are `name:type` as reported by the Socrata metadata (all values arrive as JSON strings). Full metadata and 3 sample rows per dataset are in `research/sources/samples/socrata/`.

## Permits

### Permits (`rcm3-fn58`) [LIVE]
- URL: https://data.nola.gov/resource/rcm3-fn58.json (type: tabular/dataset; 42 columns)
- Rows: 349078; last data refresh (rowsUpdatedAt): 2026-10-17 04:53 UTC (0 days ago); max :updated_at: 2026-10-17T04:53:24
- Date coverage: `filingdate` 2002-02-03 to 2026-10-16; `issuedate` 2012-01-01 to 2026-10-16; `currentstatusdate` 2012-01-01 to 2026-11-14; `nextstatusdate` 2012-07-03 to 2027-06-28
- License/attribution (metadata): Creative Commons 1.0 Universal (Public Domain Dedication) / Safety and Permits
- Cadence: Nightly full replace (every row :updated_at = refresh time)
- Location/address format: address text + location_1 (lat/lon, 100% filled) + pin
- Join keys: numstring (permit # e.g. 26-28966-FGAS), pin (assessor-style ID like 513840022 or 37W104909, NOT the 8-digit GEOPIN), address
- Notes: Main OneStop permit feed from 1/1/2012 (filingdate min 2002 = outliers). Same permit # space as 72f9-bi28 and aib5-en5t (all three are Safety and Permits exports; expect heavy overlap, 349k vs 466k vs 229k rows). Has fees, inspections count, contractors, zoning, historic district, council district. 90% rows have pin.
- Fields: address:text, owner:text, description:text, numstring:text, isclosed:text, type:text, code:text, division:text, m_s:text, filingdate:calendar_date, issuedate:calendar_date, currentstatus:text, nextstatus:text, currentstatusdate:calendar_date, nextstatusdate:calendar_date, landuse:text, landuseshort:text, projectname:text, unpaidfees:number, totalfees:number, bldgarea:number, constrval:number, bondamount:number, opencomments:number, applicant:text, totalinspections:number, contractors:text, pin:text, beds:number, baths:number, heattype:text, secondfloo:number, basementar:number, daysopen:number, daysissued:number, leadagency:text, exitreason:text, subdivision:text, councildist:text, zoning:text, historicdistrict:text, location_1:location
- Sample: `samples/socrata/rcm3-fn58.sample.json`, metadata: `samples/socrata/rcm3-fn58.meta.json`

### Permits - BLDS (`72f9-bi28`) [LIVE]
- URL: https://data.nola.gov/resource/72f9-bi28.json (type: tabular/dataset; 33 columns)
- Rows: 466337; last data refresh (rowsUpdatedAt): 2026-10-15 06:16 UTC (2 days ago); max :updated_at: 2026-10-15T06:17:59
- Date coverage: `applieddate` 2012-01-01 to 2026-10-15; `issuedate` 2001-11-16 to 2026-10-14; `completedate` 2012-05-17 to 2026-10-14; `statusdate` 2012-01-01 to 2026-11-14; `expiresdate` 2002-05-16 to 2027-04-14; `coissueddate` 2026-10-14 to 2026-10-14
- License/attribution (metadata): Creative Commons 1.0 Universal (Public Domain Dedication) / Safety and Permits
- Cadence: Refreshed ~nightly/every 1-2 days (last 2026-10-15)
- Location/address format: originaladdress1 + city/state/zip, pin (90% filled); location column is declared but empty (0 rows)
- Join keys: permitnum, pin, originaladdress1
- Notes: "Permits - BLDS" = Building & Land Development Specification (Open Permit/BLDS schema) with mapped enums (permittypemapped, workclassmapped) and contractor trade/license fields; more rows than rcm3-fn58. No lat/lon, so geocoding is on us (address or pin). issuedate min 2001 are outliers. Link column gives OneStop deep link.
- Fields: permitnum:text, description:text, applieddate:calendar_date, issuedate:calendar_date, completedate:calendar_date, statuscurrent:text, originaladdress1:text, originalcity:text, originalstate:text, originalzip:text, permitclass:text, workclass:text, permittype:text, permittypedesc:text, statusdate:calendar_date, totalsqft:number, link:url, location:location, estprojectcost:number, pin:text, contractorcompanyname:text, contractortrade:text, contractortrademapped:text, contractorlicnum:text, contractorstatelic:text, expiresdate:calendar_date, coissueddate:calendar_date, publisher:text, fee:number, workclassmapped:text, permitclassmapped:text, permittypemapped:text, statuscurrentmapped:text
- Sample: `samples/socrata/72f9-bi28.sample.json`, metadata: `samples/socrata/72f9-bi28.meta.json`

### Permit Application Data for the Office of Business and External Services (`aib5-en5t`) [LIVE]
- URL: https://data.nola.gov/resource/aib5-en5t.json (type: tabular/dataset; 43 columns)
- Rows: 228560; last data refresh (rowsUpdatedAt): 2026-10-17 04:48 UTC (0 days ago); max :updated_at: 2026-10-17T04:50:52
- Date coverage: `certificate_of_occupancy` 2018-01-23 to 2026-10-16; `currentstatusdate` 2018-01-02 to 2026-11-14; `d_create` 2000-01-01 to 2026-10-16; `lastcomment` 2014-10-28 to 2026-10-16; `application_submitted` 2015-03-20 to 2026-10-16; `application_review` 2015-04-13 to 2026-10-16; `permit_approved` 2014-04-25 to 2026-10-16; `plan_review` 2016-05-24 to 2026-10-16; `zoning_review` 2016-04-14 to 2026-10-16; `firstcomment` 2014-10-28 to 2026-10-16; `issue_date` 2001-11-16 to 2026-10-16; `date_of_first_inspection` 2000-03-05 to 2026-11-05
- License/attribution (metadata): none set / City of New Orleans Code Enforcement
- Cadence: Nightly full replace (every row :updated_at = refresh time)
- Location/address format: address + x/y (state plane) + lat/lon + location point
- Join keys: permitnumber, prmtid, address
- Notes: Workflow-timestamp view of permits (application, plan review, zoning review, approval, first inspection, CO date) with days_to_* metrics. Useful for turnaround analytics. Other class of types: includes "Municipal Change of Address".
- Fields: prmtid:text, permitnumber:text, address:text, isclosed:text, exitcode:number, submittaltype:number, reason:text, currentstatus:text, landuse:text, status:text, certificate_of_occupancy:calendar_date, descr:text, isdeleted:text, lu_divisionid:number, class:text, type:text, constrval:number, journalcount:number, commentcount:number, use:text, currentstatusdate:calendar_date, d_create:calendar_date, lastcomment:calendar_date, application_submitted:calendar_date, application_review:calendar_date, permit_approved:calendar_date, plan_review:calendar_date, zoning_review:calendar_date, firstcomment:calendar_date, issue_date:calendar_date, date_of_first_inspection:calendar_date, days_to_application_review:number, days_to_approved:number, days_to_plan_review:number, days_to_zoning_review:number, days_to_first_comment:number, days_to_issue_date:number, days_to_first_inspection:number, x:number, y:number, longitude:number, latitude:number, location:point
- Sample: `samples/socrata/aib5-en5t.sample.json`, metadata: `samples/socrata/aib5-en5t.meta.json`

### Building Permits (2018-present) (`nbcf-m6c2`) [STALE]
- URL: https://data.nola.gov/resource/nbcf-m6c2.json (type: tabular/dataset; 16 columns)
- Rows: 35720; last data refresh (rowsUpdatedAt): 2025-08-17 02:03 UTC (426 days ago); max :updated_at: 2025-08-17T02:03:11
- Date coverage: `issuedate` 2018-01-02 to 2024-12-05
- License/attribution (metadata): Creative Commons 1.0 Universal (Public Domain Dedication) / Bureau of Revenue
- Cadence: STALE/frozen
- Location/address format: see fields
- Join keys: n/a
- Notes: Building permits 2018-2024-12 only; superseded by rcm3-fn58/72f9-bi28. Ignore.
- Fields: the_geom:point, objectid:number, address:text, constructionval:text, descr:text, issuedate:date, landuse:text, locationx:text, locationy:text, numstring:text, permittype:text, prmtid:text, proposedusecategory:text, proposeduseindustry:text, topcat:text, globalid:text
- Sample: `samples/socrata/nbcf-m6c2.sample.json`, metadata: `samples/socrata/nbcf-m6c2.meta.json`

### Buildings (`fja2-5dmw`) [LIVE]
- URL: https://data.nola.gov/resource/fja2-5dmw.json (type: tabular/dataset; 13 columns)
- Rows: 162486; last data refresh (rowsUpdatedAt): 2026-08-08 20:21 UTC (70 days ago); max :updated_at: 2026-08-08T20:21:13
- Date coverage: `created_date` 2025-04-28 to 2026-07-16; `last_edited_date` 2025-04-28 to 2026-07-16
- License/attribution (metadata): none set / none
- Cadence: Periodic GIS refresh (last 2026-08-08)
- Location/address format: polygons (the_geom)
- Join keys: geopin, structureid
- Notes: Same 162,486 rows as Building Footprint prh5-qsuf (this one is the table view with dates). Footprints have GEOPIN so can anchor structure-to-parcel.
- Fields: the_geom:multipolygon, objectid:number, geopin:number, buildingid:text, shape_starea:number, shape_stlength:number, activestatus:number, created_user:text, created_date:date, last_edited_user:text, last_edited_date:date, structureid:number, globalid:text
- Sample: `samples/socrata/fja2-5dmw.sample.json`, metadata: `samples/socrata/fja2-5dmw.meta.json`

### Historical Permit Data (`f7tt-z5vu`) [STALE]
- URL: https://data.nola.gov/resource/f7tt-z5vu.json (type: tabular/dataset; 17 columns)
- Rows: 85899; last data refresh (rowsUpdatedAt): 2015-04-24 21:01 UTC (4194 days ago); max :updated_at: 2015-04-24T21:03:34
- Date coverage: `applicationdate` 1995-12-11 to 2009-11-11; `issuedate` 1995-12-11 to 2005-08-17
- License/attribution (metadata): none set / City of New Orleans – Office of Information Technology & Innovation, Enterprise Information Team
- Cadence: Frozen
- Location/address format: address
- Join keys: permit number
- Notes: Historical permits 1995-2009 (85,899 rows). Fills the pre-2012 gap; static.
- Fields: permitnumber:text, applicationdate:calendar_date, issuedate:calendar_date, housenum:text, streetdir:text, streetname:text, streetsuffix:text, unitnumber:text, matchaddress:text, applicantname:text, parcelowner:text, planningdist:text, zoning:text, description:text, propertykey:text, x:number, y:number
- Sample: `samples/socrata/f7tt-z5vu.sample.json`, metadata: `samples/socrata/f7tt-z5vu.meta.json`

### NOLA Permits - Accela (Historic Data: 3/2004 - 3/2012) (`rw6e-a9x3`) [STALE]
- URL: https://data.nola.gov/resource/rw6e-a9x3.json (type: blobby/file; 0 columns)
- Rows: n/a; last data refresh (rowsUpdatedAt): 2011-08-26 17:19 UTC (5531 days ago); max :updated_at: n/a
- Date coverage: n/a (no date-typed columns, or text-typed timestamps)
- License/attribution (metadata): Creative Commons 1.0 Universal (Public Domain Dedication) / none
- Cadence: Frozen
- Location/address format: n/a
- Join keys: n/a
- Notes: File attachment (not a table): Accela permits 3/2004-3/2012 as downloadable file; no SODA rows.
- Fields: 
- Sample: `samples/socrata/rw6e-a9x3.sample.json`, metadata: `samples/socrata/rw6e-a9x3.meta.json`

### NOLA Permits - LAMA (Historic Data: 2004-2011) (`fdhh-psg3`) [STALE]
- URL: https://data.nola.gov/resource/fdhh-psg3.json (type: blobby/file; 0 columns)
- Rows: n/a; last data refresh (rowsUpdatedAt): 2012-12-14 19:58 UTC (5055 days ago); max :updated_at: n/a
- Date coverage: n/a (no date-typed columns, or text-typed timestamps)
- License/attribution (metadata): Creative Commons 1.0 Universal (Public Domain Dedication) / none
- Cadence: Frozen
- Location/address format: n/a
- Join keys: n/a
- Notes: File attachment (not a table): LAMA permits 2004-2011.
- Fields: 
- Sample: `samples/socrata/fdhh-psg3.sample.json`, metadata: `samples/socrata/fdhh-psg3.meta.json`

### Live Entertainment Permits (`aj8a-ghih`) [STALE]
- URL: https://data.nola.gov/resource/aj8a-ghih.json (type: tabular/dataset; 13 columns)
- Rows: 149; last data refresh (rowsUpdatedAt): 2025-08-17 02:01 UTC (426 days ago); max :updated_at: 2025-08-17T02:01:39
- Date coverage: n/a (no date-typed columns, or text-typed timestamps)
- License/attribution (metadata): Creative Commons 1.0 Universal (Public Domain Dedication) / Bureau of Revenue
- Cadence: Frozen since 2025-08
- Location/address format: see fields
- Join keys: n/a
- Notes: Live entertainment permits, 149 rows.
- Fields: the_geom:point, objectid:number, businessaddress:text, businessname:text, city:text, ownername:text, permittype:text, state:text, suite:text, zip:text, locationx:text, locationy:text, globalid:text
- Sample: `samples/socrata/aj8a-ghih.sample.json`, metadata: `samples/socrata/aj8a-ghih.meta.json`

### CBD multi-family permits (`68qb-xc34`) [LIVE]
- URL: https://data.nola.gov/resource/68qb-xc34.json (type: tabular/filter; 42 columns)
- Rows: 0; last data refresh (rowsUpdatedAt): 2026-10-17 04:53 UTC (0 days ago); max :updated_at: n/a
- Date coverage: n/a (no date-typed columns, or text-typed timestamps)
- License/attribution (metadata): Creative Commons 1.0 Universal (Public Domain Dedication) / Safety and Permits
- Cadence: Derived filter view
- Location/address format: n/a
- Join keys: n/a
- Notes: Filter view of rcm3-fn58; SODA count returned 0 rows. Ignore.
- Fields: address:text, owner:text, description:text, numstring:text, isclosed:text, type:text, code:text, division:text, m_s:text, filingdate:calendar_date, issuedate:calendar_date, currentstatus:text, nextstatus:text, currentstatusdate:calendar_date, nextstatusdate:calendar_date, landuse:text, landuseshort:text, projectname:text, unpaidfees:number, totalfees:number, bldgarea:number, constrval:number, bondamount:number, opencomments:number, applicant:text, totalinspections:number, contractors:text, pin:text, beds:number, baths:number, heattype:text, secondfloo:number, basementar:number, daysopen:number, daysissued:number, leadagency:text, exitreason:text, subdivision:text, councildist:text, zoning:text, historicdistrict:text, location_1:point
- Sample: `samples/socrata/68qb-xc34.sample.json`, metadata: `samples/socrata/68qb-xc34.meta.json`


## Code enforcement, hearings, adjudication

### Code Enforcement All Cases (`u6yx-v2tw`) [LIVE]
- URL: https://data.nola.gov/resource/u6yx-v2tw.json (type: tabular/dataset; 26 columns)
- Rows: 183007; last data refresh (rowsUpdatedAt): 2026-10-17 04:07 UTC (0 days ago); max :updated_at: 2026-10-17T04:05:26
- Date coverage: `statdate` 1988-10-12 to 2026-11-08; `casefiled` 2008-07-28 to 2026-10-16; `initinspection` 1905-03-23 to 2026-11-08; `permitfiling` 1995-12-15 to 2026-10-16; `titleresearch` 2011-11-14 to 2026-10-16; `recordationdate` 2001-10-05 to 5015-12-07
- License/attribution (metadata): Creative Commons 1.0 Universal (Public Domain Dedication) / none
- Cadence: Nightly full replace (every row :updated_at = refresh time)
- Location/address format: location = address text; geopin filled for only ~93% (169,523 of 183,007); xpos/ypos state plane, -1 when unknown (174,636 have >0)
- Join keys: caseno (e.g. 26-11902-MPM), caseid (numeric, links cases to inspections/violations/hearings), geopin (cases & hearings only)
- Notes: Anchor for BlightStatus-style code enforcement. Dates contain garbage: initinspection min 1905-03-23, max 2026-11-08 (scheduled?), recordationdate max year 5015. Must clean. Replaces c3as-66tn/6ha4-bwyc (stale copies).
- Fields: o_c:text, caseno:text, location:text, stage:text, keystatus:text, statdate:calendar_date, casefiled:calendar_date, initinspection:calendar_date, initinspresult:text, prevhearingdate:text, prevhearingresult:text, nexthearingdate:text, lastpermit:text, permitfiling:calendar_date, permittype:text, permitstatus:text, geoaddress:text, city:text, state:text, zipcode:text, geopin:text, xpos:number, ypos:number, caseid:number, titleresearch:calendar_date, recordationdate:calendar_date
- Sample: `samples/socrata/u6yx-v2tw.sample.json`, metadata: `samples/socrata/u6yx-v2tw.meta.json`

### Code Enforcement Active Pipeline (`8pqz-ftzc`) [LIVE]
- URL: https://data.nola.gov/resource/8pqz-ftzc.json (type: tabular/dataset; 28 columns)
- Rows: 44067; last data refresh (rowsUpdatedAt): 2026-10-17 04:45 UTC (0 days ago); max :updated_at: 2026-10-17T04:45:33
- Date coverage: `statdate` 2009-05-12 to 2026-11-08; `casefiled` 2009-01-02 to 2026-10-16; `initinspection` 2007-05-15 to 2026-11-08; `permitfiling` 1996-01-03 to 2026-10-16
- License/attribution (metadata): Creative Commons 1.0 Universal (Public Domain Dedication) / none
- Cadence: Nightly full replace (every row :updated_at = refresh time)
- Location/address format: see fields
- Join keys: caseno (e.g. 26-11902-MPM), caseid (numeric, links cases to inspections/violations/hearings), geopin (cases & hearings only)
- Notes: Open cases subset (active pipeline) of u6yx-v2tw. Redundant if we load All Cases.
- Fields: o_c:text, caseno:text, location:text, stage:text, keystatus:text, statdate:calendar_date, casefiled:calendar_date, initinspection:calendar_date, initinspresult:text, prevhearingdate:text, prevhearingresult:text, nexthearingdate:text, lastpermit:text, permitfiling:calendar_date, permittype:text, permitstatus:text, unpaidfees:number, geoaddress:text, city:text, state:text, zipcode:text, geopin:text, xpos:number, ypos:number, longitude:number, latitude:number, caseid:number, pointlocation:point
- Sample: `samples/socrata/8pqz-ftzc.sample.json`, metadata: `samples/socrata/8pqz-ftzc.meta.json`

### Code Enforcement All Inspections (`uh5a-f7uw`) [LIVE]
- URL: https://data.nola.gov/resource/uh5a-f7uw.json (type: tabular/dataset; 8 columns)
- Rows: 246064; last data refresh (rowsUpdatedAt): 2026-10-17 04:09 UTC (0 days ago); max :updated_at: 2026-10-17T04:08:46
- Date coverage: `inspectiondate` 1905-03-23 to 2026-11-08
- License/attribution (metadata): Creative Commons 1.0 Universal (Public Domain Dedication) / none
- Cadence: Nightly full replace (every row :updated_at = refresh time)
- Location/address format: location = address text only
- Join keys: caseid, caseno
- Notes: Inspection events per case (246k). Date min 1905 and max 2026-11-08 include scheduled/bad dates. Child of u6yx-v2tw.
- Fields: caseid:number, caseno:text, location:text, inspectiondate:calendar_date, inspectiontype:text, inspectionresult:text, inspector:text, check:number
- Sample: `samples/socrata/uh5a-f7uw.sample.json`, metadata: `samples/socrata/uh5a-f7uw.meta.json`

### Code Enforcement All Violations (`3ehi-je3s`) [LIVE]
- URL: https://data.nola.gov/resource/3ehi-je3s.json (type: tabular/dataset; 9 columns)
- Rows: 272896; last data refresh (rowsUpdatedAt): 2026-10-17 04:10 UTC (0 days ago); max :updated_at: 2026-10-17T04:09:44
- Date coverage: `violationdate` 2008-05-19 to 2026-10-16
- License/attribution (metadata): Creative Commons 1.0 Universal (Public Domain Dedication) / none
- Cadence: Nightly full replace (every row :updated_at = refresh time)
- Location/address format: location = address text only
- Join keys: caseid, violationid, caseno
- Notes: Violation rows per case (273k), with code section and text. Child of cases.
- Fields: caseid:number, violationid:number, caseno:text, location:text, violationdate:calendar_date, codesection:text, violation:text, description:text, lastupload:calendar_date
- Sample: `samples/socrata/3ehi-je3s.sample.json`, metadata: `samples/socrata/3ehi-je3s.meta.json`

### Code Enforcement All Hearings (`44ct-56tr`) [LIVE]
- URL: https://data.nola.gov/resource/44ct-56tr.json (type: tabular/dataset; 21 columns)
- Rows: 103309; last data refresh (rowsUpdatedAt): 2026-10-17 04:08 UTC (0 days ago); max :updated_at: 2026-10-17T04:07:36
- Date coverage: `hearingdate` 2008-08-27 to 2026-12-15; `hearingtime` 2008-08-27 to 2026-12-15; `prevhearing` 2009-08-11 to 2026-10-15; `caseestablished` 2008-08-13 to 2026-10-08; `inspected` 1905-03-23 to 2026-10-09
- License/attribution (metadata): Creative Commons 1.0 Universal (Public Domain Dedication) / none
- Cadence: Nightly full replace (every row :updated_at = refresh time)
- Location/address format: propertyaddress text, geoaddress, geopin (95,560 of 103,309), xpos/ypos
- Join keys: casenumber (=caseno), caseid, geopin
- Notes: All code-enforcement hearings 2008-future (hearingdate max 2026-12-15 = scheduled). mrcm-dtu5 is a view with the same 103,309 rows.
- Fields: o_c:text, casenumber:text, propertyaddress:text, casehistory:text, hearingdate:calendar_date, hearingtime:calendar_date, judgment:text, prevhearing:calendar_date, prevhearingstat:text, caseestablished:calendar_date, inspected:calendar_date, inspectionresult:text, councildistrict:text, geoaddress:text, city:text, state:text, zip:text, geopin:text, xpos:number, ypos:number, caseid:number
- Sample: `samples/socrata/44ct-56tr.sample.json`, metadata: `samples/socrata/44ct-56tr.meta.json`

### CE Hearings Detail (`mrcm-dtu5`) [LIVE]
- URL: https://data.nola.gov/resource/mrcm-dtu5.json (type: tabular/filter; 16 columns)
- Rows: 103309; last data refresh (rowsUpdatedAt): 2026-10-17 04:08 UTC (0 days ago); max :updated_at: 2026-10-17T04:07:36
- Date coverage: `hearingdate` 2008-08-27 to 2026-12-15; `prevhearing` 2009-08-11 to 2026-10-15; `caseestablished` 2008-08-13 to 2026-10-08; `inspected` 1905-03-23 to 2026-10-09
- License/attribution (metadata): Creative Commons 1.0 Universal (Public Domain Dedication) / none
- Cadence: Nightly full replace (every row :updated_at = refresh time)
- Location/address format: same as 44ct-56tr
- Join keys: casenumber, caseid
- Notes: Filter view duplicate of 44ct-56tr (identical row count). Ignore.
- Fields: casenumber:text, propertyaddress:text, casehistory:text, hearingdate:calendar_date, judgment:text, prevhearing:calendar_date, prevhearingstat:text, caseestablished:calendar_date, inspected:calendar_date, inspectionresult:text, councildistrict:text, geoaddress:text, city:text, state:text, zip:text, geopin:text
- Sample: `samples/socrata/mrcm-dtu5.sample.json`, metadata: `samples/socrata/mrcm-dtu5.meta.json`

### Code Enforcement Hearings (`w6gf-dnv6`) [LIVE]
- URL: https://data.nola.gov/resource/w6gf-dnv6.json (type: tabular/dataset; 23 columns)
- Rows: 5014; last data refresh (rowsUpdatedAt): 2026-10-17 04:55 UTC (0 days ago); max :updated_at: 2026-10-17T04:55:06
- Date coverage: `hearingdatetime` 1900-01-01 to 2026-12-15; `prevhearing` 1900-01-01 to 2026-12-08; `caseestablished` 2009-10-12 to 2026-10-08; `inspected` 2009-09-10 to 2026-10-09
- License/attribution (metadata): none set / none
- Cadence: Nightly full replace (every row :updated_at = refresh time)
- Location/address format: see fields
- Join keys: case number
- Notes: Upcoming hearings only (5,014 rows; hearingdatetime min 1900 = placeholder). Not history.
- Fields: o_c:text, casenumber:text, propertyaddress:text, casehistory:text, hearingdatetime:calendar_date, videoconferencelink:url, teleconferenceaccesscode:text, videoconferencepassword:text, prevhearing:calendar_date, prevhearingstat:text, caseestablished:calendar_date, inspected:calendar_date, inspectionresult:text, councildistrict:text, geoaddress:text, city:text, state:text, zip:number, xpos:number, ypos:number, longitude:number, latitude:number, location:point
- Sample: `samples/socrata/w6gf-dnv6.sample.json`, metadata: `samples/socrata/w6gf-dnv6.meta.json`

### OneStop Hearings (`c8uq-kxp3`) [LIVE]
- URL: https://data.nola.gov/resource/c8uq-kxp3.json (type: tabular/dataset; 26 columns)
- Rows: 5006; last data refresh (rowsUpdatedAt): 2026-10-17 05:05 UTC (0 days ago); max :updated_at: 2026-10-17T05:05:06
- Date coverage: `hearingdatetime` 1900-01-01 to 2026-12-16; `prevhearing` 1900-01-01 to 2026-11-18; `caseestablished` 2013-03-08 to 2026-09-14; `inspected` 2013-03-08 to 2026-09-14
- License/attribution (metadata): none set / none
- Cadence: Nightly full replace (every row :updated_at = refresh time)
- Location/address format: see fields
- Join keys: case number
- Notes: OneStop-sourced hearings (5,006 rows, upcoming/recent). Not full history.
- Fields: o_c:text, casenumber:text, casesummary:url, propertyaddress:text, casetype:text, department:text, casehistory:text, hearingdatetime:calendar_date, videoconferencelink:url, teleconferenceaccesscode:text, videoconferencepassword:text, prevhearing:calendar_date, prevhearingstat:text, caseestablished:calendar_date, inspected:calendar_date, inspectionresult:text, councildistrict:text, geoaddress:text, city:text, state:text, zip:text, xpos:number, ypos:number, longitude:number, latitude:number, location:point
- Sample: `samples/socrata/c8uq-kxp3.sample.json`, metadata: `samples/socrata/c8uq-kxp3.meta.json`

### Grass Cutting (Lot Abatement/Chapter 66) (`xhih-vxs6`) [LIVE]
- URL: https://data.nola.gov/resource/xhih-vxs6.json (type: tabular/dataset; 29 columns)
- Rows: 23437; last data refresh (rowsUpdatedAt): 2026-10-17 03:25 UTC (0 days ago); max :updated_at: 2026-10-17T03:25:26
- Date coverage: `currentstatusdate` 2020-12-11 to 2026-10-21; `casefiled` 2011-04-12 to 2026-10-14; `initinspection` 2011-08-09 to 2026-10-13; `violationlettersent` 2020-11-20 to 2023-10-10; `initialworkordercomplete` 2020-12-01 to 2023-05-31; `initialcutcomplete` 2021-03-01 to 2022-05-05; `latestmaintenancecut` 2021-10-04 to 2021-12-15; `initialcomplaintdate` 2020-12-28 to 3202-06-03; `latestcomplaintdate` 2021-08-04 to 2024-06-21
- License/attribution (metadata): none set / none
- Cadence: Nightly full replace (every row :updated_at = refresh time)
- Location/address format: address + x/y + lat/lon
- Join keys: caseno
- Notes: Grass cutting/lot abatement (Chapter 66) cases; work-order milestones. Date columns have garbage (year 3202).
- Fields: o_c:text, caseno:text, casetype:text, address:text, currentstatus:text, currentstatusdate:calendar_date, casefiled:calendar_date, initinspection:calendar_date, initinspresult:text, violationlettersent:calendar_date, hasworkorder:text, workordercurrentstatus:text, initialworkordercomplete:calendar_date, initialcuttype:text, initialcutassignment:text, initialcutcomplete:calendar_date, countofmaintenancecuts:number, latestmaintenancecut:calendar_date, casesource:text, initialcomplaintnumber:text, initialcomplaintdate:calendar_date, latestcomplaintnumber:text, latestcomplaintdate:calendar_date, mva_class:text, x:number, y:number, longitude:number, latitude:number, location:point
- Sample: `samples/socrata/xhih-vxs6.sample.json`, metadata: `samples/socrata/xhih-vxs6.meta.json`

### Code Enforcement - Abatements (`xv8z-gn8b`) [LIVE]
- URL: https://data.nola.gov/resource/xv8z-gn8b.json (type: tabular/dataset; 15 columns)
- Rows: 7240; last data refresh (rowsUpdatedAt): 2026-10-16 04:00 UTC (1 days ago); max :updated_at: 2026-10-16T04:00:04
- Date coverage: `datefiled` 2009-02-20 to 2022-08-24; `dateclosed` 2012-07-19 to 2026-10-08; `dateenteredabatement` 2010-03-01 to 2025-02-04; `lastupload` 2021-09-16 to 2026-10-15
- License/attribution (metadata): none set / none
- Cadence: Nightly
- Location/address format: address + xpos/ypos
- Join keys: caseno, caseid
- Notes: Abatement events (7,240): only ~31 rows touched in last 2 days, so closer to true incremental, uses lastupload.
- Fields: caseno:text, address:text, o_c:text, judgment:text, eventname:text, status:text, exitreason:text, datefiled:calendar_date, dateclosed:calendar_date, dateenteredabatement:calendar_date, stage:text, xpos:number, ypos:number, caseid:number, lastupload:calendar_date
- Sample: `samples/socrata/xv8z-gn8b.sample.json`, metadata: `samples/socrata/xv8z-gn8b.meta.json`

### Code Enforcement Rodent Harborage (`a2w6-xuk2`) [LIVE]
- URL: https://data.nola.gov/resource/a2w6-xuk2.json (type: tabular/filter; 9 columns)
- Rows: 30957; last data refresh (rowsUpdatedAt): 2026-10-17 04:10 UTC (0 days ago); max :updated_at: 2026-10-17T04:09:44
- Date coverage: `violationdate` 2009-04-10 to 2026-10-16
- License/attribution (metadata): Creative Commons 1.0 Universal (Public Domain Dedication) / none
- Cadence: Nightly full replace (every row :updated_at = refresh time)
- Location/address format: address text
- Join keys: caseno?
- Notes: Filter view of rodent-harborage violations (30,957).
- Fields: caseid:number, violationid:number, caseno:text, location:text, violationdate:calendar_date, codesection:text, violation:text, description:text, lastupload:calendar_date
- Sample: `samples/socrata/a2w6-xuk2.sample.json`, metadata: `samples/socrata/a2w6-xuk2.meta.json`

### Adjudication Enforcement Cases for the Office of Business and External Services (`wy29-i338`) [LIVE]
- URL: https://data.nola.gov/resource/wy29-i338.json (type: tabular/dataset; 34 columns)
- Rows: 114020; last data refresh (rowsUpdatedAt): 2026-10-17 04:24 UTC (0 days ago); max :updated_at: 2026-10-17T04:24:00
- Date coverage: `d_filed` 2009-02-26 to 2026-10-16; `d_create` 2012-06-21 to 2026-10-16; `d_closed` 2012-06-22 to 2026-10-16; `currentstatusdate` 2007-10-17 to 2026-11-08; `nextstatusdate` 2009-02-23 to 2031-08-24; `nextinspection` 1753-01-01 to 2026-12-07; `lastinspection` 1753-01-01 to 2915-04-07; `initinspection` 2004-03-31 to 2026-11-08; `keystatusdate` 1900-01-01 to 2026-11-08; `dateresearched` 2017-12-04 to 2026-10-16; `supervisor_review` 2012-03-06 to 2026-10-16
- License/attribution (metadata): none set / Office of Performance and Accountability
- Cadence: Nightly full replace (every row :updated_at = refresh time)
- Location/address format: address + x/y + lat/lon + location
- Join keys: codeincidid, numstring (case number), address
- Notes: Office of Business & External Services (new Accela/OneStop) code enforcement cases; 114k rows. Newer system than u6yx-v2tw (legacy Hansen/BlightStatus). Date garbage: lastinspection max 2915, nextstatusdate 2031, many 1753/1900 placeholders. Overlap with u6yx-v2tw unclear: check numstring vs caseno formats before dedup.
- Fields: codeincidid:text, isclosed:checkbox, isdeleted:checkbox, exitcode:text, numstring:text, address:text, name:text, type:text, updatedtype:text, d_filed:calendar_date, d_create:calendar_date, d_closed:calendar_date, reason:text, currentstatus:text, currentstatusdate:calendar_date, stage:text, nextstatus:text, nextstatusdate:calendar_date, prevhearingstatus:text, initinspectionstatus:text, unpaidfees:number, feecount:number, nextinspection:calendar_date, lastinspection:calendar_date, initinspection:calendar_date, keystatusdate:calendar_date, dateresearched:calendar_date, supervisor_review:calendar_date, agency:text, x:number, y:number, longitude:number, latitude:number, location:point
- Sample: `samples/socrata/wy29-i338.sample.json`, metadata: `samples/socrata/wy29-i338.meta.json`

### Adjudication Enforcement Detailed Hearings Data for the Office of Business and External Services (`uzyk-jrck`) [LIVE]
- URL: https://data.nola.gov/resource/uzyk-jrck.json (type: tabular/dataset; 26 columns)
- Rows: 52563; last data refresh (rowsUpdatedAt): 2026-10-17 04:50 UTC (0 days ago); max :updated_at: 2026-10-17T04:51:11
- Date coverage: `hearing_date` 2010-08-30 to 2026-12-16; `prevhearingdate` 1900-01-01 to 2026-10-15; `nexthearingdate` 1900-01-01 to 2026-12-16; `case_established` 2009-02-20 to 2026-10-16
- License/attribution (metadata): none set / City of New Orleans
- Cadence: Nightly full replace (every row :updated_at = refresh time)
- Location/address format: see fields
- Join keys: case number
- Notes: Detailed hearings for wy29-i338 (52,563 rows).
- Fields: hearing_id:text, incident_number:text, codeincidid:text, o_c:text, address:text, agency:text, case_type:text, updatedtype:text, hearing_date:calendar_date, prevhearingdate:calendar_date, nexthearingdate:calendar_date, judgment:text, case_established:calendar_date, violation_count:number, open_violations:number, event_at_case_closed:text, close_reason:text, case_history:text, feecount:number, courtfee:number, sumfee:number, x:number, y:number, longitude:number, latitude:number, location:point
- Sample: `samples/socrata/uzyk-jrck.sample.json`, metadata: `samples/socrata/uzyk-jrck.meta.json`

### Adjudication Enforcement Fines and Fees Data for the Office of Business and External Services (`f5zm-xkyr`) [LIVE]
- URL: https://data.nola.gov/resource/f5zm-xkyr.json (type: tabular/dataset; 18 columns)
- Rows: 224946; last data refresh (rowsUpdatedAt): 2026-10-17 04:27 UTC (0 days ago); max :updated_at: 2026-10-17T04:31:09
- Date coverage: `case_established` 2005-07-12 to 2026-10-16; `d_due` 1753-01-01 to 7201-04-11; `d_paid` 2012-06-20 to 2026-10-16; `d_create` 2000-01-01 to 2026-10-16; `d_mod` 2000-01-01 to 2026-10-16
- License/attribution (metadata): none set / City of New Orleans
- Cadence: Nightly full replace (every row :updated_at = refresh time)
- Location/address format: see fields
- Join keys: case number
- Notes: Fines and fees ledger (224,946 rows), d_due max year 7201 (garbage).
- Fields: incident_number:text, codeincidid:text, codefeeid:text, o_c:text, address:text, case_established:calendar_date, amount:number, type:text, ispaid:checkbox, d_due:calendar_date, d_paid:calendar_date, d_create:calendar_date, d_mod:calendar_date, x:number, y:number, longitude:number, latitude:number, location:point
- Sample: `samples/socrata/f5zm-xkyr.sample.json`, metadata: `samples/socrata/f5zm-xkyr.meta.json`

### Code Enforcement All Cases (`6ha4-bwyc`) [STALE]
- URL: https://data.nola.gov/resource/6ha4-bwyc.json (type: tabular/dataset; 11 columns)
- Rows: 171089; last data refresh (rowsUpdatedAt): 2024-07-09 22:15 UTC (830 days ago); max :updated_at: 2024-07-09T22:14:50
- Date coverage: n/a (no date-typed columns, or text-typed timestamps)
- License/attribution (metadata): Creative Commons 1.0 Universal (Public Domain Dedication) / Code Enforcement
- Cadence: STALE
- Location/address format: n/a
- Join keys: caseno
- Notes: Old copy of All Cases (171,089 rows, 2024-07-09). Superseded by u6yx-v2tw.
- Fields: the_geom:point, objectid:number, caseno:text, geopin:text, nexthearingdate:text, o_c:text, permitstatus:text, prevhearingresult:text, stage:text, statdate:text, zipcode:text
- Sample: `samples/socrata/6ha4-bwyc.sample.json`, metadata: `samples/socrata/6ha4-bwyc.meta.json`

### Code Enforcement Active Pipeline (`d4d6-yab5`) [STALE]
- URL: https://data.nola.gov/resource/d4d6-yab5.json (type: tabular/dataset; 22 columns)
- Rows: 9928; last data refresh (rowsUpdatedAt): 2024-07-09 22:05 UTC (830 days ago); max :updated_at: 2024-07-09T22:05:09
- Date coverage: n/a (no date-typed columns, or text-typed timestamps)
- License/attribution (metadata): Creative Commons 1.0 Universal (Public Domain Dedication) / Code Enforcement
- Cadence: STALE
- Location/address format: n/a
- Join keys: caseno
- Notes: Old copy of Active Pipeline.
- Fields: the_geom:point, objectid:number, casefiled:text, caseid:text, caseno:text, geoaddress:text, geopin:text, initinspection:text, initinspresult:text, keystatus:text, lastpermit:text, location:text, nexthearingdate:text, o_c:text, permitfiling:text, permitstatus:text, permittype:text, prevhearingdate:text, prevhearingresult:text, stage:text, statdate:text, zipcode:text
- Sample: `samples/socrata/d4d6-yab5.sample.json`, metadata: `samples/socrata/d4d6-yab5.meta.json`

### Code Enforcement All Cases (`c3as-66tn`) [STALE]
- URL: https://data.nola.gov/resource/c3as-66tn.json (type: tabular/dataset; 11 columns)
- Rows: 171089; last data refresh (rowsUpdatedAt): 2025-02-24 16:31 UTC (600 days ago); max :updated_at: 2025-02-24T16:31:45
- Date coverage: n/a (no date-typed columns, or text-typed timestamps)
- License/attribution (metadata): none set / none
- Cadence: STALE
- Location/address format: n/a
- Join keys: caseno
- Notes: Old copy of All Cases (2025-02-24).
- Fields: the_geom:point, objectid:number, caseno:text, geopin:text, nexthearingdate:text, o_c:text, permitstatus:text, prevhearingresult:text, stage:text, statdate:text, zipcode:text
- Sample: `samples/socrata/c3as-66tn.sample.json`, metadata: `samples/socrata/c3as-66tn.meta.json`

### Code Enforcement Active Pipeline (`gjzc-adg8`) [STALE]
- URL: https://data.nola.gov/resource/gjzc-adg8.json (type: tabular/dataset; 22 columns)
- Rows: 9928; last data refresh (rowsUpdatedAt): 2025-02-24 16:21 UTC (600 days ago); max :updated_at: 2025-02-24T16:21:47
- Date coverage: n/a (no date-typed columns, or text-typed timestamps)
- License/attribution (metadata): none set / none
- Cadence: STALE
- Location/address format: n/a
- Join keys: caseno
- Notes: Old copy of Active Pipeline (2025-02-24).
- Fields: the_geom:point, objectid:number, casefiled:text, caseid:text, caseno:text, geoaddress:text, geopin:text, initinspection:text, initinspresult:text, keystatus:text, lastpermit:text, location:text, nexthearingdate:text, o_c:text, permitfiling:text, permitstatus:text, permittype:text, prevhearingdate:text, prevhearingresult:text, stage:text, statdate:text, zipcode:text
- Sample: `samples/socrata/gjzc-adg8.sample.json`, metadata: `samples/socrata/gjzc-adg8.meta.json`

### Accela Legacy Hearings (`d2is-2r79`) [STALE]
- URL: https://data.nola.gov/resource/d2is-2r79.json (type: tabular/dataset; 17 columns)
- Rows: 2957; last data refresh (rowsUpdatedAt): 2013-10-31 14:05 UTC (4734 days ago); max :updated_at: 2015-03-21T04:51:51
- Date coverage: `inspectiondate` 2008-10-13 to 2012-02-16; `noticedate` 2011-03-23 to 2012-03-30; `postingstatusdate` 2011-05-11 to 2012-03-29; `prevhearingdate` 2011-01-10 to 2012-02-16; `hearingdate` 2011-03-01 to 2012-03-29
- License/attribution (metadata): Creative Commons 1.0 Universal (Public Domain Dedication) / none
- Cadence: Frozen 2013
- Location/address format: n/a
- Join keys: n/a
- Notes: Accela-era legacy hearings 2011-2012 (2,957 rows).
- Fields: objectid:number, casenumber:text, propertyaddress:text, propertydetail:text, councildistrict:text, geopin:number, inspectiondate:calendar_date, noticedate:calendar_date, postingstatusdate:calendar_date, prevhearingdate:calendar_date, prevhearingtime:text, casehistory:text, hearingdate:calendar_date, hearingtime:text, judgment:text, x:number, y:number
- Sample: `samples/socrata/d2is-2r79.sample.json`, metadata: `samples/socrata/d2is-2r79.meta.json`

### Historical Inspection Requests (`grqp-bvwk`) [STALE]
- URL: https://data.nola.gov/resource/grqp-bvwk.json (type: tabular/dataset; 26 columns)
- Rows: 19020; last data refresh (rowsUpdatedAt): 2015-05-20 19:55 UTC (4168 days ago); max :updated_at: 2015-05-20T19:56:40
- Date coverage: `recieveddate` 1984-02-19 to 2005-03-17; `createdatetime` 1997-11-25 to 2005-03-17; `updatedatetime` 1997-12-03 to 2005-02-28
- License/attribution (metadata): Creative Commons 1.0 Universal (Public Domain Dedication) / none
- Cadence: Frozen 2015
- Location/address format: n/a
- Join keys: n/a
- Notes: Historical inspection requests 1984-2005 (19,020).
- Fields: complaintnumber:text, recieveddate:calendar_date, housenum:text, streetdir:text, streetname:text, streetsuffix:text, unitnumber:text, violationaddress:text, category:text, violatorname:text, parcelowner:text, zoning:text, complaintmeth:text, complainttype:text, complaintclass:text, stopworkissued:text, description:text, inspector:text, resolutiontype:text, createdatetime:calendar_date, createopid:text, updatedatetime:calendar_date, updateopid:text, propertykey:text, x:number, y:number
- Sample: `samples/socrata/grqp-bvwk.sample.json`, metadata: `samples/socrata/grqp-bvwk.meta.json`


## Demolitions

### BlightStatus Demolitions (`e3wd-h7q2`) [STALE]
- URL: https://data.nola.gov/resource/e3wd-h7q2.json (type: tabular/dataset; 8 columns)
- Rows: 3940; last data refresh (rowsUpdatedAt): 2019-11-26 18:05 UTC (2517 days ago); max :updated_at: 2019-11-26T18:05:09
- Date coverage: `demolition_start` 2009-11-23 to 2019-09-10; `demolition_complete` 2010-09-02 to 2019-09-11
- License/attribution (metadata): Creative Commons 1.0 Universal (Public Domain Dedication) / Office of Performance and Accountability
- Cadence: Frozen 2019-11
- Location/address format: full_address, geopin
- Join keys: caseid, geopin
- Notes: BlightStatus demolitions 2009-2019, 3,940 rows. Nothing newer on Socrata. Current demolition activity must come from code enforcement (abatement/stage fields) or Permits (demolition permit types).
- Fields: program:text, caseid:text, full_address:text, geopin:text, units:number, council_district:text, demolition_start:calendar_date, demolition_complete:calendar_date
- Sample: `samples/socrata/e3wd-h7q2.sample.json`, metadata: `samples/socrata/e3wd-h7q2.meta.json`

### Katrina 2005 FEMA Demolition Requests (`fcuq-eeca`) [STALE]
- URL: https://data.nola.gov/resource/fcuq-eeca.json (type: tabular/dataset; 99 columns)
- Rows: 9334; last data refresh (rowsUpdatedAt): 2025-09-02 17:23 UTC (410 days ago); max :updated_at: 2025-09-02T17:23:31
- Date coverage: `source_dat` 2005-12-12 to 2009-03-10; `last_updat` 2006-01-05 to 2009-04-27; `concur_dat` 2000-04-18 to 2008-11-06; `gps_date` 2005-12-12 to 2009-03-10
- License/attribution (metadata): Creative Commons 1.0 Universal (Public Domain Dedication) / City of New Orleans
- Cadence: Frozen
- Location/address format: GPS
- Join keys: n/a
- Notes: Post-Katrina FEMA demolition requests 2005-2009 (9,334). Historical only.
- Fields: the_geom:point, objectid:number, gps_id:text, cultural_r:text, location_i:text, survey_id:text, boundary_t:text, map_method:text, source:text, source_dat:calendar_date, source_d_1:text, source_coo:text, source_acc:text, last_updat:calendar_date, restrict_s:text, property_n:text, street_num:text, street_nam:text, city_tag:text, city_datab:text, historic_n:text, constructi:text, date_estim:text, less_than_:text, listed_sta:text, contribute:text, significan:text, historic_c:text, materials_:text, design_int:text, wrkmanship:text, setting_in:text, location_1:text, foundatio2:text, wall_condi:text, roof_condi:text, damage_typ:text, current_us:text, style:text, building_t:text, footprint:text, height:text, foundation:text, const_mate:text, cladding:text, roof_mate:text, roof_type:text, chimneys:text, chimney_ma:text, porches:text, point_reco:text, outbuildin:text, comment:text, eligibilit:text, shpo_concu:text, fema_deter:text, shpo_revie:text, fema_revie:text, concur_dat:calendar_date, review_com:text, collapsed_:text, pub_commen:text, surveyor_n:text, photograph:text, photo1:text, photo2:text, photo3:text, photo4:text, photo1path:text, photo2path:text, photo3path:text, photo4path:text, photofile:text, corr_type:text, rcvr_type:text, gps_date:calendar_date, gps_time:text, update_sta:text, feat_nam:text, datafile:text, unfilt_pos:text, data_dicti:text, latitude:text, longitude:text, nhd:text, prob_zone:text, d_zone:text, d_list:text, shpo_consu:text, arch_tier:text, zipcode:text, address:text, demostatus:text, demoinfo:text, st_num:text, st_dir:text, st_name:text, st_suffix:text, location_2:point
- Sample: `samples/socrata/fcuq-eeca.sample.json`, metadata: `samples/socrata/fcuq-eeca.meta.json`


## 311

### 311 OPCD Calls (2012-Present) (`2jgv-pqrq`) [LIVE]
- URL: https://data.nola.gov/resource/2jgv-pqrq.json (type: tabular/dataset; 19 columns)
- Rows: 1039503; last data refresh (rowsUpdatedAt): 2026-10-17 07:10 UTC (0 days ago); max :updated_at: 2026-10-17T07:10:09
- Date coverage: `date_created` 2019-01-01 to 2026-10-16; `date_modified` 2019-01-03 to 2026-10-16; `case_close_date` 2012-03-25 to 2026-10-16
- License/attribution (metadata): Creative Commons 1.0 Universal (Public Domain Dedication) / Orleans Parish Communications District
- Cadence: Nightly ~07:10 UTC, true upsert (about 2,300 rows touched per 2 days), date_created has 1-day lag
- Location/address format: final_address text (1,026,296 non-null), lat/lon (0.0 when ungeocoded; 998,565 non-zero of 1.04M; 2025+: 99.9%), geocoded_column
- Join keys: service_request (e.g. 2021-847416), rowid, final_address
- Notes: Includes historic 311 re-keyed, but date_created min is 2019-01-01 (pre-2019 rows only in case_close_date; true 2012-2018 history is in 3iz8-nghx). So full history = this + 3iz8-nghx. Only dataset where :updated_at is a usable delta key. No resident PII; no contact fields.
- Fields: service_request:text, request_type:text, request_reason:text, date_created:calendar_date, date_modified:calendar_date, case_close_date:calendar_date, request_status:text, responsible_agency:text, final_address:text, address_councildis:text, status:text, contractor:text, contractor_action:text, rowid:number, final_x:number, final_y:number, longitude:number, latitude:number, geocoded_column:location
- Sample: `samples/socrata/2jgv-pqrq.sample.json`, metadata: `samples/socrata/2jgv-pqrq.meta.json`

### 311 OPCD Francine Calls (`ezfk-aiyx`) [LIVE]
- URL: https://data.nola.gov/resource/ezfk-aiyx.json (type: tabular/filter; 19 columns)
- Rows: 199111; last data refresh (rowsUpdatedAt): 2026-10-17 07:10 UTC (0 days ago); max :updated_at: 2026-10-17T07:10:09
- Date coverage: `date_created` 2024-09-09 to 2026-10-16; `date_modified` 2024-09-09 to 2026-10-16; `case_close_date` 2024-09-09 to 2026-10-16
- License/attribution (metadata): Creative Commons 1.0 Universal (Public Domain Dedication) / Orleans Parish Communications District
- Cadence: Nightly
- Location/address format: same as 2jgv-pqrq
- Join keys: service_request
- Notes: Filter view of 311 from 2024-09-09 (Francine onward), 199k rows; subset of 2jgv-pqrq. Ignore.
- Fields: service_request:text, request_type:text, request_reason:text, date_created:calendar_date, date_modified:calendar_date, case_close_date:calendar_date, request_status:text, responsible_agency:text, final_address:text, address_councildis:text, status:text, contractor:text, contractor_action:text, rowid:number, final_x:number, final_y:number, longitude:number, latitude:number, geocoded_column:point
- Sample: `samples/socrata/ezfk-aiyx.sample.json`, metadata: `samples/socrata/ezfk-aiyx.meta.json`

### Missed Trash Pick-Ups Dec 22-Jan 23 (`3dnv-gjst`) [LIVE]
- URL: https://data.nola.gov/resource/3dnv-gjst.json (type: tabular/filter; 19 columns)
- Rows: 8518; last data refresh (rowsUpdatedAt): 2026-10-17 07:10 UTC (0 days ago); max :updated_at: 2026-09-03T17:54:15
- Date coverage: `date_created` 2022-12-01 to 2023-01-31; `date_modified` 2022-12-01 to 2025-12-02; `case_close_date` 2022-06-14 to 2025-12-02
- License/attribution (metadata): Creative Commons 1.0 Universal (Public Domain Dedication) / Orleans Parish Communications District
- Cadence: Filter view
- Location/address format: same
- Join keys: service_request
- Notes: Missed trash pickup Dec 2022-Jan 2023 filter view. Subset. Ignore.
- Fields: service_request:text, request_type:text, request_reason:text, date_created:calendar_date, date_modified:calendar_date, case_close_date:calendar_date, request_status:text, responsible_agency:text, final_address:text, address_councildis:text, status:text, contractor:text, contractor_action:text, rowid:number, final_x:number, final_y:number, longitude:number, latitude:number, geocoded_column:point
- Sample: `samples/socrata/3dnv-gjst.sample.json`, metadata: `samples/socrata/3dnv-gjst.meta.json`

### 311 Calls (Historic Data: 2012-2018) (`3iz8-nghx`) [STALE]
- URL: https://data.nola.gov/resource/3iz8-nghx.json (type: tabular/dataset; 18 columns)
- Rows: 303735; last data refresh (rowsUpdatedAt): 2019-01-08 04:38 UTC (2839 days ago); max :updated_at: 2019-09-17T21:00:22
- Date coverage: `ticket_created_date_time` 2012-03-12 to 2019-01-02; `ticket_closed_date_time` 2012-03-12 to 2019-01-04
- License/attribution (metadata): Creative Commons 1.0 Universal (Public Domain Dedication) / none
- Cadence: Frozen 2019-01
- Location/address format: see fields
- Join keys: ticket id
- Notes: 311 2012-2018 (303,735 rows) with ticket_created_date_time. Needed for full history. Static; also :updated_at 2019-09-17.
- Fields: ticket_id:text, issue_type:text, ticket_created_date_time:calendar_date, ticket_closed_date_time:calendar_date, ticket_status:text, issue_description:text, street_address:text, neighborhood_district:text, council_district:text, city:text, state:text, zip_code:number, location:location, geom:location, latitude:number, longitude:number, closure_reason:text, case_title:text
- Sample: `samples/socrata/3iz8-nghx.sample.json`, metadata: `samples/socrata/3iz8-nghx.meta.json`

### Residential Recycling Requests (`i57e-74kx`) [STALE]
- URL: https://data.nola.gov/resource/i57e-74kx.json (type: tabular/filter; 16 columns)
- Rows: 27501; last data refresh (rowsUpdatedAt): 2019-01-08 04:38 UTC (2839 days ago); max :updated_at: 2019-09-17T21:00:22
- Date coverage: `ticket_created_date_time` 2012-03-19 to 2018-12-28; `ticket_closed_date_time` 2012-03-23 to 2019-01-02
- License/attribution (metadata): Creative Commons 1.0 Universal (Public Domain Dedication) / none
- Cadence: Frozen 2019-01
- Location/address format: see fields
- Join keys: ticket id
- Notes: Residential recycling requests 2012-2018 (27,501); subset of 3iz8-nghx.
- Fields: ticket_id:text, issue_type:text, ticket_created_date_time:calendar_date, ticket_closed_date_time:calendar_date, ticket_status:text, issue_description:text, street_address:text, neighborhood_district:text, council_district:text, city:text, state:text, zip_code:number, location:point, geom:point, latitude:number, longitude:number
- Sample: `samples/socrata/i57e-74kx.sample.json`, metadata: `samples/socrata/i57e-74kx.meta.json`


## Calls for service and police reports

### Calls for Service 2026 (`es9j-6y5d`) [LIVE]
- URL: https://data.nola.gov/resource/es9j-6y5d.json (type: tabular/dataset; 21 columns)
- Rows: 274866; last data refresh (rowsUpdatedAt): 2026-10-17 08:00 UTC (0 days ago); max :updated_at: 2026-10-17T08:01:04
- Date coverage: n/a (no date-typed columns, or text-typed timestamps)
- License/attribution (metadata): none set / none
- Cadence: Nightly ~08:00 UTC full replace; created through previous day 23:59
- Location/address format: block_address ("011XX Gravier St", "Terpsichore St & Baronne St" for intersections), location Point (lat/lon already block-snapped), mapx/mapy state plane, zip, beat, policedistrict
- Join keys: nopd_item (e.g. J1676526) only; no join to permits/cases except via block/geo
- Notes: Current-year calls for service. All text-typed timestamps (timecreate etc.). Rows can be reclassified for 36 hours, so a nightly full pull or rolling 3-day re-pull is required. NOPD terms: block-level addresses only; do not derive specific addresses; no commercial use (see Terms of use)
- Fields: nopd_item:text, type_:text, typetext:text, priority:text, initialtype:text, initialtypetext:text, initialpriority:text, mapx:text, mapy:text, timecreate:text, timedispatch:text, timearrive:text, timeclosed:text, disposition:text, dispositiontext:text, selfinitiated:text, beat:text, block_address:text, zip:text, policedistrict:text, location:point
- Sample: `samples/socrata/es9j-6y5d.sample.json`, metadata: `samples/socrata/es9j-6y5d.meta.json`

### Calls for Service 2025 (`4xwx-sfte`) [STALE]
- URL: https://data.nola.gov/resource/4xwx-sfte.json (type: tabular/dataset; 21 columns)
- Rows: 329770; last data refresh (rowsUpdatedAt): 2026-01-01 09:01 UTC (289 days ago); max :updated_at: 2026-01-01T09:01:38
- Date coverage: n/a (no date-typed columns, or text-typed timestamps)
- License/attribution (metadata): none set / none
- Cadence: Closed year (final refresh 2026-01-01)
- Location/address format: same as 2026
- Join keys: nopd_item
- Notes: 2025 calls for service, 329,770 rows, frozen. NOPD terms: block-level addresses only; do not derive specific addresses; no commercial use (see Terms of use)
- Fields: nopd_item:text, type_:text, typetext:text, priority:text, initialtype:text, initialtypetext:text, initialpriority:text, mapx:text, mapy:text, timecreate:text, timedispatch:text, timearrive:text, timeclosed:text, disposition:text, dispositiontext:text, selfinitiated:text, beat:text, block_address:text, zip:text, policedistrict:text, location:point
- Sample: `samples/socrata/4xwx-sfte.sample.json`, metadata: `samples/socrata/4xwx-sfte.meta.json`

### Calls for Service 2024 (`2zcj-b6ts`) [STALE]
- URL: https://data.nola.gov/resource/2zcj-b6ts.json (type: tabular/dataset; 21 columns)
- Rows: 327696; last data refresh (rowsUpdatedAt): 2025-01-01 09:00 UTC (654 days ago); max :updated_at: 2025-01-01T09:00:44
- Date coverage: `timecreate` 2024-01-01 to 2024-12-31; `timedispatch` 2024-01-01 to 2025-01-01; `timearrive` 2024-01-01 to 2025-01-01; `timeclosed` 2024-01-01 to 2025-01-01
- License/attribution (metadata): none set / Orleans Parish Communications District
- Cadence: Closed year, final refresh at year-end (2024)
- Location/address format: block_address / location (older years may differ in field names)
- Join keys: nopd_item
- Notes: 2024 calls for service, frozen archive. NOPD terms: block-level addresses only; do not derive specific addresses; no commercial use (see Terms of use)
- Fields: nopd_item:text, type_:text, typetext:text, priority:text, initialtype:text, initialtypetext:text, initialpriority:text, mapx:text, mapy:text, timecreate:calendar_date, timedispatch:calendar_date, timearrive:calendar_date, timeclosed:calendar_date, disposition:text, dispositiontext:text, selfinitiated:text, beat:text, block_address:text, zip:text, policedistrict:number, location:point
- Sample: `samples/socrata/2zcj-b6ts.sample.json`, metadata: `samples/socrata/2zcj-b6ts.meta.json`

### Calls for Service 2023 (`pc5d-tvaw`) [STALE]
- URL: https://data.nola.gov/resource/pc5d-tvaw.json (type: tabular/dataset; 21 columns)
- Rows: 325091; last data refresh (rowsUpdatedAt): 2024-01-01 09:00 UTC (1020 days ago); max :updated_at: 2024-01-01T09:00:37
- Date coverage: `timecreate` 2023-01-01 to 2023-12-31; `timedispatch` 2023-01-01 to 2024-01-01; `timearrive` 2023-01-01 to 2024-01-01; `timeclosed` 2023-01-01 to 2024-01-01
- License/attribution (metadata): none set / Orleans Parish Communications District
- Cadence: Closed year, final refresh at year-end (2023)
- Location/address format: block_address / location (older years may differ in field names)
- Join keys: nopd_item
- Notes: 2023 calls for service, frozen archive. NOPD terms: block-level addresses only; do not derive specific addresses; no commercial use (see Terms of use)
- Fields: nopd_item:text, type_:text, typetext:text, priority:text, initialtype:text, initialtypetext:text, initialpriority:text, mapx:text, mapy:text, timecreate:calendar_date, timedispatch:calendar_date, timearrive:calendar_date, timeclosed:calendar_date, disposition:text, dispositiontext:text, selfinitiated:text, beat:text, block_address:text, zip:text, policedistrict:number, location:point
- Sample: `samples/socrata/pc5d-tvaw.sample.json`, metadata: `samples/socrata/pc5d-tvaw.meta.json`

### Calls for Service 2022 (`nci8-thrr`) [STALE]
- URL: https://data.nola.gov/resource/nci8-thrr.json (type: tabular/dataset; 21 columns)
- Rows: 354207; last data refresh (rowsUpdatedAt): 2023-01-01 09:00 UTC (1385 days ago); max :updated_at: 2023-01-01T09:00:37
- Date coverage: `timecreate` 2022-01-01 to 2022-12-31; `timedispatch` 2022-01-01 to 2023-01-01; `timearrive` 2022-01-01 to 2023-01-01; `timeclosed` 2022-01-01 to 2023-01-01
- License/attribution (metadata): none set / Orleans Parish Communications District
- Cadence: Closed year, final refresh at year-end (2022)
- Location/address format: block_address / location (older years may differ in field names)
- Join keys: nopd_item
- Notes: 2022 calls for service, frozen archive. NOPD terms: block-level addresses only; do not derive specific addresses; no commercial use (see Terms of use)
- Fields: nopd_item:text, type_:text, typetext:text, priority:text, initialtype:text, initialtypetext:text, initialpriority:text, mapx:text, mapy:text, timecreate:calendar_date, timedispatch:calendar_date, timearrive:calendar_date, timeclosed:calendar_date, disposition:text, dispositiontext:text, selfinitiated:text, beat:text, block_address:text, zip:text, policedistrict:number, location:point
- Sample: `samples/socrata/nci8-thrr.sample.json`, metadata: `samples/socrata/nci8-thrr.meta.json`

### Calls for Service 2021 (`3pha-hum9`) [STALE]
- URL: https://data.nola.gov/resource/3pha-hum9.json (type: tabular/dataset; 21 columns)
- Rows: 428315; last data refresh (rowsUpdatedAt): 2022-01-01 09:00 UTC (1750 days ago); max :updated_at: 2022-01-01T09:00:48
- Date coverage: `timecreate` 2021-01-01 to 2021-12-31; `timedispatch` 2021-01-01 to 2022-01-01; `timearrive` 2021-01-01 to 2022-01-01; `timeclosed` 2021-01-01 to 2022-01-01
- License/attribution (metadata): none set / Orleans Parish Communications District
- Cadence: Closed year, final refresh at year-end (2021)
- Location/address format: block_address / location (older years may differ in field names)
- Join keys: nopd_item
- Notes: 2021 calls for service, frozen archive. NOPD terms: block-level addresses only; do not derive specific addresses; no commercial use (see Terms of use)
- Fields: nopd_item:text, type_:text, typetext:text, priority:text, initialtype:text, initialtypetext:text, initialpriority:text, mapx:text, mapy:text, timecreate:calendar_date, timedispatch:calendar_date, timearrive:calendar_date, timeclosed:calendar_date, disposition:text, dispositiontext:text, selfinitiated:text, beat:text, block_address:text, zip:text, policedistrict:number, location:point
- Sample: `samples/socrata/3pha-hum9.sample.json`, metadata: `samples/socrata/3pha-hum9.meta.json`

### Call for Service 2020 (`hp7u-i9hf`) [STALE]
- URL: https://data.nola.gov/resource/hp7u-i9hf.json (type: tabular/dataset; 21 columns)
- Rows: 432892; last data refresh (rowsUpdatedAt): 2021-01-05 04:56 UTC (2111 days ago); max :updated_at: 2021-01-01T09:00:37
- Date coverage: `timecreate` 2020-01-01 to 2020-12-31; `timedispatch` 2020-01-01 to 2021-01-01; `timearrive` 2020-01-01 to 2021-01-01; `timeclosed` 2020-01-01 to 2021-01-01
- License/attribution (metadata): none set / Orleans Parish Communications District
- Cadence: Closed year, final refresh at year-end (2020)
- Location/address format: block_address / location (older years may differ in field names)
- Join keys: nopd_item
- Notes: 2020 calls for service, frozen archive. NOPD terms: block-level addresses only; do not derive specific addresses; no commercial use (see Terms of use)
- Fields: nopd_item:text, type_:text, typetext:text, priority:text, initialtype:text, initialtypetext:text, initialpriority:text, mapx:text, mapy:text, timecreate:calendar_date, timedispatch:calendar_date, timearrive:calendar_date, timeclosed:calendar_date, disposition:text, dispositiontext:text, selfinitiated:text, beat:text, block_address:text, zip:text, policedistrict:number, location:point
- Sample: `samples/socrata/hp7u-i9hf.sample.json`, metadata: `samples/socrata/hp7u-i9hf.meta.json`

### Calls for Service 2019 (`qf6q-pp4b`) [STALE]
- URL: https://data.nola.gov/resource/qf6q-pp4b.json (type: tabular/dataset; 21 columns)
- Rows: 487362; last data refresh (rowsUpdatedAt): 2020-04-01 08:00 UTC (2390 days ago); max :updated_at: 2020-04-01T08:00:44
- Date coverage: `timecreate` 2019-01-01 to 2020-03-31; `timedispatch` 2019-01-01 to 2020-04-01; `timearrive` 2019-01-01 to 2020-04-01; `timeclosed` 2019-01-01 to 2020-04-01
- License/attribution (metadata): Creative Commons 1.0 Universal (Public Domain Dedication) / Orleans Parish Communications District
- Cadence: Closed year, final refresh at year-end (2019)
- Location/address format: block_address / location (older years may differ in field names)
- Join keys: nopd_item
- Notes: 2019 calls for service, frozen archive. NOPD terms: block-level addresses only; do not derive specific addresses; no commercial use (see Terms of use)
- Fields: nopd_item:text, type_:text, typetext:text, priority:text, mapx:text, mapy:text, timecreate:calendar_date, timedispatch:calendar_date, timearrive:calendar_date, timeclosed:calendar_date, disposition:text, dispositiontext:text, initialtype:text, initialtypetext:text, initialpriority:text, selfinitiated:text, beat:text, block_address:text, zip:text, policedistrict:number, location:location
- Sample: `samples/socrata/qf6q-pp4b.sample.json`, metadata: `samples/socrata/qf6q-pp4b.meta.json`

### Calls for Service 2018 (`9san-ivhk`) [STALE]
- URL: https://data.nola.gov/resource/9san-ivhk.json (type: tabular/dataset; 21 columns)
- Rows: 460874; last data refresh (rowsUpdatedAt): 2019-01-01 09:00 UTC (2846 days ago); max :updated_at: 2019-01-01T10:02:37
- Date coverage: `timecreate` 2018-01-01 to 2018-12-31; `timedispatch` 2018-01-01 to 2019-01-01; `timearrive` 2018-01-01 to 2019-01-01; `timeclosed` 2018-01-01 to 2019-01-01
- License/attribution (metadata): Creative Commons 1.0 Universal (Public Domain Dedication) / Orleans Parish Communications District
- Cadence: Closed year, final refresh at year-end (2018)
- Location/address format: block_address / location (older years may differ in field names)
- Join keys: nopd_item
- Notes: 2018 calls for service, frozen archive. NOPD terms: block-level addresses only; do not derive specific addresses; no commercial use (see Terms of use)
- Fields: nopd_item:text, type_:text, typetext:text, priority:text, initialtype:text, initialtypetext:text, initialpriority:text, mapx:text, mapy:text, timecreate:calendar_date, timedispatch:calendar_date, timearrive:calendar_date, timeclosed:calendar_date, disposition:text, dispositiontext:text, selfinitiated:text, beat:text, block_address:text, zip:text, policedistrict:number, location:location
- Sample: `samples/socrata/9san-ivhk.sample.json`, metadata: `samples/socrata/9san-ivhk.meta.json`

### Calls for Service 2017 (`bqmt-f3jk`) [STALE]
- URL: https://data.nola.gov/resource/bqmt-f3jk.json (type: tabular/dataset; 21 columns)
- Rows: 444111; last data refresh (rowsUpdatedAt): 2018-01-01 09:01 UTC (3211 days ago); max :updated_at: 2018-01-01T10:05:32
- Date coverage: `timecreate` 2017-01-01 to 2017-12-31; `timedispatch` 2017-01-01 to 2018-01-01; `timearrive` 2017-01-01 to 2018-01-01; `timeclosed` 2017-01-01 to 2018-01-01
- License/attribution (metadata): Creative Commons 1.0 Universal (Public Domain Dedication) / Orleans Parish Communications District
- Cadence: Closed year, final refresh at year-end (2017)
- Location/address format: block_address / location (older years may differ in field names)
- Join keys: nopd_item
- Notes: 2017 calls for service, frozen archive. NOPD terms: block-level addresses only; do not derive specific addresses; no commercial use (see Terms of use)
- Fields: nopd_item:text, type_:text, typetext:text, priority:text, initialtype:text, initialtypetext:text, initialpriority:text, mapx:text, mapy:text, timecreate:calendar_date, timedispatch:calendar_date, timearrive:calendar_date, timeclosed:calendar_date, disposition:text, dispositiontext:text, selfinitiated:text, beat:text, block_address:text, zip:text, policedistrict:number, location:location
- Sample: `samples/socrata/bqmt-f3jk.sample.json`, metadata: `samples/socrata/bqmt-f3jk.meta.json`

### Calls for Service 2016 (`wgrp-d3ma`) [STALE]
- URL: https://data.nola.gov/resource/wgrp-d3ma.json (type: tabular/dataset; 21 columns)
- Rows: 404062; last data refresh (rowsUpdatedAt): 2017-04-05 16:17 UTC (3482 days ago); max :updated_at: 2018-02-15T18:45:34
- Date coverage: `timecreate` 2016-01-01 to 2016-12-31; `timedispatch` 2016-01-01 to 2017-01-01; `timearrive` 2016-01-01 to 2017-01-01; `timeclosed` 2016-01-01 to 2017-01-01
- License/attribution (metadata): Creative Commons 1.0 Universal (Public Domain Dedication) / Orleans Parish Communications District
- Cadence: Closed year, final refresh at year-end (2016)
- Location/address format: block_address / location (older years may differ in field names)
- Join keys: nopd_item
- Notes: 2016 calls for service, frozen archive. NOPD terms: block-level addresses only; do not derive specific addresses; no commercial use (see Terms of use)
- Fields: nopd_item:text, type_:text, typetext:text, priority:text, initialtype:text, initialtypetext:text, initialpriority:text, mapx:text, mapy:text, timecreate:calendar_date, timedispatch:calendar_date, timearrive:calendar_date, timeclosed:calendar_date, disposition:text, dispositiontext:text, selfinitiated:text, beat:text, block_address:text, zip:text, policedistrict:number, location:location
- Sample: `samples/socrata/wgrp-d3ma.sample.json`, metadata: `samples/socrata/wgrp-d3ma.meta.json`

### Calls for Service 2015 (`w68y-xmk6`) [STALE]
- URL: https://data.nola.gov/resource/w68y-xmk6.json (type: tabular/dataset; 21 columns)
- Rows: 432733; last data refresh (rowsUpdatedAt): 2016-07-28 21:21 UTC (3733 days ago); max :updated_at: 2018-02-15T18:43:30
- Date coverage: `timecreate` 2015-01-01 to 2015-12-31; `timedispatch` 2015-01-01 to 2015-12-31; `timearrive` 2015-01-01 to 2015-12-31; `timeclosed` 2015-01-01 to 2016-02-05
- License/attribution (metadata): Creative Commons 1.0 Universal (Public Domain Dedication) / Orleans Parish Communications District
- Cadence: Closed year, final refresh at year-end (2015)
- Location/address format: block_address / location (older years may differ in field names)
- Join keys: nopd_item
- Notes: 2015 calls for service, frozen archive. NOPD terms: block-level addresses only; do not derive specific addresses; no commercial use (see Terms of use)
- Fields: nopd_item:text, type_:text, typetext:text, priority:text, initialtype:text, initialtypetext:text, initialpriority:text, mapx:text, mapy:text, timecreate:calendar_date, timedispatch:calendar_date, timearrive:calendar_date, timeclosed:calendar_date, disposition:text, dispositiontext:text, selfinitiated:text, beat:text, block_address:text, zip:text, policedistrict:number, location:location
- Sample: `samples/socrata/w68y-xmk6.sample.json`, metadata: `samples/socrata/w68y-xmk6.meta.json`

### Calls for Service 2014 (`jsyu-nz5r`) [STALE]
- URL: https://data.nola.gov/resource/jsyu-nz5r.json (type: tabular/dataset; 21 columns)
- Rows: 447462; last data refresh (rowsUpdatedAt): 2016-07-28 21:06 UTC (3733 days ago); max :updated_at: 2018-02-15T18:43:59
- Date coverage: `timecreate` 2014-01-01 to 2014-12-31; `timedispatch` 2013-12-31 to 2015-01-04; `timearrive` 2014-01-01 to 2014-12-31; `timeclosed` 2014-01-01 to 2015-01-04
- License/attribution (metadata): Creative Commons 1.0 Universal (Public Domain Dedication) / Orleans Parish Communications District
- Cadence: Closed year, final refresh at year-end (2014)
- Location/address format: block_address / location (older years may differ in field names)
- Join keys: nopd_item
- Notes: 2014 calls for service, frozen archive. NOPD terms: block-level addresses only; do not derive specific addresses; no commercial use (see Terms of use)
- Fields: nopd_item:text, type_:text, typetext:text, priority:text, initialtype:text, initialtypetext:text, initialpriority:text, mapx:text, mapy:text, timecreate:calendar_date, timedispatch:calendar_date, timearrive:calendar_date, timeclosed:calendar_date, disposition:text, dispositiontext:text, selfinitiated:text, beat:text, block_address:text, zip:text, policedistrict:number, location:location
- Sample: `samples/socrata/jsyu-nz5r.sample.json`, metadata: `samples/socrata/jsyu-nz5r.meta.json`

### Calls for Service 2013 (`5fn8-vtui`) [STALE]
- URL: https://data.nola.gov/resource/5fn8-vtui.json (type: tabular/dataset; 16 columns)
- Rows: 463619; last data refresh (rowsUpdatedAt): 2015-11-02 18:13 UTC (4002 days ago); max :updated_at: 2018-02-15T18:42:53
- Date coverage: `timecreate` 2012-12-31 to 2013-12-31; `timedispatch` 2013-01-01 to 2014-01-01; `timearrive` 2013-01-01 to 2014-01-01; `timeclosed` 2013-01-01 to 2014-01-01
- License/attribution (metadata): Creative Commons 1.0 Universal (Public Domain Dedication) / Orleans Parish Communications District
- Cadence: Closed year, final refresh at year-end (2013)
- Location/address format: block_address / location (older years may differ in field names)
- Join keys: nopd_item
- Notes: 2013 calls for service, frozen archive. NOPD terms: block-level addresses only; do not derive specific addresses; no commercial use (see Terms of use)
- Fields: nopd_item:text, type_:text, typetext:text, priority:text, mapx:text, mapy:text, timecreate:calendar_date, timedispatch:calendar_date, timearrive:calendar_date, timeclosed:calendar_date, disposition:text, dispositiontext:text, block_address:text, zip:text, policedistrict:number, location:location
- Sample: `samples/socrata/5fn8-vtui.sample.json`, metadata: `samples/socrata/5fn8-vtui.meta.json`

### Calls for Service 2012 (`rv3g-ypg7`) [STALE]
- URL: https://data.nola.gov/resource/rv3g-ypg7.json (type: tabular/dataset; 16 columns)
- Rows: 505012; last data refresh (rowsUpdatedAt): 2015-11-02 17:35 UTC (4002 days ago); max :updated_at: 2018-02-15T18:43:13
- Date coverage: `timecreate` 2012-01-01 to 2012-12-31; `timedispatch` 2012-01-01 to 2013-01-01; `timearrive` 2012-01-01 to 2013-01-01; `timeclosed` 2012-01-01 to 2013-01-01
- License/attribution (metadata): Creative Commons 1.0 Universal (Public Domain Dedication) / Orleans Parish Communications District
- Cadence: Closed year, final refresh at year-end (2012)
- Location/address format: block_address / location (older years may differ in field names)
- Join keys: nopd_item
- Notes: 2012 calls for service, frozen archive. NOPD terms: block-level addresses only; do not derive specific addresses; no commercial use (see Terms of use)
- Fields: nopd_item:text, type:text, typetext:text, priority:text, mapx:text, mapy:text, timecreate:calendar_date, timedispatch:calendar_date, timearrive:calendar_date, timeclosed:calendar_date, disposition:text, dispositiontext:text, block_address:text, zip:text, policedistrict:number, location:location
- Sample: `samples/socrata/rv3g-ypg7.sample.json`, metadata: `samples/socrata/rv3g-ypg7.meta.json`

### Calls for Service 2011 (`28ec-c8d6`) [STALE]
- URL: https://data.nola.gov/resource/28ec-c8d6.json (type: tabular/dataset; 16 columns)
- Rows: 510153; last data refresh (rowsUpdatedAt): 2015-11-02 17:00 UTC (4002 days ago); max :updated_at: 2018-02-15T18:43:53
- Date coverage: `timecreate` 2011-01-01 to 2011-12-31; `timedispatch` 2011-01-01 to 2012-01-01; `timearrive` 2011-01-01 to 2012-01-01; `timeclosed` 2011-01-01 to 2012-01-01
- License/attribution (metadata): Creative Commons 1.0 Universal (Public Domain Dedication) / Orleans Parish Communications District
- Cadence: Closed year, final refresh at year-end (2011)
- Location/address format: block_address / location (older years may differ in field names)
- Join keys: nopd_item
- Notes: 2011 calls for service, frozen archive. NOPD terms: block-level addresses only; do not derive specific addresses; no commercial use (see Terms of use)
- Fields: nopd_item:text, type:text, typetext:text, priority:text, mapx:text, mapy:text, timecreate:calendar_date, timedispatch:calendar_date, timearrive:calendar_date, timeclosed:calendar_date, disposition:text, dispositiontext:text, block_address:text, zip:text, policedistrict:number, location:location
- Sample: `samples/socrata/28ec-c8d6.sample.json`, metadata: `samples/socrata/28ec-c8d6.meta.json`

### Calls for Service - Hurricane Francine 9/11/24 - 9/12/24 (`em4n-zidu`) [STALE]
- URL: https://data.nola.gov/resource/em4n-zidu.json (type: tabular/filter; 21 columns)
- Rows: 72; last data refresh (rowsUpdatedAt): 2025-01-01 09:00 UTC (654 days ago); max :updated_at: 2024-09-15T08:00:28
- Date coverage: `timecreate` 2024-09-11 to 2024-09-12; `timedispatch` 2024-09-11 to 2024-09-12; `timearrive` 2024-09-11 to 2024-09-12; `timeclosed` 2024-09-11 to 2024-09-12
- License/attribution (metadata): none set / Orleans Parish Communications District
- Cadence: Frozen
- Location/address format: same
- Join keys: nopd_item
- Notes: Francine event subset, 72 rows; subset of 2024. Ignore.
- Fields: nopd_item:text, type_:text, typetext:text, priority:text, initialtype:text, initialtypetext:text, initialpriority:text, mapx:text, mapy:text, timecreate:calendar_date, timedispatch:calendar_date, timearrive:calendar_date, timeclosed:calendar_date, disposition:text, dispositiontext:text, selfinitiated:text, beat:text, block_address:text, zip:text, policedistrict:number, location:point
- Sample: `samples/socrata/em4n-zidu.sample.json`, metadata: `samples/socrata/em4n-zidu.meta.json`

### Electronic Police Report 2025 (`agqi-9adb`) [STALE]
- URL: https://data.nola.gov/resource/agqi-9adb.json (type: tabular/dataset; 23 columns)
- Rows: 51195; last data refresh (rowsUpdatedAt): 2026-07-06 05:45 UTC (103 days ago); max :updated_at: 2026-07-06T05:45:36
- Date coverage: n/a (no date-typed columns, or text-typed timestamps)
- License/attribution (metadata): none set / Police Department (NOPD)
- Cadence: Appears monthly/irregular (2025 last refresh 2026-07-06; 2024 on 2026-06-30)
- Location/address format: location = text block address (no lat/lon)
- Join keys: item_number (NOPD item, same series as nopd_item in CFS)
- Notes: Electronic Police Reports (incident reports): one row per offender/victim/charge; 2024 has 690k rows for far fewer incidents. Includes victim demographics. Not in our stated domains but joins to CFS via item number. Out of scope, flag only.
- Fields: item_number:text, district:text, location:text, disposition:text, signal_type:text, signal_description:text, occurred_date_time:text, charge_code:text, charge_description:text, offender_number:text, offenderid:text, offenderstatus:text, offender_race:text, offender_gender:text, offender_age:text, victim_number:text, persontype:text, victim_race:text, victim_gender:text, victim_age:text, victim_fatal_status:text, hate_crime:text, report_type:text
- Sample: `samples/socrata/agqi-9adb.sample.json`, metadata: `samples/socrata/agqi-9adb.meta.json`

### Electronic Police Report 2024 (`c5iy-ew8n`) [STALE]
- URL: https://data.nola.gov/resource/c5iy-ew8n.json (type: tabular/dataset; 23 columns)
- Rows: 690329; last data refresh (rowsUpdatedAt): 2026-06-30 06:00 UTC (109 days ago); max :updated_at: 2026-06-30T06:00:03
- Date coverage: n/a (no date-typed columns, or text-typed timestamps)
- License/attribution (metadata): none set / Police Department (NOPD)
- Cadence: Monthly-ish
- Location/address format: text block address
- Join keys: item_number
- Notes: EPR 2024 (690k rows). Out of scope; see EPR 2025.
- Fields: item_number:text, district:text, location:text, disposition:text, signal_type:text, signal_description:text, occurred_date_time:text, charge_code:text, charge_description:text, offender_number:text, offenderid:text, offenderstatus:text, offender_race:text, offender_gender:text, offender_age:text, victim_number:text, persontype:text, victim_race:text, victim_gender:text, victim_age:text, victim_fatal_status:text, hate_crime:text, report_type:text
- Sample: `samples/socrata/c5iy-ew8n.sample.json`, metadata: `samples/socrata/c5iy-ew8n.meta.json`


## Short-term rentals and lodging

### Active Short-Term Rental Licenses (`ufdg-ajws`) [LIVE]
- URL: https://data.nola.gov/resource/ufdg-ajws.json (type: tabular/dataset; 21 columns)
- Rows: 4318; last data refresh (rowsUpdatedAt): 2026-10-17 04:45 UTC (0 days ago); max :updated_at: 2026-10-17T04:45:16
- Date coverage: `expiration_date` 2026-10-16 to 2027-10-29; `application_date` 2022-08-30 to 2026-10-16; `issue_date` 2023-07-05 to 2026-10-16
- License/attribution (metadata): none set / none
- Cadence: Nightly full replace (every row :updated_at = refresh time)
- Location/address format: address text, x/y, lat/lon, location point (100%)
- Join keys: license_number (e.g. 25-XSTR-45204), reference_code (OneStop deep-link code), address
- Notes: All active STR licenses including commercial, non-commercial, operator licenses and exempt lodging. Contains operator/license holder name, phone and email (PII). Active only: no history of lapsed licenses; use en36-xvxg for history.
- Fields: license_number:text, address:text, license_type:text, residential_subtype:text, expiration_date:calendar_date, bedroom_limit:number, guest_occupancy_limit:number, link:url, operator_name:text, operator_phone:text, operator_email:text, operator_license_number:text, license_holder_name:text, application_date:calendar_date, issue_date:calendar_date, reference_code:text, x:number, y:number, longitude:number, latitude:number, location:point
- Sample: `samples/socrata/ufdg-ajws.sample.json`, metadata: `samples/socrata/ufdg-ajws.meta.json`

### Non-Commercial Short-Term Rental Licenses (`2ei9-wqw2`) [LIVE]
- URL: https://data.nola.gov/resource/2ei9-wqw2.json (type: tabular/dataset; 25 columns)
- Rows: 1235; last data refresh (rowsUpdatedAt): 2026-10-17 04:45 UTC (0 days ago); max :updated_at: 2026-10-17T04:45:28
- Date coverage: `application_date` 2026-03-13 to 2026-09-22; `issue_date` 2026-04-22 to 2026-10-13; `expiration_date` 2027-03-04 to 2027-07-25; `current_status_date` 2026-04-22 to 2026-10-13
- License/attribution (metadata): none set / Department of Safety and Permits
- Cadence: Nightly full replace (every row :updated_at = refresh time)
- Location/address format: address, x/y, location point
- Join keys: license_number, licid, reference_code
- Notes: Non-commercial STR licenses (1,235; applications only since 2026-03, new regime). Owner and operator PII columns.
- Fields: licid:number, license_number:text, reference_code:text, address:text, type:text, application_date:calendar_date, issue_date:calendar_date, expiration_date:calendar_date, current_status:text, current_status_date:calendar_date, owner:text, owner_permit_documents:url, operator_permit:text, operator_permit_documents:url, type_of_building:text, bedrooms_rented:number, max_occupancy:number, partial_whole:text, operator:text, operator_type:text, operator_phone:text, operator_email:text, x:number, y:number, location:point
- Sample: `samples/socrata/2ei9-wqw2.sample.json`, metadata: `samples/socrata/2ei9-wqw2.meta.json`

### Short-Term Rental Permit Applications (`en36-xvxg`) [LIVE]
- URL: https://data.nola.gov/resource/en36-xvxg.json (type: tabular/dataset; 21 columns)
- Rows: 39027; last data refresh (rowsUpdatedAt): 2026-10-17 03:58 UTC (0 days ago); max :updated_at: 2026-10-17T04:08:26
- Date coverage: `expiration_date` 2012-12-31 to 2027-10-20; `application_date` 2017-03-13 to 2026-10-16; `issue_date` 2012-01-18 to 2026-10-16
- License/attribution (metadata): Creative Commons 1.0 Universal (Public Domain Dedication) / Department of Safety and Permits
- Cadence: Nightly full replace (every row :updated_at = refresh time)
- Location/address format: address text, x/y, location
- Join keys: license_number, reference_code, operator_permit_number
- Notes: All STR license applications back to 2017 (39,027), with status/expired flag. Best historical STR source. Contact name/phone/email columns (PII; do not publish).
- Fields: license_number:text, address:text, license_type:text, residential_subtype:text, current_status:text, expired:text, expiration_date:calendar_date, bedroom_limit:number, guest_occupancy_limit:number, link:text, contact_name:text, contact_phone:text, contact_email:text, operator_permit_number:text, license_holder_name:text, application_date:calendar_date, issue_date:calendar_date, reference_code:text, x:number, y:number, location:location
- Sample: `samples/socrata/en36-xvxg.sample.json`, metadata: `samples/socrata/en36-xvxg.meta.json`

### Vacation Rentals (Hotels, B&B, short-term rentals, etc.) (`rbhq-zbz9`) [STALE]
- URL: https://data.nola.gov/resource/rbhq-zbz9.json (type: tabular/dataset; 9 columns)
- Rows: 1393; last data refresh (rowsUpdatedAt): 2025-01-04 08:10 UTC (651 days ago); max :updated_at: 2025-01-04T08:10:20
- Date coverage: `expiration_date` 2025-02-15 to 2026-01-02
- License/attribution (metadata): none set / City of New Orleans – Bureau of Revenue, Safety & Permits
- Cadence: STALE (2025-01-04)
- Location/address format: see fields
- Join keys: n/a
- Notes: Older vacation rental list (hotels/B&B/STR), 1,393 rows; superseded by ufdg-ajws.
- Fields: name:text, address:text, type:text, bedroom_limit:text, guest_limit:text, expiration_date:calendar_date, location:location, x:number, y:number
- Sample: `samples/socrata/rbhq-zbz9.sample.json`, metadata: `samples/socrata/rbhq-zbz9.meta.json`

### Hotels Motels BBs (`ns2v-hzec`) [STALE]
- URL: https://data.nola.gov/resource/ns2v-hzec.json (type: tabular/dataset; 12 columns)
- Rows: 391; last data refresh (rowsUpdatedAt): 2024-07-16 21:43 UTC (823 days ago); max :updated_at: 2024-07-16T21:43:02
- Date coverage: n/a (no date-typed columns, or text-typed timestamps)
- License/attribution (metadata): Creative Commons 1.0 Universal (Public Domain Dedication) / Bureau of Revenue
- Cadence: STALE (2024-07)
- Location/address format: see fields
- Join keys: n/a
- Notes: Hotels/motels/BBs list, 391 rows.
- Fields: the_geom:point, objectid:number, businessaddress:text, businessname:text, businessstartdate:text, businesstype:text, city:text, locationx:text, locationy:text, state:text, suite:text, zip:text
- Sample: `samples/socrata/ns2v-hzec.sample.json`, metadata: `samples/socrata/ns2v-hzec.meta.json`


## Business licenses

### Active Occupational Licenses (`iqay-p646`) [LIVE]
- URL: https://data.nola.gov/resource/iqay-p646.json (type: tabular/dataset; 18 columns)
- Rows: 16655; last data refresh (rowsUpdatedAt): 2026-10-17 04:30 UTC (0 days ago); max :updated_at: 2026-10-17T04:30:08
- Date coverage: n/a (no date-typed columns, or text-typed timestamps)
- License/attribution (metadata): Creative Commons 1.0 Universal (Public Domain Dedication) / none
- Cadence: Nightly
- Location/address format: address components + locationx/locationy + the_geom point
- Join keys: businesslicensenumber
- Notes: Active occupational licenses only (16,655); no history. businessstartdate text type.
- Fields: businessaddress:text, businessname:text, businessphone:text, businessstartdate:text, businesstype:text, businesslicensenumber:text, city:text, ownername:text, state:text, streetdirection:text, streetname:text, streetnumber:text, streetsuffix:text, suite:text, zip:text, locationx:text, locationy:text, the_geom:point
- Sample: `samples/socrata/iqay-p646.sample.json`, metadata: `samples/socrata/iqay-p646.meta.json`

### Occupational Business Licenses (`hjcd-grvu`) [LIVE]
- URL: https://data.nola.gov/resource/hjcd-grvu.json (type: tabular/dataset; 23 columns)
- Rows: 38077; last data refresh (rowsUpdatedAt): 2026-10-17 04:20 UTC (0 days ago); max :updated_at: 2026-10-17T04:22:28
- Date coverage: `businessstartdate` 1900-01-02 to 2027-02-27
- License/attribution (metadata): none set / City of New Orleans – Bureau of Revenue
- Cadence: Daily (per metadata)
- Location/address format: address components, lat/lon (0.0 for 24% = ungeocoded, many out-of-town addresses)
- Join keys: businesslicensenumber
- Notes: Occupational licenses of record (38,077) incl. owner name, mailing address, phone (PII). businessstartdate ranges 1900 to 2027 (garbage at the edges). Includes non-New-Orleans addresses (e.g., Madisonville).
- Fields: businessname:text, ownername:text, businesstype:text, businesslicensenumber:text, businessstartdate:calendar_date, address:text, streetnumber:text, streetdirection:text, streetname:text, streetsuffix:text, suite:text, city:text, state:text, zip:text, phonenumber:text, mailaddress:text, mailsuite:text, mailcity:text, mailstate:text, mailzip:text, latitude:number, longitude:number, location:location
- Sample: `samples/socrata/hjcd-grvu.sample.json`, metadata: `samples/socrata/hjcd-grvu.meta.json`

### Occupational Business License Data for the Office of Business and External Services (`abc4-h3u3`) [LIVE]
- URL: https://data.nola.gov/resource/abc4-h3u3.json (type: tabular/dataset; 44 columns)
- Rows: 21115; last data refresh (rowsUpdatedAt): 2026-10-17 04:50 UTC (0 days ago); max :updated_at: 2026-10-17T04:50:49
- Date coverage: `currentstatusdate` 1964-12-21 to 2026-12-31; `d_create` 2018-01-01 to 2026-10-16; `lastcomment` 2018-01-10 to 2026-10-16; `application_filed` 2018-01-01 to 2026-10-16; `application_review` 2018-01-03 to 2026-10-16; `approved` 2018-01-03 to 2026-10-16; `zoning_application_review` 2018-01-03 to 2026-10-16; `firstcomment` 2018-01-10 to 2026-10-16; `issuedate` 2018-01-03 to 2026-10-16; `first_inspection` 2018-01-03 to 2026-10-14
- License/attribution (metadata): none set / City of New Orleans Code Enforcement
- Cadence: Nightly full replace (every row :updated_at = refresh time)
- Location/address format: address + x/y + lat/lon + location point
- Join keys: numstring (license app number), licid, address
- Notes: Business license application workflow (21,115 rows, since 2018) with review timestamps, NAICS. Pair with hjcd-grvu for issued license data.
- Fields: isclosed:checkbox, isdeleted:checkbox, licid:text, numstring:text, address:text, descr:text, submittaltype:number, class:text, type:text, exitcode:number, reason:text, occnum:text, ishome:text, businesstype:text, status:text, category:text, naics:text, commentcount:number, currentstatus:text, sumfee:number, journalcount:number, currentstatusdate:calendar_date, d_create:calendar_date, lastcomment:calendar_date, application_filed:calendar_date, application_review:calendar_date, approved:calendar_date, plan_review:calendar_date, zoning_application_review:calendar_date, firstcomment:calendar_date, issuedate:calendar_date, first_inspection:calendar_date, days_to_application_review:number, days_to_approved:number, days_to_plan_review:number, days_to_zoning_review:number, days_to_comment:number, days_to_issue_date:number, days_to_first_inspection:number, x:number, y:number, longitude:number, latitude:number, location:point
- Sample: `samples/socrata/abc4-h3u3.sample.json`, metadata: `samples/socrata/abc4-h3u3.meta.json`

### Historical Occupational Business Licenses 2012 (`c77v-v89q`) [STALE]
- URL: https://data.nola.gov/resource/c77v-v89q.json (type: tabular/dataset; 23 columns)
- Rows: 12869; last data refresh (rowsUpdatedAt): 2018-03-22 16:37 UTC (3131 days ago); max :updated_at: 2018-03-22T16:38:16
- Date coverage: `businessstartdate` 1900-01-02 to 2017-10-25; `businessclosedate` 2012-01-01 to 2018-12-31
- License/attribution (metadata): none set / City of New Orleans – Bureau of Revenue
- Cadence: Frozen 2018
- Location/address format: address components
- Join keys: businesslicensenumber
- Notes: Annual historical occupational license list (one dataset per year 2012-2017, 12-14k rows each). One-time backfill only.
- Fields: businessname:text, ownername:text, businesstype:text, businessstartdate:calendar_date, businessclosedate:calendar_date, address:text, streetnumber:text, streetdirection:text, streetname:text, streetsuffix:text, suite:text, city:text, state:text, zip:text, phonenumber:text, mailaddress:text, mailsuite:text, mailcity:text, mailstate:text, mailzip:text, latitude:number, longitude:number, location:text
- Sample: `samples/socrata/c77v-v89q.sample.json`, metadata: `samples/socrata/c77v-v89q.meta.json`

### Historical Occupational Business Licenses 2013 (`tc3j-b7gd`) [STALE]
- URL: https://data.nola.gov/resource/tc3j-b7gd.json (type: tabular/dataset; 23 columns)
- Rows: 12892; last data refresh (rowsUpdatedAt): 2018-03-22 16:21 UTC (3131 days ago); max :updated_at: 2018-03-22T16:24:39
- Date coverage: `businessstartdate` 1900-01-02 to 2017-10-25; `businessclosedate` 2013-01-01 to 2018-12-31
- License/attribution (metadata): none set / City of New Orleans – Bureau of Revenue
- Cadence: Frozen 2018
- Location/address format: address components
- Join keys: businesslicensenumber
- Notes: Annual historical occupational license list (one dataset per year 2012-2017, 12-14k rows each). One-time backfill only.
- Fields: businessname:text, ownername:text, businesstype:text, businessstartdate:calendar_date, businessclosedate:calendar_date, address:text, streetnumber:text, streetdirection:text, streetname:text, streetsuffix:text, suite:text, city:text, state:text, zip:text, phonenumber:text, mailaddress:text, mailsuite:text, mailcity:text, mailstate:text, mailzip:text, latitude:number, longitude:number, location:text
- Sample: `samples/socrata/tc3j-b7gd.sample.json`, metadata: `samples/socrata/tc3j-b7gd.meta.json`

### Historical Occupational Business Licenses 2014 (`xw7z-p5m2`) [STALE]
- URL: https://data.nola.gov/resource/xw7z-p5m2.json (type: tabular/dataset; 23 columns)
- Rows: 13553; last data refresh (rowsUpdatedAt): 2018-02-07 18:07 UTC (3174 days ago); max :updated_at: 2018-02-07T19:49:10
- Date coverage: `businessstartdate` 1900-01-02 to 2017-06-26; `businessclosedate` 2014-01-01 to 2018-12-31
- License/attribution (metadata): none set / City of New Orleans - Bureau of Revenue
- Cadence: Frozen 2018
- Location/address format: address components
- Join keys: businesslicensenumber
- Notes: Annual historical occupational license list (one dataset per year 2012-2017, 12-14k rows each). One-time backfill only.
- Fields: businessname:text, ownername:text, businesstype:text, businessstartdate:calendar_date, businessclosedate:calendar_date, address:text, streetnumber:text, streetdirection:text, streetname:text, streetsuffix:text, suite:text, city:text, state:text, zip:text, phonenumber:text, mailaddress:text, mailsuite:text, mailcity:text, mailstate:text, mailzip:text, latitude:number, longitude:number, location:text
- Sample: `samples/socrata/xw7z-p5m2.sample.json`, metadata: `samples/socrata/xw7z-p5m2.meta.json`

### Historical Occupational Business Licenses 2015 (`yc4x-fza2`) [STALE]
- URL: https://data.nola.gov/resource/yc4x-fza2.json (type: tabular/dataset; 23 columns)
- Rows: 13860; last data refresh (rowsUpdatedAt): 2018-02-07 19:54 UTC (3174 days ago); max :updated_at: 2018-02-07T19:57:50
- Date coverage: `businessstartdate` 1900-01-02 to 2017-07-01; `businessclosedate` 2015-01-01 to 2018-12-31
- License/attribution (metadata): none set / City of New Orleans - Bureau of Revenue
- Cadence: Frozen 2018
- Location/address format: address components
- Join keys: businesslicensenumber
- Notes: Annual historical occupational license list (one dataset per year 2012-2017, 12-14k rows each). One-time backfill only.
- Fields: businessname:text, ownername:text, businesstype:text, businessstartdate:calendar_date, businessclosedate:calendar_date, address:text, streetnumber:text, streetdirection:text, streetname:text, streetsuffix:text, suite:text, city:text, state:text, zip:text, phonenumber:text, mailaddress:text, mailsuite:text, mailcity:text, mailstate:text, mailzip:text, latitude:number, longitude:number, location:text
- Sample: `samples/socrata/yc4x-fza2.sample.json`, metadata: `samples/socrata/yc4x-fza2.meta.json`

### Historical Occupational Business Licenses 2016 (`xy7w-r8a6`) [STALE]
- URL: https://data.nola.gov/resource/xy7w-r8a6.json (type: tabular/dataset; 23 columns)
- Rows: 14011; last data refresh (rowsUpdatedAt): 2018-02-07 20:05 UTC (3174 days ago); max :updated_at: 2018-02-07T20:08:21
- Date coverage: `businessstartdate` 1900-01-02 to 2017-10-16; `businessclosedate` 2016-01-01 to 2018-12-31
- License/attribution (metadata): none set / City of New Orleans - Bureau of Revenue
- Cadence: Frozen 2018
- Location/address format: address components
- Join keys: businesslicensenumber
- Notes: Annual historical occupational license list (one dataset per year 2012-2017, 12-14k rows each). One-time backfill only.
- Fields: businessname:text, ownername:text, businesstype:text, businessstartdate:calendar_date, businessclosedate:calendar_date, address:text, streetnumber:text, streetdirection:text, streetname:text, streetsuffix:text, suite:text, city:text, state:text, zip:text, phonenumber:text, mailaddress:text, mailsuite:text, mailcity:text, mailstate:text, mailzip:text, latitude:number, longitude:number, location:text
- Sample: `samples/socrata/xy7w-r8a6.sample.json`, metadata: `samples/socrata/xy7w-r8a6.meta.json`

### Historical Occupational Business Licenses 2017 (`sbc5-uppx`) [STALE]
- URL: https://data.nola.gov/resource/sbc5-uppx.json (type: tabular/dataset; 23 columns)
- Rows: 13669; last data refresh (rowsUpdatedAt): 2018-02-07 20:20 UTC (3174 days ago); max :updated_at: 2018-02-07T20:24:59
- Date coverage: `businessstartdate` 0017-08-24 to 2018-02-02; `businessclosedate` 2017-01-01 to 2018-12-31
- License/attribution (metadata): none set / City of New Orleans - Bureau of Revenue
- Cadence: Frozen 2018
- Location/address format: address components
- Join keys: businesslicensenumber
- Notes: Annual historical occupational license list (one dataset per year 2012-2017, 12-14k rows each). One-time backfill only.
- Fields: businessname:text, ownername:text, businesstype:text, businessstartdate:calendar_date, businessclosedate:calendar_date, address:text, streetnumber:text, streetdirection:text, streetname:text, streetsuffix:text, suite:text, city:text, state:text, zip:text, phonenumber:text, mailaddress:text, mailsuite:text, mailcity:text, mailstate:text, mailzip:text, latitude:number, longitude:number, location:text
- Sample: `samples/socrata/sbc5-uppx.sample.json`, metadata: `samples/socrata/sbc5-uppx.meta.json`


## Parcels, addresses, property, sales

### Parcels (`v9q5-fz7t`) [LIVE]
- URL: https://data.nola.gov/resource/v9q5-fz7t.json (type: tabular/dataset; 11 columns)
- Rows: 151255; last data refresh (rowsUpdatedAt): 2026-10-15 08:35 UTC (2 days ago); max :updated_at: 2026-10-15T08:35:39
- Date coverage: n/a (no date-typed columns, or text-typed timestamps)
- License/attribution (metadata): none set / none
- Cadence: Weekly-ish GIS refresh (2026-10-15)
- Location/address format: MultiPolygon geometry; situs_number/street/type/dir (no city/zip)
- Join keys: geopin (8-digit numeric, e.g. 41027259), situs_*
- Notes: THE parcel layer: 151,255 rows, geometry + situs address only. No owner, assessed value, land use, zoning or sale data. Other parcels table m5br-772y (Lots, 190,009 rows) has lot/square only, no GEOPIN. Assessor data is not on Socrata; it must come from Orleans Parish Assessor / Land Records elsewhere.
- Fields: the_geom:multipolygon, objectid:number, perimeter:number, acres:number, situs_dir:text, situs_street:text, situs_type:text, situs_number:number, geopin:number, shape_area:number, shape_length:number
- Sample: `samples/socrata/v9q5-fz7t.sample.json`, metadata: `samples/socrata/v9q5-fz7t.meta.json`

### Parcels To Join (`pzqp-4ri7`) [LIVE]
- URL: https://data.nola.gov/resource/pzqp-4ri7.json (type: tabular/dataset; 4 columns)
- Rows: 162773; last data refresh (rowsUpdatedAt): 2026-09-25 11:15 UTC (22 days ago); max :updated_at: 2026-09-25T11:15:43
- Date coverage: n/a (no date-typed columns, or text-typed timestamps)
- License/attribution (metadata): none set / eGIS team
- Cadence: Updated 2026-09-25
- Location/address format: geopin + parid
- Join keys: geopin, parid (address-like string e.g. 1718-GENOGDENST)
- Notes: "Parcels To Join": 162,773 rows geopin to parid text. parid is an address-based string, not the assessor PIN used in permits (pin e.g. 513840022). No direct crosswalk to permit pin found yet.
- Fields: the_geom:multipolygon, objectid:number, geopin:number, parid:text
- Sample: `samples/socrata/pzqp-4ri7.sample.json`, metadata: `samples/socrata/pzqp-4ri7.meta.json`

### Lots (`m5br-772y`) [LIVE]
- URL: https://data.nola.gov/resource/m5br-772y.json (type: tabular/dataset; 6 columns)
- Rows: 190009; last data refresh (rowsUpdatedAt): 2026-10-15 08:50 UTC (2 days ago); max :updated_at: 2026-10-15T08:50:03
- Date coverage: n/a (no date-typed columns, or text-typed timestamps)
- License/attribution (metadata): none set / none
- Cadence: Updated 2026-10-15
- Location/address format: MultiPolygon
- Join keys: lot + square (text)
- Notes: Legal lots (square/lot) polygons, 190,009; no GEOPIN. Match to parcels spatially.
- Fields: the_geom:multipolygon, objectid:number, lot:text, square:text, shape_area:number, shape_length:number
- Sample: `samples/socrata/m5br-772y.sample.json`, metadata: `samples/socrata/m5br-772y.meta.json`

### Site Address Point (`hfvu-md72`) [LIVE]
- URL: https://data.nola.gov/resource/hfvu-md72.json (type: tabular/dataset; 23 columns)
- Rows: 268595; last data refresh (rowsUpdatedAt): 2026-08-25 19:13 UTC (53 days ago); max :updated_at: 2026-08-25T19:13:21
- Date coverage: `lastupdate` 2016-03-11 to 2026-01-06; `last_edited_date` 2016-09-26 to 2026-08-25
- License/attribution (metadata): Creative Commons 1.0 Universal (Public Domain Dedication) / none
- Cadence: Weekly (metadata)
- Location/address format: Point geometry, fulladdr "721 Robert Street", addrnum, fullname (street full name), pointtype; lat/long fields here are STATE PLANE not degrees
- Join keys: siteaddid, fulladdr (no GEOPIN column)
- Notes: Master Site Address Points (268,595; city-maintained by Safety and Permits). Best geocoder seed for >=98% address match: join normalized address to point, then point-in-polygon to parcels for GEOPIN. Includes unit ids. Pair with fdkj-rjrv Street Name table for abbreviations.
- Fields: the_geom:point, objectid:number, siteaddid:text, preaddrnum:text, addrnumsuf:text, addrnum:text, unittype:text, unitid:text, fullname:text, fulladdr:text, placename:text, pointtype:text, capturemeth:text, status:text, lastupdate:date, lasteditor:text, source:text, lat:number, long:number, addr_type:text, last_edited_user:text, last_edited_date:date, joinid:number
- Sample: `samples/socrata/hfvu-md72.sample.json`, metadata: `samples/socrata/hfvu-md72.meta.json`

### Tabular Address Points (`cym7-cw5z`) [STALE]
- URL: https://data.nola.gov/resource/cym7-cw5z.json (type: tabular/dataset; 4 columns)
- Rows: 225956; last data refresh (rowsUpdatedAt): 2018-07-02 21:28 UTC (3029 days ago); max :updated_at: 2018-07-02T21:35:57
- Date coverage: n/a (no date-typed columns, or text-typed timestamps)
- License/attribution (metadata): Public Domain U.S. Government / City of New Orleans Land Records database
- Cadence: Frozen 2018
- Location/address format: address table
- Join keys: address
- Notes: Older tabular address points (225,956). Superseded by hfvu-md72.
- Fields: address:text, zoningclassification:text, zoningdescription:text, geopin:number
- Sample: `samples/socrata/cym7-cw5z.sample.json`, metadata: `samples/socrata/cym7-cw5z.meta.json`

### Building Footprint (`prh5-qsuf`) [LIVE]
- URL: https://data.nola.gov/resource/prh5-qsuf.json (type: tabular/dataset; 8 columns)
- Rows: 162486; last data refresh (rowsUpdatedAt): 2026-08-08 20:17 UTC (70 days ago); max :updated_at: 2026-08-08T20:17:58
- Date coverage: n/a (no date-typed columns, or text-typed timestamps)
- License/attribution (metadata): Public Domain U.S. Government / eGIS Team
- Cadence: Updated 2026-08-08
- Location/address format: MultiPolygon
- Join keys: geopin, structureid
- Notes: Building footprints, 162,486.
- Fields: the_geom:multipolygon, objectid:number, geopin:number, activestatus:number, shape_starea:number, shape_stlength:number, structureid:number, globalid:text
- Sample: `samples/socrata/prh5-qsuf.sample.json`, metadata: `samples/socrata/prh5-qsuf.meta.json`

### NORA Sold Properties (`hpm5-48nj`) [LIVE]
- URL: https://data.nola.gov/resource/hpm5-48nj.json (type: tabular/dataset; 8 columns)
- Rows: 5618; last data refresh (rowsUpdatedAt): 2026-08-11 21:34 UTC (67 days ago); max :updated_at: 2026-08-11T21:34:46
- Date coverage: `sale_date` 1980-03-03 to 2026-07-22
- License/attribution (metadata): Creative Commons 1.0 Universal (Public Domain Dedication) / New Orleans Redevelopment Authority (NORA)
- Cadence: Periodic (2026-08-11)
- Location/address format: address, geopin (100%), lat/lon
- Join keys: geopin, identifier
- Notes: NORA sold properties 1980-2026 (5,618). Only property-sales-like dataset on the portal; covers only NORA dispositions, not market sales.
- Fields: identifier:text, property_address:text, zip_code:text, geopin:text, council_district:text, disposition_channel:text, sale_date:calendar_date, geocoded_column:location
- Sample: `samples/socrata/hpm5-48nj.sample.json`, metadata: `samples/socrata/hpm5-48nj.meta.json`

### NORA Uncommitted Property Inventory (`5ktx-e9wc`) [LIVE]
- URL: https://data.nola.gov/resource/5ktx-e9wc.json (type: tabular/dataset; 11 columns)
- Rows: 189; last data refresh (rowsUpdatedAt): 2026-10-09 15:48 UTC (8 days ago); max :updated_at: 2026-10-09T15:48:52
- Date coverage: n/a (no date-typed columns, or text-typed timestamps)
- License/attribution (metadata): Creative Commons 1.0 Universal (Public Domain Dedication) / New Orleans Redevelopment Authority (NORA)
- Cadence: Periodic
- Location/address format: address, geopin_2
- Join keys: geopin_2
- Notes: NORA inventory (189).
- Fields: identifier:text, property_address:text, address_number:text, street_name:text, zip_code:text, city_planning_neighborhood:text, council_district:text, geopin_2:text, property_type:text, zoning:text, square_footage:number
- Sample: `samples/socrata/5ktx-e9wc.sample.json`, metadata: `samples/socrata/5ktx-e9wc.meta.json`

### Sheriff Sales - Lien Foreclosures (`d52w-8nva`) [STALE]
- URL: https://data.nola.gov/resource/d52w-8nva.json (type: tabular/dataset; 9 columns)
- Rows: 1771; last data refresh (rowsUpdatedAt): 2018-11-16 04:45 UTC (2892 days ago); max :updated_at: 2018-11-16T05:50:09
- Date coverage: `closeddate` 1900-01-01 to 2018-11-07
- License/attribution (metadata): none set / Sheriff's Office
- Cadence: STALE (2018-11)
- Location/address format: see fields
- Join keys: n/a
- Notes: Sheriff sales lien foreclosures to 2018-11 (1,771 rows). Frozen.
- Fields: casetitle:text, cdccasenumber:text, closeddate:calendar_date, defendant:text, plaintiff:text, propertyaddress:text, saleamount:number, saledate:text, salestatus:text
- Sample: `samples/socrata/d52w-8nva.sample.json`, metadata: `samples/socrata/d52w-8nva.meta.json`

### Assessment Areas (`9a4m-i64z`) [STALE]
- URL: https://data.nola.gov/resource/9a4m-i64z.json (type: tabular/dataset; 6 columns)
- Rows: 18; last data refresh (rowsUpdatedAt): 2025-08-18 09:03 UTC (425 days ago); max :updated_at: 2023-06-13T16:49:33
- Date coverage: n/a (no date-typed columns, or text-typed timestamps)
- License/attribution (metadata): Creative Commons 1.0 Universal (Public Domain Dedication) / none
- Cadence: Static
- Location/address format: polygons
- Join keys: n/a
- Notes: 18 assessment areas. Not assessor roll data.
- Fields: the_geom:multipolygon, objectid:number, ward:text, ward_abbre:text, shape_area:number, shape_len:number
- Sample: `samples/socrata/9a4m-i64z.sample.json`, metadata: `samples/socrata/9a4m-i64z.meta.json`

### Public Land (`bsqt-btyi`) [STALE]
- URL: https://data.nola.gov/resource/bsqt-btyi.json (type: tabular/dataset; 16 columns)
- Rows: 2149; last data refresh (rowsUpdatedAt): 2025-11-10 00:33 UTC (341 days ago); max :updated_at: 2025-11-10T00:33:38
- Date coverage: n/a (no date-typed columns, or text-typed timestamps)
- License/attribution (metadata): none set / none
- Cadence: 2025-11
- Location/address format: polygons
- Join keys: n/a
- Notes: Public land parcels, 2,149.
- Fields: the_geom:multipolygon, objectid:number, site_name:text, secondary_name:text, managing_department:text, type:text, notes:text, site_address:text, owned_by:text, used_by:text, leased_by:text, council_district:text, geopin:text, acerage:number, shape_starea:number, shape_stlength:number
- Sample: `samples/socrata/bsqt-btyi.sample.json`, metadata: `samples/socrata/bsqt-btyi.meta.json`

### Post-Katrina Damage Assessment (`aned-jbk9`) [STALE]
- URL: https://data.nola.gov/resource/aned-jbk9.json (type: tabular/dataset; 59 columns)
- Rows: 165564; last data refresh (rowsUpdatedAt): 2013-04-03 17:56 UTC (4945 days ago); max :updated_at: 2015-03-21T04:45:08
- Date coverage: n/a (no date-typed columns, or text-typed timestamps)
- License/attribution (metadata): Creative Commons 1.0 Universal (Public Domain Dedication) / City of New Orleans – Office of Information Technology & Innovation, Enterprise Information Team
- Cadence: Frozen 2013
- Location/address format: points
- Join keys: n/a
- Notes: Post-Katrina damage assessment 165k points. Historical.
- Fields: address:text, percentage:number, foundations_basements:number, superstructure_framing_masonry:number, roofing:number, insulationandweatherstripping:number, exteriorfinish:number, interiorfinish_plaster_drywall:number, doors_windows_shutters:number, lumberfinished:number, hardware:number, cabinets_countertops:number, floor_covering:number, plumbing:number, electrical:number, builtin_appliances:number, heating_cooling:number, painting:number, foundations_basements_damageper:number, superstructure_framing_masonry_damageper:number, roofing_damageper:number, insulationandweatherstripping_damageper:number, exteriorfinish_damageper:number, interiorfinish_plaster_drywall_damageper:number, doors_windows_shutters_damageper:number, lumberfinished_damageper:number, hardware_damageper:number, cabinets_countertops_damageper:number, floor_covering_damageper:number, plumbing_damageper:number, electrical_damageper:number, builtin_appliances_damageper:number, heating_cooling_damageper:number, painting_damageper:number, flooddepth:number, floodduration:number, floodzone:text, propertydescription:text, owner:text, taxbill:text, add1:text, add2:text, add3:text, add4:text, add5:text, add6:text, add7:text, add8:text, add9:text, add10:text, add11:text, add12:text, add13:text, add14:text, add15:text, add16:text, add17:text, add18:text, add19:text
- Sample: `samples/socrata/aned-jbk9.sample.json`, metadata: `samples/socrata/aned-jbk9.meta.json`


## Zoning, planning, historic

### Zoning Districts (`bizp-xi7c`) [LIVE]
- URL: https://data.nola.gov/resource/bizp-xi7c.json (type: tabular/dataset; 14 columns)
- Rows: 1494; last data refresh (rowsUpdatedAt): 2026-08-08 20:11 UTC (70 days ago); max :updated_at: 2026-08-08T20:11:01
- Date coverage: n/a (no date-typed columns, or text-typed timestamps)
- License/attribution (metadata): Creative Commons 1.0 Universal (Public Domain Dedication) / City Planning Commission
- Cadence: GIS refresh (2026)
- Location/address format: polygons
- Join keys: spatial only
- Notes: Zoning districts polygons (1,494); join spatially to parcels
- Fields: the_geom:multipolygon, objectid:number, zoneclass:text, zonedesc:text, zonenum:text, zoneyear:text, ordnum:text, zoneclass1:text, zonenum1:text, zoneyear1:number, ordnum1:text, hyperlink:text, shape_starea:number, shape_stlength:number
- Sample: `samples/socrata/bizp-xi7c.sample.json`, metadata: `samples/socrata/bizp-xi7c.meta.json`

### Overlay and Interim Zoning (`kb74-hpue`) [LIVE]
- URL: https://data.nola.gov/resource/kb74-hpue.json (type: tabular/dataset; 9 columns)
- Rows: 202; last data refresh (rowsUpdatedAt): 2026-08-08 20:10 UTC (70 days ago); max :updated_at: 2026-08-08T20:10:56
- Date coverage: n/a (no date-typed columns, or text-typed timestamps)
- License/attribution (metadata): Creative Commons 1.0 Universal (Public Domain Dedication) / City Planning Commission
- Cadence: GIS refresh (2026)
- Location/address format: polygons
- Join keys: spatial only
- Notes: Overlay and interim zoning polygons
- Fields: the_geom:multipolygon, objectid:number, name:text, docket:text, ordinance:text, description:text, weblink:text, shape_starea:number, shape_stlength:number
- Sample: `samples/socrata/kb74-hpue.sample.json`, metadata: `samples/socrata/kb74-hpue.meta.json`

### Conditional Use (`ecst-qwxv`) [LIVE]
- URL: https://data.nola.gov/resource/ecst-qwxv.json (type: tabular/dataset; 10 columns)
- Rows: 1450; last data refresh (rowsUpdatedAt): 2026-08-08 20:10 UTC (70 days ago); max :updated_at: 2026-08-08T20:10:55
- Date coverage: n/a (no date-typed columns, or text-typed timestamps)
- License/attribution (metadata): Creative Commons 1.0 Universal (Public Domain Dedication) / City Planning Commission
- Cadence: GIS refresh (2026)
- Location/address format: polygons
- Join keys: spatial only
- Notes: Conditional use areas
- Fields: the_geom:multipolygon, objectid:number, zoneclass:text, recnum:text, zonenum:text, zoneyear:text, ordnum:text, hyperlink:text, shape_starea:number, shape_stlength:number
- Sample: `samples/socrata/ecst-qwxv.sample.json`, metadata: `samples/socrata/ecst-qwxv.meta.json`

### CPC Projects (`xxb5-5azv`) [LIVE]
- URL: https://data.nola.gov/resource/xxb5-5azv.json (type: tabular/dataset; 18 columns)
- Rows: 15611; last data refresh (rowsUpdatedAt): 2026-10-17 05:01 UTC (0 days ago); max :updated_at: 2026-10-17T05:01:51
- Date coverage: `filing_date` 2003-12-08 to 2026-10-15; `previous_meeting_date` 2003-04-11 to 2026-10-13; `next_meeting_date` 2018-04-24 to 2026-12-14
- License/attribution (metadata): none set / none
- Cadence: Nightly full replace (every row :updated_at = refresh time)
- Location/address format: address + x/y + lat/lon
- Join keys: case_num, address
- Notes: City Planning Commission cases/projects (zoning changes, conditional uses, subdivisions) filing 2003-2026, 15,611 rows. Good for development pipeline.
- Fields: case_type:text, case_num:text, address:text, filing_date:calendar_date, current_status:text, open_closed:text, previous_meeting:text, previous_meeting_date:calendar_date, previous_meeting_status:text, next_meeting:text, next_meeting_date:calendar_date, lead_staff:text, description:text, x:number, y:number, longitude:number, latitude:number, location:point
- Sample: `samples/socrata/xxb5-5azv.sample.json`, metadata: `samples/socrata/xxb5-5azv.meta.json`

### Local Historic District (`hea7-kccz`) [STALE]
- URL: https://data.nola.gov/resource/hea7-kccz.json (type: tabular/dataset; 3 columns)
- Rows: 22; last data refresh (rowsUpdatedAt): 2026-07-09 14:33 UTC (100 days ago); max :updated_at: 2026-07-09T14:33:48
- Date coverage: n/a (no date-typed columns, or text-typed timestamps)
- License/attribution (metadata): none set / none
- Cadence: GIS refresh (2026)
- Location/address format: polygons
- Join keys: spatial only
- Notes: Local historic district polygons (22)
- Fields: the_geom:multipolygon, objectid:number, name:text
- Sample: `samples/socrata/hea7-kccz.sample.json`, metadata: `samples/socrata/hea7-kccz.meta.json`

### HDLC Landmarks (`25e8-s5xx`) [LIVE]
- URL: https://data.nola.gov/resource/25e8-s5xx.json (type: tabular/dataset; 10 columns)
- Rows: 342; last data refresh (rowsUpdatedAt): 2026-10-07 11:57 UTC (10 days ago); max :updated_at: 2026-10-07T11:57:32
- Date coverage: `editdate` 2020-10-20 to 2026-10-06
- License/attribution (metadata): Creative Commons 1.0 Universal (Public Domain Dedication) / HDLC
- Cadence: 2026-10-07
- Location/address format: points
- Join keys: address?
- Notes: HDLC landmarks (342).
- Fields: the_geom:point, objectid:number, addr:text, name:text, architect:text, nom_des:text, no_cbd:text, date:text, hyperlink:text, editdate:date
- Sample: `samples/socrata/25e8-s5xx.sample.json`, metadata: `samples/socrata/25e8-s5xx.meta.json`

### Mandatory Inclusionary Zoning (`jcvy-gbgr`) [STALE]
- URL: https://data.nola.gov/resource/jcvy-gbgr.json (type: tabular/dataset; 9 columns)
- Rows: 3; last data refresh (rowsUpdatedAt): 2026-06-06 06:30 UTC (133 days ago); max :updated_at: 2026-06-06T06:30:30
- Date coverage: n/a (no date-typed columns, or text-typed timestamps)
- License/attribution (metadata): Creative Commons 1.0 Universal (Public Domain Dedication) / City Planning Commission
- Cadence: GIS refresh (2026)
- Location/address format: polygons
- Join keys: spatial only
- Notes: Mandatory inclusionary zoning (3)
- Fields: the_geom:multipolygon, objectid:number, name:text, docket:text, ordinance:text, description:text, weblink:text, shape_starea:number, shape_stlength:number
- Sample: `samples/socrata/jcvy-gbgr.sample.json`, metadata: `samples/socrata/jcvy-gbgr.meta.json`


## Infrastructure (SWB and DPW)

### RoadWork SWB Projects (`bsnu-de3a`) [LIVE]
- URL: https://data.nola.gov/resource/bsnu-de3a.json (type: tabular/dataset; 5 columns)
- Rows: 8416; last data refresh (rowsUpdatedAt): 2026-10-17 03:26 UTC (0 days ago); max :updated_at: 2026-10-17T03:28:45
- Date coverage: n/a (no date-typed columns, or text-typed timestamps)
- License/attribution (metadata): none set / none
- Cadence: Nightly full replace (every row :updated_at = refresh time)
- Location/address format: geometry (road work)
- Join keys: project id
- Notes: Sewerage & Water Board roadwork projects (8,416). The ONLY SWB dataset on Socrata; no SWB billing, shutoff or leak data.
- Fields: segmentid:number, projid:text, ssstat:text, sstype:text, location:point
- Sample: `samples/socrata/bsnu-de3a.sample.json`, metadata: `samples/socrata/bsnu-de3a.meta.json`

### RoadWork DPW Projects (`u5mk-y9z4`) [LIVE]
- URL: https://data.nola.gov/resource/u5mk-y9z4.json (type: tabular/dataset; 18 columns)
- Rows: 14297; last data refresh (rowsUpdatedAt): 2026-10-17 03:26 UTC (0 days ago); max :updated_at: 2026-10-17T03:29:45
- Date coverage: `lookahead_start` 2023-01-16 to 2023-04-24; `lookahead_end` 2023-01-30 to 2023-05-08
- License/attribution (metadata): none set / none
- Cadence: Nightly full replace (every row :updated_at = refresh time)
- Location/address format: geometry
- Join keys: project id
- Notes: DPW roadwork projects (14,297).
- Fields: segmentid:number, projid:text, councildst:text, consttype:text, projtype:text, nhood:text, project_name:text, current_phase:text, startqtr:text, endqtr:text, total_cost:number, project_contractor:text, outreach_contact:text, lookahead_start:calendar_date, lookahead_end:calendar_date, project_lookahead:text, lookahead_comments:text, location:point
- Sample: `samples/socrata/u5mk-y9z4.sample.json`, metadata: `samples/socrata/u5mk-y9z4.meta.json`

### Catch Basin Cleanings / Inspections (`2zer-6wpb`) [LIVE]
- URL: https://data.nola.gov/resource/2zer-6wpb.json (type: tabular/dataset; 14 columns)
- Rows: 103767; last data refresh (rowsUpdatedAt): 2026-10-17 04:45 UTC (0 days ago); max :updated_at: 2026-10-17T04:46:03
- Date coverage: `mdate` 2017-01-09 to 2025-01-02
- License/attribution (metadata): none set / none
- Cadence: Nightly metadata refresh but mdate max 2025-01-02
- Location/address format: catch basin id
- Join keys: catch basin id
- Notes: Catch basin cleaning events (103,767); events appear to stop 2025-01-02 despite nightly refresh.
- Fields: nearestfu:text, mdate:calendar_date, neighborhood:text, segmentid:number, councildistrict:text, crewname:text, reason:text, lineflushed:number, gisid:text, cbmaintid:number, y:number, x:number, worktype:text, location:location
- Sample: `samples/socrata/2zer-6wpb.sample.json`, metadata: `samples/socrata/2zer-6wpb.meta.json`

### Catch Basins (`se4p-ierc`) [STALE]
- URL: https://data.nola.gov/resource/se4p-ierc.json (type: tabular/dataset; 8 columns)
- Rows: 80553; last data refresh (rowsUpdatedAt): 2026-04-29 20:30 UTC (171 days ago); max :updated_at: 2026-04-29T20:30:00
- Date coverage: n/a (no date-typed columns, or text-typed timestamps)
- License/attribution (metadata): Creative Commons 1.0 Universal (Public Domain Dedication) / Public Works (DPW)
- Cadence: 2026-04-29
- Location/address format: points
- Join keys: n/a
- Notes: Catch basins asset (80,553).
- Fields: the_geom:point, objectid:number, gisid:text, loc:text, cbtype:text, stname:text, neighborhood:text, globalid:text
- Sample: `samples/socrata/se4p-ierc.sample.json`, metadata: `samples/socrata/se4p-ierc.meta.json`

### Street Name (`fdkj-rjrv`) [STALE]
- URL: https://data.nola.gov/resource/fdkj-rjrv.json (type: tabular/dataset; 39 columns)
- Rows: 28526; last data refresh (rowsUpdatedAt): 2026-07-06 19:22 UTC (103 days ago); max :updated_at: 2026-07-06T19:22:15
- Date coverage: `lastupdate` 2019-10-21 to 2026-07-01
- License/attribution (metadata): Creative Commons 1.0 Universal (Public Domain Dedication) / Public Works (DPW)
- Cadence: 2026-07-06
- Location/address format: table
- Join keys: street name
- Notes: Street Name table (28,526): use for address normalization (prefix/suffix/type).
- Fields: the_geom:multiline, objectid:number, centerlineid:text, fromleft:number, toleft:number, fromright:number, toright:number, fullname:text, fedroute:text, fedrtetype:text, afedrte:text, afedrtetype:text, stroute:text, strtetype:text, astrte:text, astrtetype:text, ctyroute:text, onewaydir:text, roadlevel:number, inwater:text, roadclass:text, mtfcc:text, ownedby:number, maintby:number, munileft:text, muniright:text, stateleft:text, stateright:text, zipleft:text, zipright:text, msagleft:text, msagright:text, esnleft:text, esnright:text, lastupdate:date, lasteditor:text, fullnameabv:text, joinid:number, shape_stlength:number
- Sample: `samples/socrata/fdkj-rjrv.sample.json`, metadata: `samples/socrata/fdkj-rjrv.meta.json`
