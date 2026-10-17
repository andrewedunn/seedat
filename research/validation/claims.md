<!-- ABOUTME: Independent validation of Phase 0 research claims for See Dat. -->
<!-- ABOUTME: Produced by a validation subagent that did not write the research files. -->
# Validation of Phase 0 claims (run 2026-10-17)

Scripts: `research/validation/scripts/`. Downloaded data (about 107 MB incl. lama.json and parcel id lists, gitignored via validation/.gitignore): `research/validation/data/`.
All Socrata/ArcGIS requests used the seedat-research UA with >=1 s spacing. One Stop: 6 requests total, 3 s apart, no cookies, no login.

## 1. Permit datasets (rcm3-fn58, 72f9-bi28, aib5-en5t) - PARTIAL

| | rcm3-fn58 "Permits" | 72f9-bi28 "Permits - BLDS" | aib5-en5t "Permit Application Data" |
|---|---|---|---|
| Rows | 349,078 | 466,337 | 228,560 |
| Columns (excl. computed regions) | 42 | 33 | 43 |
| Primary date range | filingdate 2002-02-03 .. 2026-10-16 (822 null; 99.9% is 2012+) | applieddate 2012-01-01 .. 2026-10-15 | application_submitted 2015-03-20 .. 2026-10-16 (6 null; 99.9% is 2018+) |
| Issue date range | 2012-01-01 .. 2026-10-16 | 2001-11-16 .. 2026-10-14 | 2001-11-16 .. 2026-10-16 (181,272 non-null) |
| rowsUpdatedAt | 2026-10-16 23:53 CDT | 2026-10-15 01:16 CDT | 2026-10-16 23:48 CDT |
| Status | currentstatus, nextstatus, statusdates | statuscurrent + statuscurrentmapped, statusdate | currentstatus, plus per-milestone dates (submitted, review, plan review, zoning, approved, issue, first inspection) and days_to_* |
| Valuation | constrval (100% non-null) | estprojectcost (100% non-null, mostly 0.0 in recent rows) | constrval |
| Description | description | description | descr |
| Type | type, code | permittype, permittypedesc, permitclass, workclass (+ mapped enums) | type, class, use |
| Address | address | originaladdress1 + city/state/zip | address |
| pin | pin (315,121 = 90.3%) | pin (422,400 = 90.6%) | none |
| lat/lon | location_1, 349,078 (100%) | `location` column declared but 0 rows non-null | latitude/longitude + x/y, 228,560 (100%) |
| Extras | fees, inspection count, contractors, zoning, hist district, council dist | contractor name/trade/license, fee, link to One Stop (`Redirect.aspx?SearchString=<refcode>`), CO issue date | cycle-time fields, certificate_of_occupancy, void reason |

Overlap, same-window comparison (filed 2026-09-01 .. 2026-09-30, `scripts/overlap_window.py`): rcm3 1,152 permits; BLDS 2,484; aib5 2,117; union 2,797; in all three 1,149.
- Of rcm3, 1,150 are in BLDS (99.8%) and 1,151 in aib5 (99.9%). So rcm3 is a near-strict subset.
- BLDS has 1,334 permits rcm3 lacks; aib5 has 966 rcm3 lacks. BLDS vs aib5: 1,804 common, 680 only BLDS, 313 only aib5.
- Missing from rcm3 are mainly RENO (277 BLDS vs 33 rcm3 in Sep 2026), PLMB (267 vs 0), HDLC (188 vs 0), NEWC (44 vs 3), RCZD, VCGEN, RSTC. 2025 yearly counts: rcm3 17,174 vs BLDS 29,828 vs aib5 25,074.
- "Recent 1000" sample (task spec) results are window-biased, shown for completeness: rcm3 sample in BLDS 976/1000, in aib5 1000/1000; BLDS sample in rcm3 344/1000, in aib5 728/1000; aib5 sample in rcm3 352/1000, in BLDS 701/1000. Permit number format is the same across all three (`YY-NNNNN-TYPE`).

