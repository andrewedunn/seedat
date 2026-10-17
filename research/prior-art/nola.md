<!-- ABOUTME: Prior-art review of New Orleans property/permit tools for See Dat. -->
<!-- ABOUTME: Produced by a research subagent; verified separately. -->

# Prior art: New Orleans property / permit tools

Research date: 2026-10-17. Method: web search + single polite page fetches only (no logins, no forms). Several pages are summarized by a fetch model, so details are second-hand; treat as needing spot-checks. Reddit was blocked to our tooling, so no direct r/NewOrleans evidence (UNVERIFIED).

## 1. One Stop App (City of New Orleans)
- URL: https://onestopapp.nola.gov (About: /About.aspx; license view: /LicView.aspx)
- Serves: applicants/contractors (apply, pay, track) and the public (lookup).
- Does well: single front door for 17 departments' permits, licenses, planning projects, violations. Public search without registration by permit/ref number, street address (house number + street only), or contractor/applicant name. Document download without login. (Sources: https://onestopapp.nola.gov/About.aspx, https://nola.gov/search-permits/, https://nola.gov/do-i-need-to-register-to-use-the-one-stop-app/)
- Falls short: Advanced Search (by description keyword, council district, case type, status, filing date) requires login per city FAQ. Export cap ~200 records; city itself sends power users to the open data portal. Address search is literal ("house number and street only"). No map, no cross-record property view, no plain-English summary. No stated data refresh or historical range. Status check pages push login.
- Maintained: yes, live; no replacement announced as of my search (2025 coverage still describes One Stop as the tool). No evidence of an API.
- Borrow: record types and status vocabulary; its pain points are our feature list. Fallback "public records request" path (nola.nextrequest.com) shows what isn't covered.
- Sources: https://nola.gov/where-can-i-find-more-information-or-information-thats-not-available-at-the-one-stop-app-1/

## 2. Property Viewer (property.nola.gov) and Where Y'At
- URL: https://property.nola.gov ; info page https://nola.gov/next/city-planning/topics/property-viewer/
- Serves: public, planners, buyers.
- Does: parcel map, zoning districts/boundaries, site-specific zoning actions (conditional uses, PDs), historic/conservation districts; search by address, owner, tax bill ID. Data from Assessor + city Enterprise GIS; search snippet says weekly refresh. "Where Y'At" returns zoning/district/service info by address.
- Falls short: city page does not mention permits, code enforcement or STR layers (so no property-centered timeline). Disclaimer: not survey-quality, no warranty. The info page shows no refresh schedule (page dated 3/15/2023).
- Direct fetch of property.nola.gov failed (TLS cert error from my tooling): UI details UNVERIFIED.
- Borrow: the underlying ArcGIS REST services are public: https://maps.nola.gov/server/rest/services/LandUsePlanning/Land_Use_Planning_Layers/MapServer and https://gis.nola.gov/arcgis/rest/services/LandBase/Parcels/MapServer (found via search). Good for parcel/zoning/HDLC geometry and PIN-based joins. License terms for these services: UNVERIFIED.

## 3. City open data portal (data.nola.gov, Socrata)
- Not a "tool" but the real substrate. Datasets found (via data.gov mirrors): Permits (nightly), Permits - BLDS (from 2012, BLDS standard), historic Accela permits 2004-2012, Code Enforcement All Inspections (CC0), Code Enforcement Active Pipeline (cases since 2009, O/C open flag), Code Enforcement Districts, Historical Inspection Requests (stale, last Jan 2017), Active Short-Term Rental Licenses, STR permit applications (CC0), Non-commercial STR licenses, Map of STR applications.
- URLs: https://data.nola.gov/Housing-Land-Use-and-Blight/Active-Short-Term-Rental-Licenses/ufdg-ajws ; https://data.nola.gov/Housing-Land-Use-and-Blight/Map-of-Short-Term-Rental-Licenses/j5u3-2ueh ; https://catalog.data.gov/dataset/code-enforcement-all-inspections ; https://catalog.data.gov/dataset/permits-blds
- Caveats: license field blank on some datasets (active STR licenses); STR application map mixes denied/expired/pending, so must filter to Issued. 311/911 and hearing datasets NOT confirmed in my search (UNVERIFIED; check separately). Full-text and per-dataset update cadence needs verification against Socrata metadata.
- Borrow: Socrata SODA API + BLDS schema as canonical permit model.

