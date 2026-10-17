<!-- ABOUTME: Prior-art review of property/permit tools in other cities for See Dat. -->
<!-- ABOUTME: Produced by a research subagent; verified separately. -->

# Prior art: property and permit tools in other cities

Research date: 2026-10-17. Repo metadata (license, last push) was pulled live via the GitHub API on that date. Web-search claims are marked as such. Anything I could not confirm is marked UNVERIFIED. "No license" means GitHub reports none, which legally means all rights reserved, not free to reuse.

---

## 1. Philadelphia: Atlas + AIS + Passyunk

**URL:** https://atlas.phila.gov (code: https://github.com/CityOfPhiladelphia/vue3-atlas)
**Serves:** Residents, owners, buyers, city staff. Launched Nov 2017 after about 3 years of work by the CityGeo team (PhillyVoice, GovTech, Harvard DataSmart).
**Does well:**
- One search box accepts address, intersection, OPA account number, or Dept. of Records registry-map number, or a click on a parcel.
- It shows licenses, permits, violations, inspections, zoning history, assessments, and nearby 311 (phila.gov service page).
- The identifiers are the strong part. Every record hangs off the address and its linked parcel IDs.

**Falls short:** I found no public user complaints or reviews (searched once; UNVERIFIED either way). The AIS API is "internal use" and needs an emailed key (AIS docs).
**Maintained:** Yes. vue3-atlas was pushed 2026-10-15, AIS 2026-09-04, Passyunk 2026-09-21. The older `mapboard` repo is archived and replaced by vue3-atlas. Atlas, AIS, and Passyunk all have **no license** on GitHub.

### AIS (Address Information System): the address-matching model to study
Repo: https://github.com/CityOfPhiladelphia/ais. Docs read: `docs/APIUSAGE.md`, `README.md`.

