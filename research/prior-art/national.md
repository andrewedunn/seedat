<!-- ABOUTME: Prior-art review of national/commercial permit and parcel data products for See Dat. -->
<!-- ABOUTME: Produced by a research subagent; verified separately. -->

# National and commercial permit/parcel products: prior art

Method: two passes (about 35 searches and page fetches total, Oct 2026). "Fetched" means read from a primary page or the live data.nola.gov API. Anything else came from search summaries or vendor marketing and is marked UNVERIFIED where it matters. No logins or signups.

## Headline finding
The City of New Orleans already publishes, under CC0, a nightly BLDS-format permits dataset, an inspections dataset, code enforcement cases, and several STR datasets. The national products mostly resell or re-normalize this same upstream data. Their edge is cross-city normalization and contractor entity resolution, which matters little for a single-city tool. For New Orleans the opening is joining the city's own datasets by address and parcel and exposing them to agents.

## 1. Shovels (shovels.ai)
- **New Orleans coverage: NOT CONFIRMED.** The /coverage page (fetched) is a JS map; its jurisdiction count and "data pulled" fields were blank, with no jurisdiction list in the text. The API docs on shovels-v2.redoc.ly are behind a Redocly login. No New Orleans or Orleans Parish mention found anywhere. UNVERIFIED.
- Scale claims (marketing, mutually inconsistent): 170-178M permits; 1,800, 2,000 or 2,770 jurisdictions (a "20,000+ jurisdictions" figure appears to be the size of the US universe, not coverage); ~85% of US population; ~3.65M contractor profiles. All UNVERIFIED.
- Freshness: one API listing says refresh on the 1st and 15th of each month (UNVERIFIED). Contrast with the city feed, nightly.
- Pricing (fetched): Free $0 = 500 credits/month, 1 year of history, 10 results per query, no downloads, 1 seat. Basic $599/mo (25k credits, full history, downloads). Pro $999/mo (50k credits, 2 seats). Enterprise custom. Datasets named on the page: Permits, Decisions, Properties, Residents, Contractors, Employees.
- Inspections: pricing and coverage pages do not mention them. Third-party write-ups claim inspection outcomes and timelines are standardized and exposed as contractor pass rates (UNVERIFIED).
- Entity resolution (marketing claims): maps to a common schema; an AI pipeline tags permits with 20+ work tags (SOLAR, ELECTRICAL, REMODEL...); resolves contractors and properties across inconsistent spellings; attaches Regrid IDs so a permit joins to parcel/owner (Sacra). Method unpublished.
- Delivery: web app, API, Snowflake/BigQuery/Databricks. Cherre lists Shovels as a vendor on its marketplace.
- Verdict: closest conceptual competitor; free tier unusable for a public site; terms bar redistribution (UNVERIFIED but standard). Borrow: work-type tags, contractor-as-entity with alias list, parcel ID as join key.

## 2. BLDS (Building and Land Development Specification)
- Home: permitdata.org; spec in the GitHub wiki at github.com/open-data-standards/permitdata.org (the opencounter/blds-spec and permitdata/blds URLs 404). Wiki states "current version is 1.2". License of the spec itself is not stated on the wiki page (check repo LICENSE). Wayback is blocked from this tool.
- **Core Permits (fetched from the wiki).**
  - Required: PermitNum, Description, AppliedDate or IssuedDate (one required), CompletedDate or StatusCurrent (one required), OriginalAddress1, OriginalAddress2 (if source has it), OriginalCity, OriginalState, OriginalZip.
  - Recommended: Jurisdiction, PermitClass(+Mapped), StatusCurrentMapped, WorkClass(+Mapped), PermitType(+Mapped), PermitTypeDesc, StatusDate, TotalSqFt, Link, Latitude, Longitude, EstProjectCost, HousingUnits, PIN, ContractorCompanyName, ContractorTrade(+Mapped), ContractorLicNum, ContractorStateLic.
  - Optional: ProposedUse, AddedSqFt, RemovedSqFt, MasterPermitNum, ExpiresDate, COIssuedDate, HoldDate, VoidDate, ProjectName, ProjectID, several TotalXSqFt fields, ExtraFields, Publisher, Fee, Contractor contact fields.