## 4. City STR registry and STR Verification
- Registry page: https://nola.gov/next/short-term-rental-administration/topics/registry-of-short-term-rentals/ (maps of active STRs, all applications, NSTR licenses, plus data.nola.gov datasets). Page last-updated stamp 9/3/2024; no refresh schedule; terms (active/NSTR) undefined.
- No public address-lookup box for "is this address a legal STR" found; closest are the GIS map/dataset and One Stop (older STR records show expired).
- https://verifystr.nola.gov: API for platforms only (Platform License + API key). Not public.
- Rules context (WWNO, Feb 2025): ~2,500 licenses as of 2/23/2025; Inside Airbnb counted >7,000 listings; lawsuits pending. https://www.wwno.org/local-regional-news/2025-02-25/explaining-new-orleans-short-term-rental-saga
- Note: the STR page said NSTR licenses expire June 30, 2026 (per search summary); current renewal state UNVERIFIED.

## 5. BlightStatus (Code for America, 2012)
- Built by CfA fellows with the city; launched 2012-10-11. Aggregated inspections, complaints, hearings, judgments, foreclosures per address; watchlist with alerts; daily updates. https://siliconbayounews.com/2012/10/11/blightstatus-com-launches-today-to-bring-up-to-date-property-information-to-city-residents/ ; https://datasmart.hks.harvard.edu/solutions/blightstatus
- Spun into Civic Insight (startup; Dallas, Atlanta, Sacramento, etc.) per launch coverage (Automation World article).
- Repo: https://github.com/codeforamerica/blightstatus returned 404 via GitHub API (may have moved or been renamed/removed). GitHub search found only `gangleton/blightstatus-waiting-room` (placeholder, 2012, no license) and `mapmeld/HomeStatusSQL` (Node/MySQL port for Macon, GA, 2017, no license). Original repo location and LICENSE: UNVERIFIED. blightstatus.nola.gov did not load (TLS error); status of the live app: UNVERIFIED, likely dead or redirected. The city's BlightStatus demolitions dataset shows last update 2020-11-12 (Baselight mirror), consistent with fade-out.
- Borrow: the concept (one record per address across inspection > hearing > judgment > demolition pipeline, plus watchlist/alerts). Do not assume reusable code; no verified license.

## 6. The Data Center (datacenterresearch.org)
- Serves researchers/advocates. Has "New Orleans Neighborhood Data", Housing Development and Abandonment map, Geographies of Poverty map, Monthly Population Indicators (active addresses by ZIP), "Who Lives in New Orleans" (updated ~2025). No permit, STR or property-event tools found. Neighborhood/aggregate level only. https://datacenterresearch.org
- Borrow: neighborhood-level context stats and active-address occupancy proxy; good partner/credibility. Their blight proxy dataset (HUD "no-stat" addresses) exists on data.gov ("Benchmarks for Blight").

## 7. Newsroom tools
- The Lens (2017-2019): Airbnb permit application map + tracker; "four things we learned" by Charles Maldonado (June 2017, updated Nov 2019). Notes: unmappable applications, address/ZIP-only precision, city citation figures from a spokeswoman not a dataset. Appears frozen (no live tracker found). https://thelensnola.org/?p=55265 ; https://thelensnola.org/?p=55014 ; https://thelensnola.org/?p=54908
- The Lens 2021: STR enforcement stats were first reported wrong due to incomplete records. https://thelensnola.org/2021/04/30/city-presents-short-term-rental-adjudication-numbers-and-process/
- Verite News: STR enforcement and lawsuit coverage (2024-25), no interactive tool found. https://veritenews.org/2024/03/05/judges-order-will-allow-short-term-rental-enforcement-to-restart/
- Gambit: July 2024 STR enforcement report; 2021 "One Stop Shop is a misnomer" piece; Oct 2025 permitting reform coverage (via BGR). Times-Picayune: Aug 2024 analysis of STR exceptions. No standing permit/property tracker found for any outlet (UNVERIFIED beyond my searches).
- WWNO: explainer only.