Verdict: BLDS (72f9-bi28) is the best primary source: most rows (466k), most complete recent coverage (all types), pin, contractor, One Stop link. Its gaps: no lat/lon, no fee/inspection detail, updated about every 1-2 days. rcm3 has the most operational fields (fees, inspections, zoning, coordinates) but is NOT "the same universe": it omits roughly half of recent permits. aib5 is the best for coordinates and cycle-time milestones but has no pin. Use BLDS as the spine, join rcm3/aib5 on permit number for enrichment.
Correction to research: socrata.md line ~204 ("assume the same universe") and line 9 (names rcm3 as the permit feed) need revising.

## 2. Parcels To Join crosswalk (GEOPIN + tax bill number) - REFUTED

- `pzqp-4ri7` (162,773 rows; 150,594 distinct geopin) has fields `geopin` (number) and `parid` (text). `parid` looks like `3655-FLORENCEAV`, `839-TECHEST`: an address-derived assessor id (pattern `9999-AAAA...`), NOT the tax bill number. The maps.nola.gov layer has the same two fields (OBJECTID, GEOPIN, PARID).
- Permit `pin` values are tax bill numbers: shapes `999999999` (e.g. 614205107) and `99A999999` (e.g. 39W401319), occasionally comma-separated lists (up to 23 pins).
- 500 recent permits with non-null pin: BLDS 0/500 match parid (exact, normalized, leading-zero-stripped); rcm3 0/500. Against GEOPIN: 1/500 and 0/500 (coincidence of a 9-digit pin equal to an 8-digit geopin).
- One Stop confirms the semantics: permit page for id 1122300 shows "Parcel Tax Bill Numbers 39W401319", equal to BLDS `pin` for the same permit (26-30446-RENO, 1501 Independence St).
- Consequence: there is no pin-to-GEOPIN table in Socrata or on maps.nola.gov. Only `aned-jbk9` (Post-Katrina Damage Assessment) carries a `taxbill` column. Permits must reach parcels via address match (LAMA, claim 5) or lat/lon point-in-polygon (rcm3/aib5).
- Correction: parcels.md rows C and line 31, 37, 60 ("GEOPIN to tax-bill crosswalk", "parid (the tax bill number)") are wrong. arcgis.md line 39 is correct. The "canonical parcel table" plan must be rethought; tax bill numbers must come from the Assessor or from permit pins themselves.

## 3. Code enforcement geopin vs parcel GEOPIN - CONFIRMED

- u6yx-v2tw: 183,007 cases, 169,523 with geopin (92.6%).
- 500 most recent cases (filed 2026-09-25 .. 2026-10-16): 474 have geopin (94.8%); 474/474 (100%) found in Parcels `v9q5-fz7t` and in Parcels To Join. 500 most recent with non-null geopin: 500/500 (100%) in both.
- Caveat: newest cases (just filed) often have no geopin and xpos/ypos = -1.

## 4. LAMA Site_Address_Point_LAMA - CONFIRMED

- Correct URL base is `https://maps.nola.gov/server/rest/services/Addresses/Site_Address_Point_LAMA/MapServer/0` (`/arcgis/rest/...` returns 404).
- Count 275,122 (distinct FULLADDR 274,546). GEOPIN non-null: 270,201 (98.2%).
- Random sample 500 non-null GEOPINs: 500/500 present in Parcels (v9q5-fz7t). Full check: 270,170/270,201 (99.99%).
- Note: outStatistics group-by on STATUS hung (timeout); avoid.

## 5. Baseline address match against LAMA FULLADDR - PARTIAL (baseline only)

LAMA FULLADDR spells suffixes out ("2319 KRAFT PLACE", "5000 TOULON STREET", units appended "1629 BORDEAUX STREET APT B"); permits use abbreviations ("Ave", "St").

| Permit set (1000 most recent) | Pass 1 uppercase + whitespace | Pass 2 + suffix/direction abbreviation on both sides, unit strip, range-to-first-number, strip punctuation |
|---|---|---|
| BLDS originaladdress1 | 4 (0.4%) | 929 (92.9%) |
| rcm3 address | 6 (0.6%) | 937 (93.7%) |

