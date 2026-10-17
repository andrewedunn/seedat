<!-- ABOUTME: Inventory of One Stop permitting data for See Dat. -->
<!-- ABOUTME: Produced by a source-inventory subagent. -->

# One Stop (onestopapp.nola.gov) inventory

Researched 2026-10-17. About 40 requests to onestopapp.nola.gov (>=2s apart, UA `seedat-research/0.1 (+https://seedat.dunn.us; seedat@dunn.us)`), all GETs, no login, no POSTs. Samples in `research/sources/samples/onestop/`.

## Access & robots
- `/robots.txt` returns 404 (IIS default error page). No crawl restrictions published; no ToS link seen on the site. Be polite anyway.
- Stack: ASP.NET WebForms 4.0 (VIEWSTATE/postbacks), IIS. Sessions via `ASP.NET_SessionId` cookie (set on first hit; not required for SummaryContent).
- Public (no login): `/`, `/Search.aspx`, `/Dashboard.aspx` (Open Data), `/Help.aspx`, `/About.aspx`, `/SummaryContent.aspx`, `/Redirect.aspx`.
- Login required (302 to `/Account/Login.aspx`): `/AdvancedSearch.aspx`, `/ListView.aspx?view=All|license`, `/FeeFinder.aspx`, `/Apply.aspx`, Watch List. `/InspectionFinder.aspx` 302s to Default. I did not log in or register (out of scope / prohibited).
- Free registration unlocks Advanced Search (date ranges, description keywords, council district, type). NOT used; whether ToS permits automated use of a registered account is unknown.
- Help page claims: data from 2007 to today; "real-time"; exports are CSV.

## Reports
Page `/Dashboard.aspx` ("Open Data"), five reports, each with View and Download buttons. Both are ASP.NET postback submit buttons (POST with VIEWSTATE), not plain GET links, so I did NOT download any (brief limited me to GETs). UNVERIFIED: file format (Help says CSV), fields, history depth, cadence.

| Report | Page description |
|---|---|
| Monthly Permit | permits issued the previous month |
| Plan Review Processing | permits with a completed plan review event during previous month |
| Open Permit | permits currently open and issued the previous month |
| Permit Activity | "standard report listing permit activity" |
| Monthly Permit List | list of permits issued the previous month |

Cadence is implied monthly (previous-month wording) -> useless for <24h. The Socrata datasets below supersede them for our purpose. Open question whether Permit Activity has inspection/review events not in Socrata (worth one manual download by Andrew in a browser to inspect).

## Search & detail pages
- Basic search (`/Search.aspx`): single box "Name, number, address"; submits via `__doPostBack` (POST + VIEWSTATE), results held in session. Filters: All/Permits/Licenses/Projects/Violations; sort: Recently Modified, Filing Date asc/desc; page size 10-200. No date-range input in basic search. Search matches: street address only (no city/zip), contractor name, license holder, reference code, permit/license/case number. Not verified (would need POST).
- Result cards show: address, type, ref code, status, date filed, closed Y/N, description, expires, division, subdivision, council district, next status + date, next inspection/date/inspector, total fees, unpaid fees, final date, days open, days issued, lead staff.
- **Reference code deep link (GET)**: `/Redirect.aspx?SearchString=<6-char ref code>` sets session search, 302 to `/Search.aspx` (needs cookie jar, e.g. curl -c/-b -L) which renders the record card with a link to the summary. Ref code is random alphanumeric (e.g. PNCDZL), not enumerable. The Socrata BLDS dataset publishes this URL for every permit in its `link` field.
- **Detail page (GET, no cookies needed)**: `/SummaryContent.aspx?type=Permit&id=<int>`. `id` is an internal sequential integer. Verified: id=1122300 (created 10/15/2026, permit not yet numbered), 1122299 (10/14/2026), 100000 (2006 legacy import "06ELC-30362"). IDs are enumerable and appear roughly chronological by creation (legacy imports sit at low ids). Valid `type` values seen: `Permit`, `Incident` (LAMA historic code-enforcement incidents, e.g. id=1000 = 04ESP-00999, 2004), `Project` (planning/BZA, e.g. id=2000 = BZA016-07, 2007). `type=Violation` id=1000 returned an empty page. `Incident` ids 60000 and 150000 gave a 302 (probably nonexistent or a different id space). Modern (post-LAMA) code-enforcement cases are NOT reachable via the Incident type as far as I could tell; the Socrata code-enforcement datasets cover them.
- Other aspx seen in JS (not probed): `/ExprDetail.aspx?ExprID=|AssetID=`, `/GetDocument.aspx?DocID=`, `/SignAgr.aspx`, `/ListView.aspx/ScheduleInpsection`.
- "Download permit CSV" text appears on every detail page, mechanism not inspected.

## Hidden endpoints
- Inspected `/bundles/onestop` JS. Only AJAX: `GET api/Prmt/?module=&id=` (returns help text HTML for a form field; not data) and `POST <page>?save=true` (form save, requires account). Typeahead bundle present (address/business autocomplete); endpoint not identified, not probed.
- No JSON/XHR API for records. Everything is server-rendered WebForms. Detail HTML is the machine path.
- Accela-like terminology ("LAMA" = legacy Accela-era system, 2004-2011 imports) but the app is custom.