## 8. Orleans Parish Assessor (nolaassessor.com)
- Property search at https://www.nolaassessor.com/property-search/ (disclaimer gate; data "for tax assessment purposes only"). My fetch returned 403, so feature list UNVERIFIED. Secondary sources say it exposes parcel ID, owner, address, assessed values, land/building area, tax bill number, latest sale date/price/instrument number. Full deed/mortgage/lien history lives with the Clerk of Civil District Court Land Records. https://nolacityarchives.org/property-research/chain-of-title/
- Third-party scraper exists on Apify (unofficial): https://apify.com/recordsdb/new-orleans-parish-tax-assessor . Terms of use on scraping: UNVERIFIED; check before any ingestion, and prefer city GIS parcel layers (which carry Assessor data) first.

## 9. Civic-tech / third-party projects
| Project | What | Last push | License |
|---|---|---|---|
| GarysCorner/NewORleansSTR | folium map of STR license status | 2026-10-13 | none |
| rhc-iv/nola-str-map | Streamlit STR explorer | 2023-08-14 | none |
| kdors/short-term-rentals-dash-app | Dash STR app | 2022-01-31 | none |
| ericnost/NOLA-STR | STR mapping | 2019-11-17 | none |
| gblanchard4/Nola-AirBnB | STR map from data.nola.gov | 2017-05-23 | Unlicense |
- Apify "New Orleans Permits" actor (j0401/nola-permits): wraps data.nola.gov, ~348k records from 2006, pay-per-record, 2 users. https://apify.com/j0401/nola-permits
- PermitMint (permitmint.com/permit-history/new-orleans): SEO-style address permit pages from city data, unofficial. https://permitmint.com/permit-history/new-orleans/
- Code:NOLA 2012 hackathon (OpenBlock for NOLA, hearing-data cleanup); 2017 Hacks/Hackers 911 dashboard. No active Code for New Orleans permit/STR project found. https://siliconbayounews.com/2012/02/15/civic-hackathon-codenola-aims-to-use-technology-to-improve-new-orleans/
- Takeaway: many one-off STR maps, none combine permits + code enforcement + STR + zoning per address; unlicensed repos are not reusable as code.

## Legal hook worth noting
- La. R.S. 33:4778 directs New Orleans Safety and Permits to publish applications, inspections, permits issued/denied/revoked/suspended and demolitions online. https://legis.la.gov/legis/Law.aspx?d=860874 . Compliance level UNVERIFIED. Useful framing and advocacy lever for See Dat.

## User complaints / unmet needs
- Gambit (Oct 2025, via BGR): applicants wait months, some over a year; Council Member Oliver Thomas cited nine months for relatives; State Rep. Matthew Willard called for an online dashboard of when permits were requested and received. https://www.bgr.org/?p=20589
- Gambit 2021: One Stop Shop called a misnomer; contradictory advice from different staff. (same BGR page)
- Fox 8 (Mar 2025): task force (Aug 2023) recommended more transparency; member Frank Morse said little has changed; Errol Williams: "There's nobody in charge." https://www.fox8live.com/2025/03/10/despite-task-force-recommendations-new-orleans-permitting-process-remains-dysfunctional/
- Safety & Permits Director Tammie Jackson blames incomplete applications (BGR page), i.e. a status/checklist visibility gap.
- WWNO/Gambit: STR office understaffed, hearings not held; enforcement reputation lax; residents can't easily tell legal from illegal STRs. https://www.wwno.org/local-regional-news/2025-02-25/explaining-new-orleans-short-term-rental-saga
- The Lens (2017): couldn't map exact STR locations; counts didn't reveal outcomes. https://thelensnola.org/?p=55265
- Reddit r/NewOrleans threads: NOT FOUND (domain blocked to tools). UNVERIFIED. Council testimony about missing-lookup complaints: not found.

## Gaps in NOLA
- No single address page joining permits, inspections, code enforcement case/hearing stage, STR license, zoning/HDLC, and block-level 311/911.
- One Stop: no map, literal address matching, login-gated advanced search, 200-row export cap, no status-timeline narrative.
- BlightStatus is effectively gone with no verified reusable code; no successor watchlist/alerts.
- STR: no public "is this address legal?" lookup; maps lack defined terms and refresh dates; Lens tracker frozen.
- Open data exists (permits nightly, code enforcement, STR) but is raw, mixed-status, with blank/unclear licenses on some datasets.
- No plain-English summaries, no HDLC rule explanations, no API/MCP for agents (the only API, verifystr, is platform-only).
- No active civic-tech group maintaining a permit tracker; newsroom tools are one-offs.