- **Optional Inspections table (fetched).** Required: PermitNum, InspType, InspTypeMapped, Result, ResultMapped, ScheduledDate, InspectedDate. Recommended: InspectionNotes. Optional: Description, Final, RequestDate/Time, DesiredDate/Time, ScheduledTime, InspectedTime, ReInspection, Inspector, ExtraFields. InspTypeMapped values are in Appendix A (not retrieved).
- Other optional tables: Permit Status Change (status history) and Contractor.
- **Did New Orleans publish BLDS? Yes.** data.nola.gov dataset **72f9-bi28**, "Permits - BLDS" (fetched from the live Socrata API): CC0 license, permits from 1/01/2012, rowsUpdatedAt 2026-10-15; the city says it is updated nightly. 41 columns incl. computed regions. Core BLDS columns present: permitnum, description, applieddate, issuedate, completedate, statuscurrent, originaladdress1/city/state/zip, permitclass, workclass, permittype, permittypedesc, statusdate, totalsqft, link, location, estprojectcost, pin, contractorcompanyname, contractortrade, contractortrademapped, contractorlicnum, contractorstatelic, expiresdate, coissueddate, publisher, fee, and the *mapped fields (workclassmapped, permitclassmapped, permittypemapped, statuscurrentmapped). Missing relative to the spec's recommended set: Jurisdiction, HousingUnits, and separate Latitude/Longitude (single `location` column instead). Not published as BLDS: status history and the Contractors table. No Inspections table in BLDS form.
- Other NOLA permit datasets: nbcf-m6c2 "Building Permits (2018-present)" (LAMA weekly, fields PrmtID, Address, ConstructionVal, IssueDate, PermitType, LandUse...; last rowsUpdatedAt 2025-08-21, so STALE, prefer 72f9-bi28); aib5-en5t Permit Application Data (limited types, 2018-); f7tt-z5vu historic (stale); "NOLA Permits LAMA historic data 2004-2011" (last modified 2017).
- Adoption elsewhere: San Diego County (public domain, includes status-history and contractor tables, updated daily), Alameda, Seattle, Tampa, Boston, Chattanooga, Fort Worth, Bernalillo, Deschutes. Adoption is patchy and many cities lag.
- Gap: BLDS says nothing about code enforcement, STR, liens/blight or demolition.

## 3. New Orleans upstream data (fetched/searched; this is what national vendors ingest)
- Code Enforcement All Inspections, uh5a-f7uw: CC0, rowsUpdatedAt 2026-10-17 (today); columns CaseID, CaseNo, Location, InspectionDate, InspectionType, InspectionResult, Inspector, Check. No permit number, so it cannot join to permits except via address.
- Also Code Enforcement Active Pipeline 8pqz-ftzc (cases from May 2009), All Violations 3ehi-je3s, All Hearings 44ct-56tr, Districts um5k-74mk (ids from catalog search; column schemas not fetched).
- STR: Short-Term Rental Permit Applications en36-xvxg, Non-Commercial STR Licenses 2ei9-wqw2, Active STR Licenses ufdg-ajws (first published Sep 2025), plus older rbhq-zbz9. License fields missing on two of them; schemas not fetched. City page says no new commercial STR applications since 2023-06-08 and NSTR licenses expired 2025-06-30 pending renewal.
- Quality quirks reported by a third-party Apify scraper of the register (UNVERIFIED): ~12% of ~348k permits open; dirty council-district values; many blanks.
- Context: Fox 8 (2025-03) reports permitting still dysfunctional, with permits taking 2-3x longer than Jefferson Parish. The One Stop app and LAMA remain the system of record; One Stop's own advanced search is weaker than the open dataset (per nola.gov).