## Fields
**Detail page (SummaryContent, permit)** has what Socrata lacks:
- Reference code, permit number ("Not Issued -->" until issued), type, location (address), **property owner**, description, created by (publicwebcrm = online apply).
- **Status history** (name, complete Y/N, date).
- **Fees** itemized (type, amount, paid).
- **Reviews** (division, status+date, reviewer name) and **review comments** (division, status, free text).
- **Inspections** (type, date, status; e.g. Final Electric / Rough Electrical = Unscheduled) and correction items.
- **Contractors** (name, license).
- **Details** key/values that vary by permit type: construction value, units, bedrooms/baths, foundation type, meters, Historic District / Vieux Carre / NCD flags, subdivision, zoning, **Parcel Tax Bill Numbers** (= Socrata `pin`, e.g. 39W401319), **Lot Number, Block Number**, addresses (can be multiple).
- Legacy imports (pre-LAMA era) also expose owner mailing address and, for Projects, owner phone.

**Socrata `rcm3-fn58` "Permits"** (nightly): address, owner, description, numstring, isclosed, type, code, division, m_s, filingdate, issuedate, currentstatus, nextstatus, currentstatusdate, nextstatusdate, landuse, projectname, unpaidfees, totalfees, bldgarea, constrval, bondamount, opencomments, applicant, totalinspections (count only), contractors, pin, beds, baths, heattype, secondfloo, basementar, daysopen, daysissued, leadagency, exitreason, subdivision, councildist, zoning, historicdistrict, location_1 (lat/lon).

**Socrata `72f9-bi28` "Permits - BLDS"**: permitnum, description, applieddate, issuedate, completedate, statuscurrent(+mapped), originaladdress1/city/state/zip, permitclass, workclass, permittype(+desc), statusdate, totalsqft, **link (One Stop Redirect URL)**, location, estprojectcost, pin, contractor company/trade/licnum/statelic, expiresdate, coissueddate, fee, mapped fields.

Not available anywhere in bulk (only on detail pages): inspection records (dates/results), review comments, fee line items, status history, lot/block, owner on BLDS.

## Update cadence
- One Stop live DB: effectively real-time (Help page claim; verified: a permit filed 10/15 22:22 CT was visible on 10/17 with review activity dated 10/15).
- `rcm3-fn58`: description "Updated nightly"; `rowsUpdatedAt` = 2026-10-17T04:53Z (about midnight CT). Max filingdate 2026-10-16 14:47 and max issuedate 2026-10-16 20:01. So lag is roughly 0.5-1 day. Rows 349,078; filingdate range 2002-02-03 to now (description says from 2012; older rows exist). `viewLastModified` is old (2017), so use `rowsUpdatedAt`/`:updated_at`.
- `72f9-bi28` BLDS: rowsUpdatedAt 2026-10-15T06:16Z (2 days stale at check time), max applieddate 2026-10-15 00:22. 466,337 rows (466,092 distinct permitnum), applieddate from 2012-01-01. Cadence unverified (looks not nightly, maybe several times a week).
- Monthly Open Data reports: monthly.
- Code enforcement datasets (all refreshed 2026-10-17 ~04:07-04:10Z): `u6yx-v2tw` All Cases (183,007 rows; newest case filed 2026-10-16), `3ehi-je3s` All Violations (272,896), `uh5a-f7uw` All Inspections (246,064), `44ct-56tr` All Hearings (103,309). Other: `xv8z-gn8b` Abatements, `8pqz-ftzc` Active Pipeline, `w6gf-dnv6` Hearings.
- Older code-enforcement ids `c3as-66tn`, `gjzc-adg8`, `d4d6-yab5` are stale (2024-2025); do not use.

## Recommended pull strategy (backfill + incremental)
Permits:
1. **Backfill + daily incremental from Socrata `rcm3-fn58`** via SODA (`$where=:updated_at > ...` or `currentstatusdate`/`filingdate` windows; page with `$limit/$offset` + `$order=:id`). One export covers 2002-today, 349k rows, ~12h lag. Pull `72f9-bi28` as well for `link` (ref code), zip, permit class/workclass, CO date, expiry. Join on permit number (`numstring` = `permitnum`).
2. **Sub-day freshness / enrichment from One Stop detail pages**: crawl `SummaryContent.aspx?type=Permit&id=N` (plain GET, no auth, ~6-8 KB). Backfill is feasible: ~1.1M ids at 1 req / 2 s = ~26 days; start with ids covering 2012+ and with recent windows. Incremental: keep a high-water id, probe forward from max known id until a run of N empty/error ids; re-poll open permits (status not final, `isclosed=False`) on a schedule, prioritising by recent `currentstatusdate`. Detail pages are the only source for inspections, reviews, fees, status history. Ask the city (onestopapp@nola.gov / data@nola.gov) for sanctioned bulk feed or explicit OK before large crawl. Unverified: how soon ids appear after filing, and gaps/non-permit ids in the sequence.
3. Map new ids to permit numbers: detail shows "Permit Number" only once issued; the ref code on the page matches BLDS `link`, giving a second key.