Pass 1 is useless because of the suffix spelling mismatch. Misses (BLDS, 20 examples): `6425 General Meyer Ave`, `6421 General Meyer Ave`, `4220 Loyola Ave, 26-24517-pool`, `1108 Milan St, 26-27114-pool`, `5525-5527 N Villere St`, `3740 S Roman St`, `733 Saint Louis St, 500 bourbon`, `2723 Saint Claude Ave, 2721 Saint Claude Ave, 2721 Saint Claude Ave Apt 1A, ...` (multi-address lists), `9957 E Wheaton Cir`, `7081 Whitmore Pl, 7081 Whitmore Pl New Orleans LA 70128`, `857 French St, 857 French St. `, `6178 Louisville St, 6178 Louisiana St.`, `3400 S Claiborne Ave, D`, `2110 D'abadie St, Street`, `1923 N Rampart St, 1925 N Rampart St`, `928 Second St, 930 Second St. `, `1108 N Johnson St, 2037 Ursulines Ave`.
rcm3 extra misses: `5727 Elysian Fields Ave`, `2051 Allen Toussaint Blvd`, `1400 Fats Domino Ave, ...`, `650 Andrew Higgins Dr`, `170-180 Horseshoe Bnd`, `1 Canal St, Goldring/Woldenberg Park`.
Miss classes: comma-separated multi-address fields, embedded permit numbers/notes, street renames (Elysian Fields, Allen Toussaint, Fats Domino, Andrew Higgins), true no-address-point. Pass 2 matches on address string only (not unique parcel; unit-stripped matches may be many-to-one). Not a final matcher.

## 6. Socrata :updated_at - PARTIAL (research claim overstated)

- u6yx-v2tw: ONE timestamp for all 183,007 rows (2026-10-17T04:05:26Z). Full replace CONFIRMED.
- rcm3-fn58: NOT one timestamp. Top groups are about 50,000 rows each, stamped 04:46-04:53Z on 2026-10-17 (chunked replace over about 7 minutes). Also 2,174 rows carry older stamps (min 2019-09-20; 551 at 2023-11-18). Correction: "every row :updated_at = refresh time" is wrong for rcm3.
- 2jgv-pqrq (1,039,503 rows): many timestamps (456,507 at 2021-06-04; 21,928 at 2024-09-06; 10,037 at 2026-09-03; ...). Incremental upsert style, NOT a full replace.
- Extra: aib5-en5t is chunked like rcm3 (about 9,100 per stamp, 04:46-04:49Z); BLDS chunks about 9,150 per stamp at 2026-10-15T06:04Z (so BLDS was last refreshed 2026-10-15, 2 days behind the other two on 2026-10-17).

## 7. One Stop detail page - CONFIRMED

- `https://onestopapp.nola.gov/SummaryContent.aspx?type=Permit&id=1122300` returns 200 (7,596 bytes) with no cookies, no login, no redirects.
- Contents: reference code, permit number ("Not Issued" until issued), type, location, owner name, description, Status Information (milestone name, complete Y/N, date), Fees (type, amount, paid), Reviews (division, status, reviewer name, date), Review Comments, Inspections table (type, date, status), Contractors (name, license), Details key/value list, "Parcel Tax Bill Numbers", lot, block.
- id=1100000 (permit 26-10504-RNVN): full milestone history (Application Submitted 4/7/2026 ... Permit Issued 6/11/2026). id=1050000 (25-06193-FGAS): Inspections table with "Gas Line 6/3/2025 11:00 AM Passed", "Finaled", "Certificate of Completion". So inspections and status history are present (milestone dates, not a full audit log).
- Neighbors load: id=1122301 returns 200 but is an empty shell (all fields blank, 5,166 bytes); id=1122302 returns 200 with a real plumbing permit. Ids are sequential and enumerable; some ids are blank.
- Privacy: review comments contain staff names, emails and phone numbers; owner names are shown. Scrub before republishing.
- robots.txt: 404 (IIS default page). No crawl policy published.
- Research claim in onestop.md is consistent with these results.

## 8. NOPD calls-for-service terms - CONFIRMED