## 4. Other commercial vendors
- **BuildZoom / Cotality.** Claims 350M+ permits, 2,400 jurisdictions, 25+ years, 6M+ licensed contractors, 70k new permits and 500k status updates/day (vendor claims, UNVERIFIED). API is sales-gated: Supergood's API report card (competitor, July 2026) gives it a D, noting no public spec, auth docs, pricing or sandbox, and no webhooks. Cotality resells BuildZoom-sourced permits ("1,500+ geographic areas", fetched), keyed to its CLIP property ID; fields include status, job value, fees, type, description, contractors; no inspections mentioned; no update frequency stated; price by quote. New Orleans coverage UNVERIFIED (a large metro, likely included).
- **ATTOM.** Permit dataset from county/city sources; weekly load on Monday evenings; about 10% of permits do not match an ATTOM property ID; county detail varies; claims 94% of top cities and 200M+ rows (inconsistent). No public prices. Residential/commercial, contractor details, costs. Inspections not mentioned. New Orleans coverage UNVERIFIED.
- **Construction Monitor.** Lead-gen product: 32.3M permits, 39 project types, 97 markets, stated goal of 90% coverage (company site). Levelset lists New Orleans commercial permits from it (UNVERIFIED snippet). No public prices; no complaint data found.
- **Zillow/Redfin.** Show permit history only sometimes, from public-record feeds; no official documentation of source or freshness found. Third-party commentary (BuildZoom blog, insurers) frames permit history as a buyer due-diligence gap. A "PermitPeek" browser extension claims to add permit history to listings (code unreviewed; do not rely on it). ICE Mortgage Technology sells permit data (claims availability about one business day after issuance) drawing on permits and contractor license boards.
- **Cherre.** Data-integration platform and marketplace (lists Shovels); pricing unpublished; permit data arrives only via partners (e.g., Kukun AVM uses permit data).
- **PropertyRadar.** Focus is ownership, equity, foreclosure and lead lists; no permit coverage found. Reported pricing $119, $249 and $599/mo tiers (one review; conflicting plan counts; UNVERIFIED).
- **Regrid.** Parcels. Self-serve API metered per parcel record; free = 30-day sandbox; 2023 bulk pricing from $50k nationwide or $300/county (dated); nonprofit/academic program. Orleans Parish coverage UNVERIFIED.
- Cheap scrapers: Apify actors ($0.005 per normalized permit; others $30/1k items) and a New Orleans actor (j0401/nola-permits) that wraps the city's open data. Evidence that the upstream is the product.
- Not researched: PermitFlow (workflow/filing tool, not a data product), Reonomy, HouseCanary, Placer.

## 5. Reviews and complaints
No G2, Reddit, HN or BiggerPockets threads about stale or missing permit data surfaced despite targeted searches; treat as not found, not as absence of complaints. What does exist:
- Supergood's critique of BuildZoom's opaque, sales-gated API (competitor, so discount it).
- Apify actor docs note many fields null for Philadelphia, Chicago, Los Angeles and uneven refresh cadence by city, a sign that normalization hides gaps.
- CRES (insurer) concedes permit information is thinner in rural areas.
- A 2012 Redfin-commissioned study of stale listings is the only "stale portal data" evidence found, and it concerns listings, not permits.

## 6. Open data aggregators and licenses
- **Overture Maps addresses** (fetched docs): about 125.4M US address points, partial US coverage, mostly via OpenAddresses/AddressForAll plus agency sets and the USDOT National Address Database. License is per source, "permissive open licenses, some with special terms or attribution". No share-alike on the addresses theme (ODbL applies to other themes). NAD is under its own Access and Usage License. Whether Orleans Parish is in Overture/OpenAddresses was not checked; the city's own address data is the better source.
- **OpenAddresses** (fetched home page): "All data is openly licensed. Most sources only require attribution"; per-source licenses at batch.openaddresses.io. Orleans Parish source not confirmed.
- **Census Geocoder:** free, no API key, batch up to 10,000 addresses (FDLP doc), uses TIGER address ranges; no published numeric rate limit; terms reserve right to block or change service; a secondhand summary of the terms bars using Census data to identify individuals (UNVERIFIED, read census.gov terms). Repeated batch runs can match inconsistently (quoted by a competitor, UNVERIFIED). Use as fallback only; prefer city parcel/address data.
- **TIGER/Line:** US federal work, generally public domain (general knowledge; not verified here).
- HUD/USPS vacancy: tract-level and quarterly, too coarse for address pages (not fetched).