Code enforcement: Socrata `u6yx-v2tw` (cases), `3ehi-je3s` (violations), `uh5a-f7uw` (inspections), `44ct-56tr` (hearings), pulled nightly by `caseid`/`caseno`; there is no known per-case One Stop page for modern cases (Incident type only yielded 2004-era LAMA records in my samples; not exhaustively tested).

## Join keys
- **Permit number** (`YY-NNNNN-CODE`, e.g. `26-30446-RENO`; legacy `06ELC-30362`, `10BLD-05574`). Same string in rcm3 `numstring`, BLDS `permitnum`, code-enforcement `lastpermit`, detail page. Best key between permits and cases. Not in Socrata for all legacy numbers (`10BLD-05574` not found in either permit dataset).
- **Reference code** (6-char) = BLDS `link` = detail page "reference code".
- **One Stop internal id** = `SummaryContent id` (only on the page URL; no Socrata dataset exposes it).
- **Case number** (`26-11902-MPM`, legacy `09-002855`) and numeric `caseid` link cases, violations, inspections, hearings.
- **Parcel**: permits `pin` is the Assessor tax bill number in two formats (`39W401319`-style and 9-digit numeric `614225802`); detail page labels it "Parcel Tax Bill Numbers" and adds Lot/Block. Code-enforcement `geopin` is an 8-digit number (e.g. 41125104, 41017692) which is a different keyspace. So permits.pin and cases.geopin do NOT join directly; need a crosswalk (Assessor / parcel layer / address-point `hfvu-md72` joinid/siteaddid) or address matching. Mapping to GEOPIN is unverified.
- **Address strings** are free-form: `1125 Tennessee St, 1125 Tennessee Street`, `4223 Prytania St -Apt 2B`, `5415-5417 Elysian Fields Ave`, `7014 Lake Kenilworth Dr Apt U106`. Need normalization; ranges and unit suffixes common.
- **Lat/lon** present on rcm3 (`location_1`) for most rows, a possible spatial join to parcel polygons.

Linked samples (see samples dir): permit `25-32834-DEMO` (rcm3 pin 39W212818 at "1125 Tennessee St, 1125 Tennessee Street") <- case `26-11910-MPM` (lastpermit, geopin 41125104, same address); `22-27999-FGAS` (pin 39W719702) <- case `26-11909-MPM` (geopin 41091360); `25-27798-SERV` has NO pin in either permit dataset but case `26-11907-MPM` has geopin 41017692 (same address 1900 Dumaine St); `10BLD-05574` missing from both permit datasets.

## Data quality issues seen
- `pin` null on ~10% of permits since 2024 (rcm3 43,583 of 48,331 non-null; BLDS 73,831 of 82,802), more for non-address work types.
- Two pin formats in one column; pin vs geopin mismatch (above).
- New code cases have no geopin until inspected/geocoded (case 26-11902-MPM: geopin null, xpos/ypos -1.0; overall ~99% non-null for 2024+: 13,708 of 13,846).
- `currentstatusdate` max is 2026-11-14 (future-dated next-step dates in `statusdate`), so do not use it as a freshness watermark; use `:updated_at`/`filingdate`.
- Multiple addresses concatenated in one field; BLDS has 466k rows vs rcm3 349k (BLDS is 1 row per permit/contractor-ish; 466,092 distinct permit numbers, so rcm3 omits ~117k permits or its range differs; unverified which).
- Early rcm3 rows (2015) lack `filingdate`, so null-first ordering surfaces them on `order by filingdate desc` without a `where`.
- Detail page comment text is double-HTML-escaped (`&amp;#39;`); "Permit Number: Not Issued -->" has stray markup.
- Socrata SODA intermittently returned "internal-error" for some aggregate queries (count of a location column, combined multi-aggregate select); retry/simplify.
- Privacy: detail pages contain owner names, and legacy imports have owner mailing address/phone. Decide policy before republishing.

## Open questions
- Do the five Dashboard reports offer anything beyond Socrata (e.g., inspection events in Permit Activity)? Needs a manual browser download (POST).
- Is a sanctioned bulk/API feed available (ask onestopapp@nola.gov)? Is there rate limiting/WAF behavior at higher volume? Not tested (only ~40 requests).
- ID sequence density and delay between filing and appearance of an id; do ids exist for non-permit types in the same space (id spaces per `type` unverified except as sampled).
- Which `type` values exist for modern violations/licenses on SummaryContent (`License`? `Violation` returned empty for id=1000).
- What explains BLDS vs rcm3 row-count difference and BLDS update cadence.
- Whether registered Advanced Search (date-range) is permitted for automation; I did not register.
- Crosswalk from permit `pin` (tax bill number) to code-enforcement `geopin` and to the parcel layer.
- Basic search POST behavior and pagination (not exercised).