Dataset es9j-6y5d "Calls for Service 2026" (https://data.nola.gov/resource/es9j-6y5d, API view https://data.nola.gov/api/views/es9j-6y5d.json) has no license field (licenseId None). The description (disclaimer) says: "Any use of the information for commercial purposes is strictly prohibited." It also states "attempts to derive specific addresses are strictly prohibited" and addresses are block-level. See Dat should not republish or map-link calls-for-service at address level, and a commercial-use bar needs legal review. Dataset is current to 2026-10-17 08:00.

## 9. Prior art

(a) Gambit Oct 2025 permit dashboard - CONFIRMED with nuance. Article "Here's how New Orleans candidates say they'll fix the city's broken permitting system" by Kaylee Poche, 2025-10-04: https://www.nola.com/gambit/news/politics_elections/new-orleans-political-candidates-permitting-system/article_a94a0c58-f33a-482d-9fd4-d30de796669c.html (mirrored at https://www.bgr.org/heres-how-new-orleans-candidates-say-theyll-fix-the-citys-broken-permitting-system/). It reports State Rep. Matthew Willard saying at a July forum that the city should have an online permitting dashboard with dates people request and receive permits. It is a candidate proposal quoted in the article, not a Gambit editorial call.
(b) La. R.S. 33:4778 - CONFIRMED. https://legis.la.gov/legis/Law.aspx?d=860874 (Acts 2013, No. 328). The Department of Safety and Permits, including its boards, "shall make available to the public on the Internet all information pertaining to the regulatory activities of the department", including applications received, inspections made, tests/exams, zoning verifications, licenses/permits issued, denied, revoked, suspended or cancelled, notices, enforcement actions, determinations, and demolitions. Subsection B: documents required to be posted must be posted within three business days after the decision, with date/time of initial posting; if not timely, no appeal delay starts until posted. It does not require an API, bulk download, or status dashboard, and the statute applies to Safety and Permits only (not Code Enforcement or other departments). Compliance remains a judgment call.
(c) Shovels coverage of New Orleans - NOT CONFIRMED (no public evidence). shovels.ai claims 2,820+ jurisdictions and a coverage page that is a JS map. Only public mention found: blog "The Next Austin" (2026-08-13, https://www.shovels.ai/blog/next-boomtown-permit-data/) covers "New Orleans Northshore" = St. Tammany Parish, and cites Orleans Parish permits via FRED, not via Shovels data. Orleans Parish city coverage unverified.
(d) BlightStatus - PARTIAL. blightstatus.nola.gov fails at TLS (handshake internal error alert), so the original site is effectively down. The City's DataDriven page still lists "BlightStatus: Find a property's status in the Code enforcement pipeline" (https://datadriven.nola.gov/products/analysis/nolaytics-code-enforcement-abatement-tool/), and Socrata still publishes "BlightStatus Demolitions" (e3wd-h7q2). So: original app down, branding lingers on city pages. No evidence of an active successor.

## Corrections the research files need

1. parcels.md rows B/C and sections 2 and 6: `pzqp-4ri7.parid` is NOT the tax bill number. No GEOPIN-to-tax-bill table exists in the public sources checked. Permit `pin` = tax bill number (0/500 match parid or geopin).
2. socrata.md ~line 204 and line 9: permit datasets are not the same universe. rcm3 omits about 50% of recent permits (no PLMB/HDLC, few RENO/NEWC). Make BLDS the spine.
3. socrata.md refresh claims: rcm3 and aib5 are chunked replaces (about 6-7 min window), BLDS was last refreshed 2026-10-15, 2jgv-pqrq is incremental. Only u6yx-v2tw is a single-timestamp replace. Also rcm3 has 2,174 older-stamped rows.
4. socrata.md line 28/29 describe BLDS location as "declared but empty": confirmed (0 rows). Column counts differ by whether `:@computed_region_*` columns are counted (rcm3 50 total, BLDS 41, aib5 51).
5. arcgis.md/parcels.md: use `/server/rest/services/...` base on maps.nola.gov, not `/arcgis/rest/...`. LAMA GEOPIN coverage is 98.2%, not unspecified.
6. nola.md line 76: Willard's dashboard idea was said at a July forum, reported by Gambit 2025-10-04 (reporter Kaylee Poche); it is not a Gambit editorial. Add the 33:4778 detail that posting is due within three business days.
7. national.md Shovels: "New Orleans coverage NOT CONFIRMED" stands; add that the only Shovels New Orleans mention is the Northshore/St. Tammany.
8. nola.md BlightStatus: record that blightstatus.nola.gov fails TLS and the city still links it.
9. Add to NOPD notes: the dataset text bars commercial use and address derivation.
10. Address matching: naive uppercase match is about 0.5% because LAMA spells out suffixes; the second-pass normalization reaches about 93%. The unmatched 7% is multi-address fields, notes embedded in the address, and renamed streets.