- **Purpose.** AIS is the single address-to-everything layer. Its goals are to standardize addresses citywide, geocode, and surface where the city's departmental datasets disagree, so the departments can fix them. That feedback loop is the idea worth copying.
- **Two-step design.** The address parser/standardizer is a separate library (Passyunk). AIS builds a database in nightly or batch "engine" scripts, loads it into Postgres, and serves it from a Flask API. Scripts in `ais/engine/scripts` include `load_opa_properties`, `load_pwd_parcels`, `load_dor_parcels`, `load_dor_condos`, `load_ng911_address_points`, `load_streets`, `load_street_aliases`, `load_zip_ranges`, `load_curbs`, `geocode_addresses`, `make_linked_tags`, and `make_address_summary`.
- **Parcels are many-to-many with addresses.** Philadelphia has three competing parcel layers: PWD (water), DOR (deeds), and OPA (assessor account). An address row carries `pwd_parcel_id`, `dor_parcel_id`, and `opa_account_num`, plus `opa_address` (the assessor's official address) and `opa_owners`. Lookups work by any of these keys too (`exact_key` match). New Orleans has an equivalent split (assessor, Safety & Permits, utility, NORA/lot data), so this applies directly.
- **Query type detection.** `/search` classifies the query as address, block ("1200-1299 block of Market St"), intersection, OPA account, registry map, pwd_parcel_id, coordinates, or owner, then routes it. The response includes `search_type`.
- **Explicit `match_type` on every result.** Values are `exact`, `generic_unit` (APT/UNIT/#/STE interchanged), `in_range`, `overlaps`, `range-parent`, `has_base_in_range`, `has_base_overlaps`, `in_range_unit_child`, `range_parent_unit_child`, `exact_location` (reverse geocode), and `exact_key`. The caller always knows how it matched. More than one result can be `exact`.
- **Ranged addresses.** Philly has "1608-16 Poplar St" style ranges. AIS stores `address_low`/`address_high` and models range parents and unit children. New Orleans has the same issue (doubles, "1234-36", rear and upper units, fractions), so we need a range-aware model.
- **Several geocode locations per address, with a ranked `geocode_type`.** The types are `pwd_parcel`, `dor_parcel`, `pwd_curb`, `dor_curb`, `pwd_street`, `dor_street`, `true_range`, and `full_range`. Flags (`on_curb`, `on_street`, `parcel_geocode_location`) let the caller choose. Parcel geometry wins when available, and centerline interpolation is the fallback. The docs list centroid, projected-on-curb, and projected-on-street variants for map pins, and say true-range and full-range interpolation also cover addresses missing from DOR or PWD records.
- **Reverse geocode** finds the nearest address, with a default 300 ft radius, 10,000 ft max.
- **Units.** `include_units` returns condo and apartment units under the top-level property. `opa_only` filters to assessable properties.
- **Output** is paginated GeoJSON.
- **License:** none. Treat AIS as a design reference, not code to copy.

### Passyunk (parser/standardizer): https://github.com/CityOfPhiladelphia/passyunk
- It is **rule-based and driven by a street centerline file** (`centerline.csv`, `centerline_streets.csv`). It parses to a components dict, including `street.parse_method` (e.g. "CL1"), `is_centerline_match`, `street_code`, `cl_seg_id`, and `cl_addr_match`. The parse also returns `address` (low, high, parity, fractional, suffix), `address_unit`, `floor`, and a USPS-style `mailing` block (zip4, match description). `base_address` and `output_address` are the canonical keys.
- **Notable idea:** the standardizer validates the street name against the authoritative street list as part of parsing, rather than guessing and checking later. The README lists this data as public and versioned with tags (`1.x.0`). Private monthly data (USPS) is in a separate package.
- **License:** none stated. Treat as reference only.

**Worth borrowing:**
- The `match_type` vocabulary.
- Multiple parcel IDs per address.
- Block and intersection query types.
- Range and unit parent/child modeling.
- Treating mismatches between datasets as a product output.
- Rule-based parsing against the authoritative street list.

---

## 2. NYC: Geosupport, PAD, GeoSearch, ZoLa, DOB, HPD, NYCDB, Who Owns What, DAP

### Address matching in NYC (the strongest model for us)
- **Geosupport** is DCP's official geocoder. It parses, validates, and maps address to **BBL** (borough-block-lot) and **BIN** (building ID). Its authoritative table is the **Property Address Directory (PAD)**. JustFix's pipeline runs Geosupport via the `python-geosupport` wrapper (https://github.com/NYCPlanning/python-geosupport, MIT, last push 2024-07) to standardize landlord business addresses (`portfoliograph/standardize.py`, read). Geosupport itself is a free download from DCP (UNVERIFIED: exact license terms, I did not read them).
- **NYC GeoSearch** (https://geosearch.planninglabs.nyc, docs repo https://github.com/NYCPlanning/labs-geosearch-docs, license NOASSERTION) is the typeahead API for ZoLa and other apps. It is **Pelias** loaded with PAD. The key trick is in https://github.com/NYCPlanning/labs-geosearch-pad-normalize: PAD stores address *ranges*, so an R script **expands ranges into discrete address rows** that Pelias can index. The `bbl` and `bin` ride along in `addendum_json_pad` with a `version`, so every API response says which PAD release produced it. Last push 2026-08-21, no license.
- **The ID is the contract.** Everything downstream is keyed on BBL. Address search is a front door whose only job is to return a BBL. The Who Owns What (WoW) server API takes BBLs and does no address matching. `wow/views.py` (read) shows endpoints `address_query`, `address_aggregate`, and so on, all keyed by a validated 10-digit padded BBL, and the React client (`AddressSearch.tsx`) calls GeoSearch first.

**Worth borrowing:** Make our own canonical property key the primary identifier, and put address search in front of it as a thin typeahead service. Expand ranges into discrete rows. Stamp every response with the dataset version.

### ZoLa: https://zola.planning.nyc.gov (https://github.com/NYCPlanning/labs-zola)
- **Serves** residents, developers, planners, and the press. Search an address or lot, click a parcel, and see zoning, land-use history, proposals, and layers on one map.
- **Does well:** Strong map layer toggles and parcel highlight. The popup is a short list of facts with links to the source.
- **Maintained:** Pushed 2026-09-18, Ember.js SPA.
- **License:** the LICENSE file says public domain within the US plus CC0 1.0 worldwide. GitHub shows NOASSERTION because the file is a custom text. **This is the most reusable front-end here.**
- **Short on:** Zoning only. No permits, inspections, or enforcement.

### NYC DOB BIS / DOB NOW, HPD Online
- **UNVERIFIED** (I did not fetch these pages). Knowledge-based summary: DOB BIS is the legacy per-property record, with applications, permits, violations, and complaints under one BIN or BBL. DOB NOW is the newer filing system, and records are split across both, so the old and new histories do not link cleanly. HPD Online adds violations, registration, and complaints.
- **Lesson to verify:** Several systems with different keys per property is exactly the pain See Dat should remove.

### Who Owns What (WoW): https://whoownswhat.justfix.org (https://github.com/JustFixNYC/who-owns-what)
- **Serves** tenants, organizers, and lawyers. Search an address and see the landlord's "portfolio" of buildings.
- **Does well:** The portfolio comes from linking HPD registration records by shared names and addresses (Shelterforce and Planetizen coverage, 2022, and the About page). Building count was 170,000+ in 2022 and 200,000+ now. Each building gets violation and complaint counts, plus a plain-language methodology page and a "how to use" page (client/src/containers: `Methodology.tsx`, `HowToUsePage.tsx`). It has building alerts and district alerts, plus a tool for non-registered buildings.
- **Matching approach:** The repo has `portfoliograph/` (a graph of buildings joined via landlord index, with `graph.py`, `landlord_index.py`, and `standardize.py`) and `signature/` (a table-building pipeline). The exact matching rules are in code and the Methodology page (UNVERIFIED in detail, not fully read). The two steps visible are (1) standardizing landlord business addresses via Geosupport and (2) graph-connecting registrations that share a standardized name or address.
- **Short on:** It depends on a registration system that New Orleans may not have (HPD registration is a NYC rule). Owner linking is also contentious: false positives link unrelated people, so the methodology page carries caveats.
- **Maintained:** Pushed 2026-09-25. **GPL-3.0.** Copying code would make See Dat GPL-3.0, so this is a design reference unless we want that.

### NYCDB: https://github.com/nycdb/nycdb
- A Python tool that downloads, cleans, and loads about 30 NYC housing and land datasets (PLUTO, DOB filings, complaints, violations, certificates of occupancy, HPD violations, litigation, registrations, and others) into Postgres. The README states the mission as helping volunteers support tenants.
- **Maintained:** Pushed 2026-10-15, 269 stars. **AGPL-3.0**, which is strong copyleft including network use.
- **Worth borrowing:** One YAML-style schema file per dataset, a wiki page per dataset (`Dataset:-...`), and a loader for the Kubernetes job (https://github.com/JustFixNYC/nycdb-k8s-loader, no license). The per-dataset documentation pattern is the best habit in this whole survey.

### ANHD DAP Portal: https://portal.displacementalert.org
- **Serves** organizers and council offices. Has Property Lookup, District Dashboard, and Custom Search across dozens of datasets, updated daily (ANHD pages, via search).
- **Does well:** Combines a single-building history with a district roll-up and a custom query. A risk score per building (3 indicator groups, 0 to 300 scale) was published in the DAP Map (Next City).
- **Open code:** I did not find the repo (UNVERIFIED). The old `ANHD-NYC/anhd-council-backend` name returned 404.
- **Lesson:** A score is a product choice that needs careful framing. See Dat should avoid scoring people's homes.

---

## 3. Chicago Cityscape: https://www.chicagocityscape.com
- **Serves** developers, brokers, architects, journalists, and residents. Searching an address produces a **Property Report**. Help pages: `help.chicagocityscape.com/findpermitsaddress`, `/propertyhistory`, `/welcomeguide` (via search).
- **Does well:**
  - Permits back to 2006 and violations back to 2001, refreshed each morning.
  - Fields per permit: number, type, description, cost (applicant-reported and labeled as such), application and issue dates, **processing time**, contractor names by role, coordinates.
  - **Fallback behavior:** if the exact address has no permits, it shows permits within 1/8 mile (a city block) and says so.
  - Pending permits get a separate tab.
  - Contractor and developer profiles and rankings (counts and dollar value by company).
  - Place Reports combining 50+ datasets.
  - A "play permits" feature (animation over time).
- **Falls short / business model:** Most information requires a free account. Paid tiers exist (Real Estate Pro; the pricing sources conflict, UNVERIFIED). API pricing is unclear.
- **Maintained:** Active. The blog and help site are current (blog "turns 6" post and an ongoing help site). Closed source.
- **Worth borrowing:** Processing time as a first-class number, "permits near here" fallback, contractor profiles, labeling self-reported values, and the idea that a free resource can be the better public alternative.

---

## 4. Other cities

| Tool | URL | Notes |
|---|---|---|
| **BlightStatus (New Orleans, 2012)** | Code for America; spun out as Civic Insight | Built in New Orleans. Aggregated inspections, code complaints, hearings, judgments, and foreclosures per address. Spun into the for-profit Civic Insight (Lincoln Institute "City Tech" piece, NFOIC, GovTech). I could not confirm whether it is still live. The open-source repos I guessed (`codeforamerica/blightstatus`) returned 404, so UNVERIFIED. A 2017 Macon, GA port exists: `mapmeld/HomeStatusSQL`. **Most relevant local prior art.** Find out what users made of it and why it faded. |
| **SF Property Information Map** | https://sfplanninggis.org/PIM | Planning Dept. Search by parcel (block/lot), application, permit, or address. Shows zoning, permits, and other records together. Has a "Link" button that creates a shareable link to a property report, and the data is on data.sfgov.org. 2011 SocketSite coverage was mostly positive. Disclaimer says no guarantee of accuracy. Maintenance and license UNVERIFIED. |
| **LA ZIMAS** | zimas.lacity.org | Not researched (search returned nothing). UNVERIFIED. |
| **Boston** | Analyze Boston, gis.boston.gov | Parcels are published as annual layers (Parcels 2020 to FY24). **Ownership is not in the map layer.** You join the Property Assessment CSV on `MAP_PAR_ID` and `GIS_ID`. Annual snapshots, not continuous. Boston Maps and ISD permit tools not reviewed. |
| **Pittsburgh: Parcels N'At (WPRDC)** | https://www.wprdc.org/en/projects/ParcelsNAt | Launched July 8, 2025 (City of Pittsburgh release). Property Dashboard gives an integrated view: assessments, appeals, sales, foreclosures, tax liens, and for city parcels permits and code violations. Includes a custom parcel download. Apps repo `WPRDC/wprdc-apps` is **AGPL-3.0**, pushed 2026-10-08. I did not confirm that the dashboard lives in that repo (UNVERIFIED). The older `WPRDC/parcels-n-at` repo has no license and is stale (2017). |
| **Cleveland NEO CANDO** | https://neocando.case.edu | Case Western Poverty Center. Parcel-based integrated data system for Cuyahoga County. Absorbed CleveInfo. Property Data Portal and "Neighborhood Strategy Technology" web app. Note that it serves institutions and nonprofits more than residents. Maintenance current but UNVERIFIED. |
| **Detroit / Motor City Mapping / Loveland** | Data Driven Detroit; Loveland Technologies | 2013-14 survey of every Detroit parcel by phone app ("blexting"), by Loveland + Data Driven Detroit for the Blight Removal Task Force. Public data release, aggregated by census tract. I found **no** evidence the software was open-sourced (UNVERIFIED). **Lesson:** field-collected condition data is something the city's records can't provide. |
| **Austin** | `cityofaustin/atd-data-tech` (no license, active 2026-10-16) | Issue tracker for the city's transportation data tech, not a property tool. Real Austin permit tools not reviewed. UNVERIFIED. |
| **Seattle, Baltimore** | n/a | Not researched. |

I found no mature, open-source "permit tracker" or "address page" project on GitHub. Search results were small commercial or hobby projects (e.g. `crashtack/building_permits_django`, MIT, stale 2017; `ml-lubich/permit-tracker`, no license). The field is sparse.

---

## 5. Address-matching toolkit (depth)

| Tool | What it is | License | Last push | Fit for See Dat |
|---|---|---|---|---|
| **usaddress** https://github.com/datamade/usaddress | Probabilistic (CRF) parser that tags components of free-form US addresses | MIT | 2025-08-07 | Good first-pass tokenizer for messy input. **Does not normalize or validate** (its README says so). Pair with usaddress-scourgify (MIT, 2026-08-07) or our own normalizer. |
| **libpostal** https://github.com/openvenues/libpostal | C library, statistical parser + normalizer trained on OSM/OpenAddresses, international | MIT | 2026-05-13 | Strong normalization (abbreviation expansion yields many variants for matching). Heavy: about 2 GB of model data, C build. Bindings: pypostal (MIT, 2025-11), `pelias/libpostal-service` (MIT). |
| **Pelias** https://github.com/pelias/pelias | Open geocoder on Elasticsearch, with importers for OpenAddresses, OSM, CSV, WhosOnFirst | MIT | 2026-07-24 | What NYC GeoSearch runs. Good for typeahead. Heavy to host (Elasticsearch plus many services). `pelias/parser` (MIT) is a pure-JS alternative parser. |
| **OpenAddresses** https://github.com/openaddresses/openaddresses | Aggregated government address points; sources are per-jurisdiction | BSD-3-Clause for the repo (data license varies per source) | 2026-10-15 | Check the source file for New Orleans; the city's own address data is likely better. |
| **probablepeople** https://github.com/datamade/probablepeople | Parser for personal and company names | MIT | 2025-05-15 | For owner-name normalization. |
| **dedupe** (MIT, 2025-07-29), **splink** (MIT, 2026-10-16) | Record linkage libraries | MIT | recent | For fuzzy owner and entity linking. Splink is the more active one. |
| **python-geosupport** | NYC-only wrapper | MIT | 2024-07 | Not usable outside NYC, but it is the pattern. |

**Approach comparison:**
1. **Authoritative-list-first (Philly Passyunk, NYC Geosupport).** Parse against the known street list, then match to a known address point. Highest precision. Needs a good authoritative address table. NOLA has one (city address points; UNVERIFIED which dataset).
2. **Statistical parse + fuzzy (usaddress, libpostal).** More forgiving of typos. Use when the street list can't resolve it, and then require confirmation.
3. **Geocode-and-snap.** Fall back to coordinates and nearest parcel (AIS reverse geocode, 300 ft radius).

**Recommended hybrid for See Dat** (my judgment):
- Normalize with a rule-based pass against the NOLA street list, falling back to usaddress/libpostal for hard cases.
- Match to an address table that carries parcel IDs.
- Return a `match_type` and a confidence with every match.
- Record unmatched or ambiguous rows to a review table.

---

## 6. What users wanted and didn't get

I found very little first-hand user feedback in search. These points are inferences from tool design, not user quotes:
- **Single source of truth per property**: Atlas's whole premise was that departments' systems didn't link (GovTech, PhillyVoice).
- **Plain-language explanations**: WoW's Methodology and How-to pages exist because users misread data.
- **Who owns it**: Owner/landlord linking is what tenants want most (WoW coverage).
- **Pre-2006 or pre-system history** is the usual gap. Chicago Cityscape sends users elsewhere for older records.
- **Staleness**: SocketSite commenters complained about out-of-date data on third-party property sites.
- **Boston** forces users to join separate CSVs to get an owner name.

Searches for Reddit and forum threads were not run (UNVERIFIED gap).

---

## Patterns to borrow

1. **A canonical property key with address search as a thin front door** (NYC BBL; Philly's parcel and OPA IDs). Every dataset joins to the key, not to address text.
2. **Explicit `match_type` and confidence on every match**, using Philly's vocabulary (exact, generic_unit, in_range, overlaps, exact_key, exact_location).
3. **Many-to-many address and parcel links**, plus ranges and units as parent/child rows. Expand ranges into discrete rows (NYC PAD normalizer).
4. **Multiple geocode locations per address, ranked** (parcel centroid, curb, street, interpolated range).
5. **Query-type routing**: address, block, intersection, parcel ID, permit number, coordinates, and owner in one search box.
6. **Mismatch reports as a feature**: tell the city where its datasets disagree (AIS goal).
7. **Dataset version stamps in every API response** (GeoSearch `version`).
8. **One documentation page per dataset** (NYCDB wiki pattern), plus a plain-language Methodology page (WoW).
9. **Permit timeline with processing time**, labeled self-reported cost, contractor profiles, and a "nearby" fallback when an address has no records (Chicago Cityscape).
10. **Shareable permalink for a property report** (SF PIM "Link").
11. **Field-collected condition data** as a layer the records can't provide (Detroit).
12. **Avoid** per-building risk scores and unexplained owner-linking; if owner linking ships, publish rules and let people report errors.

## Open source to build on (with licenses)

| Project | License | Use |
|---|---|---|
| NYCPlanning/labs-zola | CC0 / public domain (custom LICENSE file; GitHub shows NOASSERTION) | Map/parcel-popup UX; Ember, so likely UX reference only |
| pelias/pelias, pelias/parser, pelias/libpostal-service, pelias/openaddresses | MIT | Typeahead geocoder if we want self-hosting |
| openvenues/libpostal, pypostal | MIT | Address normalization/variants |
| datamade/usaddress, probablepeople | MIT | Address and name parsing |
| GreenBuildingRegistry/usaddress-scourgify | MIT | Normalizing usaddress output |
| moj-analytical-services/splink, dedupeio/dedupe | MIT | Fuzzy owner and entity linking |
| openaddresses/openaddresses, batch-machine | BSD-3 / ISC (data license per source) | Address point data and tooling |
| NYCPlanning/python-geosupport | MIT | Pattern only (NYC-specific) |
| nycdb/nycdb | AGPL-3.0 | Design reference; copying code forces AGPL |
| JustFixNYC/who-owns-what | GPL-3.0 | Design reference; copying code forces GPL |
| WPRDC/wprdc-apps | AGPL-3.0 | Design reference (relevance UNVERIFIED) |
| CityOfPhiladelphia/ais, passyunk, vue3-atlas | **No license** | Read for ideas only; do not copy code |
| NYCPlanning/labs-geosearch-pad-normalize, labs-geosearch-docker, labs-geosearch-docs | No license / NOASSERTION | Read for ideas only unless a license is confirmed |

## Sources
- GitHub API metadata (live, 2026-10-17) for all repos above; file contents read: AIS `README.md` and `docs/APIUSAGE.md`, Passyunk `README.md`, `labs-geosearch-pad-normalize` README, `labs-geosearch-docs` README, `who-owns-what` README, `wow/views.py`, `portfoliograph/standardize.py`, `nycdb` README, `labs-zola` README and LICENSE, `usaddress` README.
- https://atlas.phila.gov, https://phillyvoice.com/meet-atlas-phillys-revamped-all-one-property-search-tool, https://govtech.com/fs/data/Philadelphia-Builds-All-In-One-Property-Mapping-Tool.html, https://datasmart.hks.harvard.edu/solutions/atlas
- https://whoownswhat.justfix.org/en/about, https://shelterforce.org/2022/03/24/how-hidden-property-owners-and-bad-landlord-patterns-are-revealed-in-nyc/
- https://help.chicagocityscape.com/findpermitsaddress, https://www.chicagocityscape.com/pricing.php
- https://sfplanninggis.org/PIM/help.html, https://socketsite.com/archives/2011/04/the_san_francisco_property_information_map_scoop.html
- https://www.wprdc.org/en/projects/ParcelsNAt, https://neocando.case.edu/about-neocando.html
- https://www.lincolninst.edu/publications/articles/city-tech-3/, https://www.govtech.com/archive/New-Orleans-Launches-Blighted-Property-Web-App.html
- https://anhd.org (DAP pages), https://nextcity.org/urbanist-news/nyc-dap-map-displacement-risk-anhd
- https://smartchicagocollaborative.org/loveland-helps-map-out-detroits-vacant-properties, https://modeldmedia.com/jerrypaffendorf1/
- https://gis.boston.gov/arcgis/rest/services/Parcels/Parcels20/MapServer/info/iteminfo