## 7. Existing MCP servers over open data
- **socrata/odp-mcp (official):** URL I tried 404'd, so tools and activity are only via a third-party review: ~4 generic tools (list_datasets, get_metadata, preview_dataset, query_dataset), no permit tools. UNVERIFIED.
- **srobbin/opengov-mcp-server** (fetched): MIT, 14 stars, 3 commits. One tool, `get_data`, with a `type` switch (catalog, categories, tags, dataset-metadata, column-info, data-access, site-metrics). Needs DATA_PORTAL_URL; takes free-form SoQL; default limit 10; no documented rate-limit handling. One portal per server instance.
- **jcscocca/socrata-mcp** (Glama page): MIT. Tools search_datasets, get_dataset, query (structured or raw SoQL, geo filters), profile_dataset, sample, export_csv. Disk cache, throttling, retries, app-token support, truncated flag. Weak points: Socrata only, US discovery only, inline cap 5,000 rows, Glama marks it inactive.
- **City-specific:** SF permits MCP (tbrennem-source/sf-permits-mcp) and DataSF MCP with a permits shortcut plus raw SoQL; Cambridge MA servers. The SF permits one is the nearest design reference (catalog doc, SODA client). No New Orleans MCP, no Data Commons MCP check.
- **Common weaknesses we can beat:** the agent must find dataset ids, learn each schema and write SoQL; nothing is joined across permits, inspections, code cases and STR; no address normalization or parcel key; no stale-dataset warnings (nbcf-m6c2 last updated 2025-08 vs 72f9-bi28 nightly); no provenance/freshness in responses; no entity pages (contractor, owner).

## Standards and open data to adopt
- BLDS v1.2 naming: reuse the city's own 72f9-bi28 columns verbatim (permitnum, statuscurrentmapped, permittypemapped, workclassmapped, pin, contractor*), and adopt the BLDS Inspections and Status-Change table shapes for our derived tables, with `InspTypeMapped`/`ResultMapped` normalization.
- Keep original address strings (OriginalAddress1..Zip) plus a normalized address and a parcel key (PIN). Record `publisher`/source dataset id and fetch time on every row (freshness shown to users and agents).
- Treat uh5a-f7uw (code inspections), 8pqz-ftzc, 3ehi-je3s, 44ct-56tr and the STR datasets as first-class sources; city data is CC0, so redistribution is clean. Check per-dataset license on the two STR sets that show none.
- Prefer nightly 72f9-bi28 over nbcf-m6c2; detect staleness automatically through Socrata `rowsUpdatedAt`.
- Addresses/geocoding: city address/parcel data first, then Census Geocoder (free, 10k batch), then OpenAddresses/Overture with per-source attribution recorded.
- Shovels-style ideas: work-type tags (about 20), contractor entity pages with alias list and confidence, parcel-keyed joins.
- MCP design: few intent-shaped tools (address_lookup, parcel_history, contractor_history, nearby_activity, recent_changes, data_freshness) with provenance and truncation flags like socrata-mcp, instead of a raw SoQL pipe.

## Where commercial products leave a gap for a free NOLA tool
- Price and terms: the free tiers are tiny (Shovels 500 credits, 10 results/query, 1 year of history, no downloads); BuildZoom, ATTOM, Cotality and Construction Monitor are quote-only. None allow a free public address page or open redistribution.
- Freshness: vendors refresh weekly to semi-monthly (ATTOM weekly; Shovels claimed 1st/15th; BuildZoom unspecified) while the source feed is nightly, so a direct pipeline beats them.
- Depth: no vendor page shows code enforcement cases, hearings, STR licenses, blight, or demolition data; inspections appear only as marketing claims. The city publishes all of these, but disconnected and with inconsistent keys (code inspections have no permit number).
- Local nuance: Orleans Parish quirks (LAMA to One Stop history, 2004-2011 legacy data, historic district review, dirty district fields) are unlikely to be modeled nationally.
- Agent access: existing MCP servers are generic SODA wrappers; none exist for New Orleans or pre-join by address/parcel.
- Risks to plan around: BLDS Inspections and status history are not published by NOLA, so inspection-to-permit linkage must be derived; some field-level claims here (Shovels coverage, ATTOM/BuildZoom NOLA coverage) are unconfirmed and should be tested directly (e.g., a free Shovels key query for Orleans Parish).
