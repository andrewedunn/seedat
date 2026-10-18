<!-- ABOUTME: Independent 50-address spot check of See Dat against data.nola.gov and One Stop: method, per-address results, metrics, every miss with diagnosis. -->
<!-- ABOUTME: Re-run with `npx tsx scripts/spot-check.ts`; the frozen sample is research/validation/spot-check-fixture.json. Run 2026-10-17 by a validator who did not build the system. -->

# Spot check: 50 addresses (2026-10-17)

## Headline

| Metric | Result |
|---|---|
| Address resolution (address to correct parcel) | **50/50 = 100%** (verified against the city's own parcel and address-point layers) |
| Record recall (city records at the address that See Dat attached) | **333/383 = 86.9%** overall: permits 238/243 = 97.9%, code cases 62/63 = 98.4%, short-term rentals 33/77 = 42.9% |
| Recall excluding the two API caps (STR 50, permits 200) | 333/338 = 98.5% |
| Record precision (See Dat records that belong) | **94.4%** point estimate (652/691); **90.3%** floor if every record I could not verify counts as wrong (624/691) |
| One Stop status agreement (6 permits) | status text 6/6; open/closed flag 3/6 (all three "Closed" permits are shown as open) |

The recall target (90%) is missed, and the cause is not matching. It is two hard caps in the API (STR 50 rows, permits 200 rows, `limit` ignored for STR and no paging). Matching itself is good: every miss that is not a cap is a multi-address or conflicting-address record, listed below. The real problems are (1) caps, (2) a "Closed" status shown as open, (3) event and street-closure permits attached to parcels by proximity.

## Method

**Sampling (seeded, so reproducible).** Seed 20261017. I drew 143 candidate addresses: 60 random BLDS permits applied 2022 or later (`originaladdress1`, random `$offset` into the filtered set), 20 rcm3 permits (2022+), 25 code cases (filed 2020+, `location`), 20 STR applications (2019+, `address`), and 18 typeahead addresses (`/api/suggest?q=<random 3-digit number> <two letters>`, one random result) as "no expected activity" candidates. Each candidate was labelled with a neighborhood through See Dat's `lookup_address` (the only neighborhood tag available; I did not evaluate the label itself). 142 of 143 candidates resolved (the one that did not, `3224 wall / 1297501 shepard`, is an intersection-style string, and was not drawn). I then selected 20 BLDS, 6 rcm3, 7 code, 7 STR and 10 typeahead addresses, at most 2 per neighborhood. Result: 50 addresses in **32 neighborhoods**. The typeahead group was meant to be quiet, but only 4 of its 10 truly had no city records (rows 47 to 50), so the "no activity" group is really a second random sample of the whole city.

**Independent record search (no See Dat).** For each address I parsed house number and street, then queried data.nola.gov Socrata: BLDS `72f9-bi28` (`originaladdress1`, `permitnum`) and rcm3 `rcm3-fn58` (`address`, `numstring`) permits, code cases `u6yx-v2tw` (`location`, `caseno`), and STR applications `en36-xvxg` (`address`, `reference_code`). Matching: case-insensitive `LIKE` on the house number and the longest street word (with ordinal variants Second/2nd), then strict re-filtering in code: street name must equal (ignoring suffix, leading directional, and St/Saint), house-number ranges such as `1234-36` count if they cover the number on the same side of the street, and comma, parenthesis and "and" separated alternates are each tried. Permit numbers from the two permit datasets were merged by number.

**Independent parcel truth.** For resolution I did not trust See Dat's address table. I looked the house number and street up in the city's parcel layer (`Assessor/Landbase_Layers/MapServer/0`, `SITUS_NUMBER`, `SITUS_STREET`) and address-point layer (`Addresses/Site_Address_Point_LAMA/MapServer/0`, `ADDRNUM`, `FULLNAME`). Resolution is correct if See Dat's GEOPIN is in that set. All 50 had a non-empty set.

**Comparison.** `lookup_address` then `get_property_records` (`include_timeline:false`, `limit:200`). Recall is by record ID: permit number, code case number, STR reference code (See Dat `str_id`). Precision: every See Dat record not in my expected set was classified by re-parsing its raw address: same address (as typed), same parcel under another address (confirmed by the city layers), or unverified. Unverified ones were adjudicated by hand using See Dat's `match_type`.

**One Stop.** Six permits, chosen to cover the status mix (3 "Closed", 1 Permit Issued, 1 Application Submitted, 1 Finaled). Each check takes two GETs (`Redirect.aspx?SearchString=<ref>` sets the session and 302s, then `Search.aspx` with the cookie shows the record card), so 12 requests allowed 6 checks, not 10. Exactly 12 requests were made, 35 s apart, with the `seedat-validation/0.1` User-Agent, no 429s. The "Download permit CSV" link was never requested.

## Results

Columns: city records and See Dat records are permits/code cases/STR. "Doubtful extra" is a See Dat record I could not tie to the address (see Precision).

| # | Address searched | Neighborhood | Parcel ok | City P/C/S | See Dat P/C/S | Misses |
|---|---|---|---|---|---|---|
| 1 | 810 Union St | CENTRAL BUSINESS DISTRICT | yes | 4/0/0 | 11/1/0 | - ; 1 doubtful extra |
| 2 | 3012 Mandeville St | ST. ROCH | yes | 6/7/0 | 9/7/0 | - |
| 3 | 153 Roosevelt Way | CENTRAL BUSINESS DISTRICT | yes | 3/0/0 | 31/1/0 | 15-32378-RNVN (M2) ; 3 doubtful extras |
| 4 | 1007 Ursulines Ave | FRENCH QUARTER | yes | 7/0/0 | 9/0/0 | - |
| 5 | 1339 Harrison Ave | FILMORE | yes | 2/0/0 | 2/0/0 | - |
| 6 | 235 N Peters St | FRENCH QUARTER | yes | 16/3/0 | 19/3/0 | - ; 3 doubtful extras |
| 7 | 3414 S Robertson St | MILAN | yes | 3/2/0 | 3/2/0 | - |
| 8 | 436 Bouny St | ALGIERS POINT | yes | 3/0/0 | 9/0/0 | - |
| 9 | 2640 Comet St | OLD AURORA | yes | 8/0/0 | 8/0/0 | - |
| 10 | 6210 Chef Menteur Hwy | VIAVANT - VENETIAN ISLES | yes | 10/0/0 | 20/0/0 | - |
| 11 | 251 Bellaire Dr | LAKEWOOD | yes | 11/0/0 | 11/0/0 | - |
| 12 | 1823 Benton St | LOWER NINTH WARD | yes | 5/1/0 | 10/4/0 | - |
| 13 | 4827 Saint Charles Ave | UPTOWN | yes | 4/0/0 | 4/0/0 | - |
| 14 | 27 McAlister Dr | AUDUBON | yes | 17/0/0 | 200/4/0 | 20-20993-RNVS (M3) ; 31 doubtful extras |
| 15 | 5580 Woodlawn Pl | NAVARRE | yes | 3/0/0 | 3/0/0 | - |
| 16 | 2137 S Carrollton Ave, 8030 Sycamore St, 8034 Sycamore St | MARLYVILLE - FONTAINEBLEAU | yes | 6/4/0 | 8/7/0 | - ; 1 doubtful extra |
| 17 | 1305 Saint Roch Ave Apt B | ST. ROCH | yes | 9/1/4 | 12/1/6 | - |
| 18 | 3777 Preston Pl | NEW AURORA - ENGLISH TURN | yes | 1/1/0 | 1/1/0 | - |
| 19 | 5701 Argonne Blvd | LAKEVIEW | yes | 9/1/0 | 9/1/0 | - |
| 20 | 4650 Lurline St | READ BLVD WEST | yes | 6/0/0 | 6/0/0 | - |
| 21 | 3040 Hudson St | TALL TIMBERS - BRECHTEL | yes | 5/1/0 | 5/1/0 | - |
| 22 | 6975 Marshal Foch St | LAKEVIEW | yes | 12/0/0 | 12/0/0 | - |
| 23 | 1808 Prytania St | LOWER GARDEN DISTRICT | yes | 22/2/0 | 22/2/0 | 26-21660-RSTC (M1) |
| 24 | 2913 Amelia St | MILAN | yes | 10/1/0 | 15/2/0 | - |
| 25 | 15 Hawk St | LAKESHORE - LAKE VISTA | yes | 4/0/0 | 4/0/0 | - |
| 26 | 3116 Jackson Ave | CENTRAL CITY | yes | 5/6/0 | 5/6/0 | - |
| 27 | 2226 Barracks St | TREME - LAFITTE | yes | 1/4/0 | 2/4/0 | - |
| 28 | 1921 Jourdan Ave | LOWER NINTH WARD | yes | 0/2/0 | 0/2/0 | - |
| 29 | 3831 Piedmont Dr | GENTILLY TERRACE | yes | 0/2/0 | 0/2/0 | - |
| 30 | 1810 Louisa St | ST. CLAUDE | yes | 0/4/0 | 0/5/0 | - |
| 31 | 3515- 3517 Second St | CENTRAL CITY | yes | 1/3/0 | 1/3/0 | - |
| 32 | 915 Lamanche St | HOLY CROSS | yes | 0/3/0 | 0/3/0 | - |
| 33 | 803 Seventh St | IRISH CHANNEL | yes | 16/3/0 | 16/3/0 | - |
| 34 | 1053 Constance St | LOWER GARDEN DISTRICT | yes | 0/0/48 | 2/0/50 | 44 STR (M5) |
| 35 | 2635 Wisteria St | GENTILLY TERRACE | yes | 0/0/1 | 3/0/5 | - |
| 36 | 1930 Robert St | UPTOWN | yes | 2/0/8 | 2/0/8 | - |
| 37 | 3026 Napoleon Ave | BROADMOOR | yes | 1/0/5 | 6/0/13 | - |
| 38 | 1632 Audubon St | AUDUBON | yes | 3/0/5 | 3/0/11 | - |
| 39 | 7022 Colapissa St | MARLYVILLE - FONTAINEBLEAU | yes | 6/0/3 | 10/0/3 | - |
| 40 | 1839 Louisa St | ST. CLAUDE | yes | 8/0/3 | 7/0/3 | 22-15936-ECOA (M1) |
| 41 | 724 Hagan Street | BAYOU ST. JOHN | yes | 5/3/0 | 5/3/0 | - |
| 42 | 812 Peniston Street | EAST RIVERSIDE | yes | 7/0/0 | 7/0/0 | - |
| 43 | 435 Wiltz Lane | U.S. NAVAL BASE | yes | 0/7/0 | 0/7/0 | 12-09392-PNBL (M4) |
| 44 | 202 Westpark Court | BEHRMAN | yes | 1/1/0 | 1/1/0 | - |
| 45 | 734 Ninth Street | IRISH CHANNEL | yes | 1/0/0 | 0/0/0 | BZA022-25 (M1) |
| 46 | 511 Constantinople Street | EAST RIVERSIDE | yes | 0/1/0 | 0/1/0 | - |
| 47 | 319 Virginia Street | NAVARRE | yes | 0/0/0 | 2/0/0 | - |
| 48 | 711 Bolivar Street | TULANE - GRAVIER | yes | 0/0/0 | 0/0/0 | - |
| 49 | 601 Aurora Oaks Drive | OLD AURORA | yes | 0/0/0 | 0/0/0 | - |
| 50 | 525 Guadal Canal Street | U.S. NAVAL BASE | yes | 0/0/0 | 0/0/0 | - |

## One Stop comparison

| Permit | Ref | One Stop status | One Stop "Closed" | See Dat status | See Dat `is_open` | Agree |
|---|---|---|---|---|---|---|
| 18-19895-RNVN | 2QNMU8 | Closed (final 3/13/2025) | Yes | Closed | **true** | status yes, open/closed **no** |
| 21-33103-RCZD | QQYNFF | Closed (final 3/25/2025) | Yes | Closed | **true** | status yes, open/closed **no** |
| 16-01860-RSTC | 017JCZ | Closed (final 3/23/2025) | Yes | Closed | **true** | status yes, open/closed **no** |
| 22-32640-RNVN | 00EZVB | Permit Issued | No | Permit Issued | true | yes |
| 25-02650-RNVN | 7UZF0C | Application Submitted | No | Application Submitted | true | yes |
| 25-39089-FGAS | GFSLU4 | Finaled (final 12/30/2025) | Yes | Finaled | false | yes |

The status text matches in 6 of 6. But One Stop says `Closed: Yes` for "Closed" permits and See Dat flags them `is_open: true` (and maps the status to "Other"). In this sample 40 of 515 permits (7.8%) have status "Closed" and `is_open` true; all carry a final date in March 2025 (a bulk administrative closure). Any "open permits" count, `permits_open` summary or `find_properties` open-permit filter is inflated by these.

## Misses (every one)

Codes: **M1** multi-address permit shown only on the first parcel; **M2** alternate address in parentheses ignored; **M3** permits cap; **M4** city case record disagrees with itself; **M5** STR cap.

| Address (row) | Record | Code | Diagnosis |
|---|---|---|---|
| 153 Roosevelt Way (3) | permit 15-32378-RNVN, typed `153 University Pl, (153 Roosevelt Way)` | M2 | The text is cut at the comma and the parenthetical alternate `(153 Roosevelt Way)` is dropped. `153 University Pl` itself is not an address point, so the permit stays unmatched while its neighbors `145`/`165 University Pl` match through an alias. |
| 27 McAlister Dr (14) | permit 20-20993-RNVS (pin 615211904, applied 2020-03-05) | M3 | The parcel (1 Newcomb Place, Tulane) has 517 permits per `lookup_address` counts. `get_property_records` returns at most 200 per kind, newest first, with no offset, and `since` still returns 200. Older permits cannot be reached through the API. Probably attached, not retrievable. |
| 1808 Prytania St (23) | permit 26-21660-RSTC, typed `1800 Prytania St, 1808 Prytania St`, filed 2026-07-23 | M1 | Two addresses on two parcels. The first number wins (`1800 Prytania` resolves to the parcel whose page is titled `1438 Felicity Street`, which does carry the permit); the 1808 parcel gets nothing. The permit's own `pin` 412103107 was not used to place it on the second parcel. |
| 1839 Louisa St (40) | permit 22-15936-ECOA, typed `1835-1839 Louisa St` | M1 | Attached to the 1835 parcel (GEOPIN 51002875, a different parcel from 1839's 41067236) via `range_member`. The docs say other members are "recorded", but the 1839 page does not show it. |
| 734 Ninth Street (45) | permit BZA022-25 (variance, finaled), typed `732-736 Ninth Street`, pin 41041864 | M1 | Same cause. It is on the 732 parcel (41041864). 734 has its own parcel (52001039), so searching 734 shows "0 permits" for a property that had a zoning variance. This row was drawn as a quiet address, and it is wrongly quiet. |
| 435 Wiltz Lane (43) | code case 12-09392-PNBL, `location` 435 Wiltz Ln | M4 | The city row carries `geopin` 41180315 and `geoaddress` 431 Wiltz Ln, which disagree with its own `location`. See Dat followed the source GEOPIN (rung 0), so the case sits on 431 and a user searching 435 does not see it. A defensible choice, but silent. The adjacent case 12-09393-PNBL (`439 Wiltz Ln`) is also shown on this page because its GEOPIN is the same parcel. |
| 1053 Constance St (34) | 44 of 48 STR applications | M5 | The parcel (1041 Constance, a 50+ unit condo building) has 120 STR records in the dataset. The API returns exactly 50, independent of `limit` (10 returns 10, 50 and 200 return 50). Statuses of the dropped ones are mostly 2019 `Short Term Rental` Expired/Duplicate (26) and 2022 Commercial Owner Expired (18). Not a matching failure. |

## Precision: the 39 doubtful records

Of 691 records returned, 624 were tied to the address or to another address on the same parcel by city data. Of the 67 remaining I judged 28 probably right and 39 doubtful:

- **Probably right (28):** 4 where the city supplied the GEOPIN or the address text had a unit word my parser missed (`1632 Audubon Street Downstairs`, `8030 Sycamore/2137 S. Carrollton`, `2917 Amelia St`, `439 Wiltz Ln`); 18 via the alias `University Pl` to `Roosevelt Way` (plausible rename of a short street, but not confirmed by a city layer); 6 via `tax_bill` for Tulane buildings (`7 McAlister Dr` x5, `2951 Ben Weiner Dr`).
- **Doubtful (39):** 37 `nearest_point` matches, which are almost all special-event (SPMA) permits: Tulane tailgate, fireworks and commencement permits attached to the 27 McAlister parcel (most of the 37), parades such as `Second Line Parade - 444 St Charles Ave (InterContinental Hotel)` and `600 Carondelet St (Ace Hotel)` attached to 810 Union and 153 Roosevelt Way, and `8075 Sycamore St` (SMCL) attached to 2137 S Carrollton. Plus 2 `tax_bill` street-closure permits attached to 235 N Peters St, typed `Baronne St at Lafayette St` and `Bienville St and N Peters St`, which are intersections blocks away.

All 3 truly empty addresses (47 to 49) showed zero records, so there are no phantom records. Row 46 (319 Virginia Street) shows 2 records that belong to 315 Virginia on the same parcel.

## Other observations

- Several searches land on a page titled with a different address on the parcel: `810 Union St` shows `325 Carondelet Street`; `153 Roosevelt Way` shows `145 Roosevelt Way`; `1305 Saint Roch Ave Apt B` shows `13 Saint Roch Avenue`; `525 Guadal Canal Street` shows `302 Raphael Semmes Street`. The parcel is correct in each case (confirmed by the city layers) but a user may think the search failed. Showing "Searched: &lt;input&gt;" would help. 15 of 50 searches showed a different primary address.
- Row 16 (`2137 S Carrollton Ave, 8030 Sycamore St, 8034 Sycamore St`) is a three-address string; the independent expected set came from the whole string, and recall was complete.

## Recommended fixes

1. **Remove or surface the caps.** Honor `limit` for STR, add `offset`/paging (or a `total` per kind) to `get_property_records`, and show "showing 50 of 120" on the page. Fixes M3 and M5 (45 of 50 misses).
2. **Treat status "Closed" as closed.** Derive `is_open` from the final date or an explicit closed-status list (I did not read the code, so the current rule is unknown), and map "Closed" to a closed bucket instead of "Other". Check `find_properties` and `permits_open` counts after the fix.
3. **Show multi-address records on every parcel they name.** For `range_member` and comma lists, write one link row per parcel resolved (the docs already promise this), including the permit's own `pin` as a candidate parcel. Fixes the three M1 cases.
4. **Use parenthetical alternates.** Parse `(153 Roosevelt Way)` as a second address (M2).
5. **Stop proximity-matching event and street-closure permits.** Exclude permit types SPMA, RSTC and other non-site types from `nearest_point` and `tax_bill` placement, or show them as "nearby events" on the block panel. This removes 39 of 691 records (5.6%) of doubtful provenance, and the whole Tulane tailgate group.
6. **Source GEOPIN versus address text.** When a code case's `geopin`/`geoaddress` disagrees with its `location` address, attach it to both parcels or flag it (M4).
7. **Fixture upkeep.** `spot-check-fixture.json` freezes the expected IDs from 2026-10-17. New permits will make recall noisier over time; refresh the sample periodically rather than editing misses out of it.

## Re-running

`npx tsx scripts/spot-check.ts` reads `research/validation/spot-check-fixture.json`, repeats the lookup and record fetch against the live MCP server, and prints resolution, per-kind recall, precision, and every miss with its diagnosis code. It exits 1 if resolution or recall is below 90%. At the time of writing it exits 1 (recall 86.9%) because of the STR cap. `--mcp <url>` points it at another endpoint.
