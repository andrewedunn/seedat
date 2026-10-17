<!-- ABOUTME: Phase 0 landscape review of property/permit tools and the positioning for See Dat. -->
<!-- ABOUTME: Synthesized from research/prior-art/*.md; claims there were spot-checked by a separate validator. -->

# Prior art and positioning

Research done 2026-10-17 by three parallel research agents (New Orleans, other cities, national/commercial), synthesized and checked here. Detail and every source link live in [`research/prior-art/`](research/prior-art/): [nola.md](research/prior-art/nola.md), [other-cities.md](research/prior-art/other-cities.md), [national.md](research/prior-art/national.md). Independent spot-checks are in [`research/validation/claims.md`](research/validation/claims.md).

## The landscape in one table

| Tool | Who it serves | Does well | Falls short | Alive? | Borrow |
|---|---|---|---|---|---|
| **One Stop** (onestopapp.nola.gov) | Applicants, contractors, the public | The system of record for 17 departments. Public detail pages show reviews, inspections, fees and status history | No map, no property view. Address search is literal. Advanced search needs a login. Exports capped at about 200 rows | Yes | Status vocabulary. Its detail pages are our only source for inspections and timelines |
| **Property Viewer** (property.nola.gov) | Public, planners, buyers | Parcel map with zoning, historic and conservation districts, conditional uses | No permits, code cases or STR. No timeline | Yes | The ArcGIS layers behind it (maps.nola.gov) |
| **data.nola.gov** | Analysts, journalists | Nightly CC0 feeds for permits (incl. BLDS), code enforcement, STR, 311 and calls for service | Raw tables with inconsistent keys, stale duplicates and blank licenses. Nothing is joined | Yes | It is our substrate |
| **BlightStatus** (Code for America, 2012, New Orleans) | Residents, neighborhood groups | One page per address covering inspection, hearing, judgment and demolition. Watchlist with alerts | Gone. The repo is a 404, the site has a TLS error, and its demolitions dataset stopped in 2019. Spun out as Civic Insight | No | The concept, the watchlist and the stage pipeline. No reusable code |
| **The Lens STR tracker** (2017–19) | Readers | STR applications mapped | Frozen. Could only map to ZIP or address precision | No | The lessons in its "what we learned" notes |
| **Hobby STR maps** (5 GitHub repos) | Curious residents | Quick maps of data.nola.gov | STR only, unlicensed, mostly stale | Mixed | Nothing |
| **PermitMint, Apify NOLA actor** | SEO and paid scraping | Re-skins the city permit feed | Permits only, no joins. Commercial | Yes | Evidence that the upstream feed is the product |
| **Philadelphia Atlas + AIS** | Residents, city staff | One search box for address, intersection, owner or parcel. `match_type` on every geocode. Parcels and addresses many-to-many. Ranges and units as parent/child rows | AIS API needs a key. No license on any of the code | Yes (pushed Sep–Oct 2026) | The address model (see below). Read for ideas only |
| **NYC ZoLa / GeoSearch / PAD** | Everyone in NYC | Address search is a thin front door to a property ID (BBL). Ranges expanded to discrete rows. Dataset version stamped on every response | Zoning only (ZoLa) | Yes | ZoLa is CC0, the most reusable front end. The ID-first architecture |
| **Who Owns What** (JustFix) | Tenants, organizers | Landlord portfolios. Plain-language methodology page | NYC registration data only. GPL-3.0 | Yes | Methodology-page pattern, alerts |
| **NYCDB** | Housing advocates | One schema file and one doc page per dataset | AGPL-3.0 | Yes | Per-dataset documentation habit |
| **Chicago Cityscape** | Developers, journalists | Property report. Permit processing time as a first-class number. "Permits within 1/8 mile" fallback. Contractor profiles | Most of it needs an account. Paid tiers. Closed source | Yes | Processing time, nearby fallback, contractor pages, labelling self-reported costs |
| **SF Property Information Map** | Public | Parcel, permit and zoning in one place. Shareable link to a property report | Dated UI | Yes | Permalinks |
| **Pittsburgh Parcels N'At (WPRDC)** | Public | Integrated parcel dashboard including permits and code violations (launched 2025) | AGPL | Yes | Proof the integrated parcel page works for a mid-size city |
| **Shovels** | Contractors, investors | 170M+ permits, work-type tags, contractor entity resolution | New Orleans coverage could not be confirmed. Free tier is 10 results per query and 1 year of history. Paid starts at $599/mo. Semi-monthly refresh | Yes | Work-type tags, contractor-as-entity |
| **BuildZoom/Cotality, ATTOM, Construction Monitor** | Insurers, lenders, lead-gen | National breadth | Sales-gated. Weekly or unstated freshness. No code enforcement, STR or hearings | Yes | Nothing specific |
| **Regrid** | Everyone who needs national parcels | Parcels everywhere | Metered, redistribution restricted | Yes | Nothing. The city's own parcels are better here |
| **Socrata MCP servers** (opengov-mcp, socrata-mcp, odp-mcp; SF permits MCP) | Agent builders | Generic SoQL access | The agent has to find dataset ids, learn each schema and write SoQL. No joins, no address normalization, no freshness signal | Thin, some inactive | Truncation flags and provenance ideas |

## What users wanted and did not get

- **Status and timing.** Gambit (2025-10-04) reported that permit applicants wait months, sometimes more than a year. At a July forum, State Rep. Matthew Willard called for an online dashboard of when permits are requested and received. A March 2025 Fox 8 report says the 2023 task force's transparency recommendations have mostly not happened. Full links are in [nola.md](research/prior-art/nola.md).
- **"Is this STR legal?"** No public lookup exists. The city's STR maps mix denied, expired and issued records, and give no definitions or refresh dates.
- **One place per property.** Every comparable city tool (Atlas, Parcels N'At, Cityscape) was built because departmental systems did not link. In New Orleans they still do not.
- **A legal hook.** La. R.S. 33:4778 directs New Orleans Safety & Permits to post applications, inspections and permit outcomes online within three business days. It does not require an API or bulk download, which is the gap See Dat fills.
- Gap in the evidence: Reddit was blocked to our tools, and no first-hand forum threads were found, so resident sentiment rests on news coverage.

## Positioning

### The gaps nobody fills for New Orleans

1. **No property page that joins everything.** Nobody puts permits, inspections, code cases and hearings, STR licenses, zoning and historic rules, and block-level 311/911 on one address page. One Stop has the records but no property view. Property Viewer has the map but no activity.
2. **No permit timeline.** Status history and inspections exist only on One Stop detail pages, one permit at a time. Nobody computes "how long do permits like this take," which is exactly what residents and the press are asking for.
3. **No reliable address-to-parcel key across city systems.** Permits use the assessor's tax-bill number, code enforcement uses GEOPIN, and 311, STR and inspections use free text. Nobody publishes the crosswalk or reports where the city's own systems disagree.
4. **No agent access.** No New Orleans MCP server exists, and the generic Socrata ones leave all the joining to the agent.
5. **Nothing alive in the blight space.** BlightStatus died. No watchlist or alerts exist.

### What See Dat should do that no one else does

- **Parcel-first, with explicit match confidence.** Every record joins to a canonical parcel and address key. Each join is tagged with how it matched (exact, unit-generic, range member, fuzzy street, spatial) on Philadelphia AIS's `match_type` model. Unmatched rows go to a public "couldn't place these" list, not silently dropped.
- **Timelines, not just lists.** Each permit gets reconstructed status history and inspections from One Stop detail pages, processing time as a headline number, and comparison against similar permits.
- **Freshness as a feature.** Every page and every MCP response says which source it came from and when it was last pulled. Stale city datasets get flagged automatically (several already are).
- **Intent-shaped MCP tools** (`lookup_address`, `search_permits`, `property_history`, `nearby_activity`, `find_properties`, `data_freshness`) with provenance and truncation flags, instead of a raw SoQL pipe.
- **City data-quality findings as an output.** AIS's best idea: publish where datasets disagree (permit PIN vs GEOPIN, missing parcels, junk dates), so the city can fix them.
- **Plain-English summary** generated from structured facts only, never invented.

### What it should deliberately not do

- **No risk or "blight scores" on people's homes.** ANHD's experience shows a score is a product decision with real harm potential. Show facts and timelines, not judgments. A blight early-warning project can come later, with care.
- **No owner-linking or landlord portfolios in v1.** Owner names are in permit data, but linking people across records invites false positives and doxxing concerns. Revisit with a published methodology.
- **No exact-address display of NOPD calls for service.** Those terms require block level only and no derived addresses. 311 also stays at block level per the brief.
- **No scraping of the Assessor's site.** It is behind a bot challenge. Use the city's published parcel crosswalk, and ask the Assessor for an extract.
- **No logged-in One Stop features** (advanced search, watch lists).
- **Not a national product.** Shovels and the rest already cover breadth. We win on New Orleans depth and freshness.
- **No phone numbers or emails** from STR or business-license records, even though the city publishes them.

### Open source to build on, not rewrite

| Use | Project | License |
|---|---|---|
| Address parsing (offline batch) | datamade/usaddress, usaddress-scourgify | MIT |
| Fuzzy matching, entity linking later | splink | MIT |
| Map and popup UX patterns | NYCPlanning/labs-zola | CC0 |
| Permit schema vocabulary | BLDS v1.2 (the city already publishes it) | open spec |
| Design reference only (no license or copyleft, do not copy code) | Philly AIS/Passyunk/Atlas, NYC geosearch normalizer, Who Owns What (GPL-3), NYCDB (AGPL-3) | — |

## Changes to the plan the research suggests

1. **Build the parcel key and match layer first, put the UI on top.** Every successful comparable tool is ID-first (NYC BBL, Philly AIS). Address search is just a typeahead that returns a parcel.
2. **Freshness comes from data.nola.gov, not One Stop reports.** The monthly One Stop reports are not needed: the Socrata permit, code-enforcement, STR and 311 feeds are refreshed nightly (about 12 h lag). One Stop detail pages are needed only for inspections, reviews and status history.
3. **Full detail-page history is a slow crawl.** At a polite 1 request per 2 s, every One Stop detail page takes about 26 days. Plan: crawl open and recently changed permits first, then backfill history slowly in the background. Ask the city whether a bulk feed exists before a long crawl (Andrew's call, since it means contacting them).
4. **"Every permit back as far as the source goes" means three eras.** Live feed (2002/2012–present), LAMA/Accela historic exports (2004–2012; file downloads), and historical permit data (1995–2009). The older eras have worse addresses, so their match rate will be lower and reported separately.
5. **Demolitions have no live source** (the BlightStatus dataset ends 2019). Demolition permits (`DEMO` type) in the permit feed become the demolition record.
6. **Owner and sales data are out of scope for v1** unless the Assessor provides an extract. No assessor roll or sales feed exists on the portal.
