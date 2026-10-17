<!-- ABOUTME: Inventory of parcel and address authorities for Orleans Parish for See Dat. -->
<!-- ABOUTME: Produced by a source-inventory subagent. -->

# Parcel and address authorities, Orleans Parish

Researched 2026-10-17. "Verified" = fetched live this session. "From knowledge" = not re-checked; confirm before depending on it.

## 1. Candidate canonical sources

| # | Source | What it is | Count | Freshness | License | Access |
|---|---|---|---|---|---|---|
| A | **data.nola.gov `hfvu-md72` Site Address Point** (verified) | City address points (Esri LGIM schema), owned by Safety and Permits, the same dept that issues permits | 268,595 rows: 198,495 Building, 52,110 Unit/Condo/Suite, 17,621 Parcel, 369 Other. Status: 248,373 Current, 18,999 Retired, 959 Pending | Weekly (rows updated 2026-10) | CC0 1.0 | Socrata SODA `https://data.nola.gov/resource/hfvu-md72.json`, CSV via `/api/v3/views/hfvu-md72/query.csv`. No key needed for light use |
| B | **data.nola.gov `v9q5-fz7t` Parcels** (verified) | Parcel polygons | 151,255 | Updated 2026-10-15 | No license field set (city open data, treat as public domain, confirm with gis@nola.gov) | SODA. Columns: `geopin`, `situs_dir`, `situs_street`, `situs_type`, `situs_number`, acres, geometry. No owner, no tax bill |
| C | **data.nola.gov `pzqp-4ri7` Parcels To Join** (verified) | Parcel polygons carrying both GEOPIN and `parid` (the tax bill number). Source dept: Assessor's Office | 162,773 | Monthly | No license field | SODA. This is the GEOPIN to tax-bill crosswalk |
| D | **OpenAddresses** (verified) | `sources/us/la/orleans_parish.json` and `city_of_new_orleans.json` exist. Both just re-ingest source A (`hfvu-md72`, CC0), mapping `preaddrnum`+`addrnum`+`addrnumsuf` to number, `fullname` to street, `unittype`+`unitid` to unit | Same as A | Lags A | CC0 | Adds nothing over A. No parcel layer for Orleans |
| E | **Census Geocoder** (verified working) | TIGER address ranges. Test: "1300 Perdido St" matched range 1200-1416, 70112 | Ranges, not points | TIGER annual | Public domain | `geocoding.geo.census.gov/geocoder/locations/onelineaddress` (single) and `/addressbatch` (CSV, up to 10,000 rows per request, from knowledge). Returns interpolated coords and a TIGER line ID, no parcel or unit. Use as fallback and sanity check only |
| F | **Orleans Parish Assessor** (nolaassessor.com) | Owner, assessed value, tax bill, sales, parcel records | ~160k parcels | Annual roll plus ongoing changes | Not stated | See section 2. No bulk download found |
| G | **Overture Maps addresses** (from knowledge) | Merged open addresses (OpenAddresses, NAD, and others) in GeoParquet on S3 | Probably duplicates A | Monthly releases | Mostly CC0/CC-BY per source, check per-release attribution | DuckDB over S3 filtered by bbox. Redundant here |
| H | **USDOT National Address Database (NAD)** (from knowledge) | Louisiana contributes via state 911 program. Orleans coverage unverified | Unknown | Irregular | Public domain | CSV/GDB download. Possible cross-check only |
| I | **Louisiana state sources** (partly verified) | LSU Atlas (atlas.ga.lsu.edu) is lidar and imagery centered. The state DOA GIS page (doa.la.gov/doa/osl/gis-data) lists no statewide parcels or Orleans addresses (only state land/adjudicated data). Statewide 911 address points are not openly downloadable that I found | n/a | n/a | n/a | Not useful. Orleans parcels live with the city/assessor |
| J | **Regrid** (from knowledge) | Commercial national parcels with address fields | Full coverage | Quarterly+ | Free tier is a limited-county sample or trial, redistribution restricted. Orleans is probably not free | Do not use. Conflicts with non-commercial open-data goal |
| K | **property.nola.gov Property Viewer** (search snippet) | City viewer backed by `gis.nola.gov/arcgis/.../property3`. Search by address, owner, or tax bill number | n/a | n/a | n/a | That is the ArcGIS server, so it is the other agent's scope |
| L | **Tax rolls PDFs** (verified, nola.gov/tax-rolls) | Annual PDF rolls by municipal district, 2017 to 2026, keyed by tax bill range | ~all taxable | Annual | Public record | PDFs only. Low value for address matching |

Other Socrata ids noted on data.nola.gov (names only, another agent catalogs these): `rcm3-fn58` Permits, `72f9-bi28` Permits - BLDS, `en36-xvxg` STR Permit Applications, `ufdg-ajws` Active STR Licenses, `u6yx-v2tw` Code Enforcement All Cases, `44ct-56tr` CE All Hearings, `hjcd-grvu` Occupational Business Licenses, `hpm5-48nj` NORA Sold Properties, `a4h4-zi7e` Adjudicated Property (fetched under another domain in search, verify), `9a4m-i64z` Assessment Areas, `cym7-cw5z` Tabular Address Points (2018, stale, ignore). No Socrata dataset for Orleans assessor property sales was found; the "Assessor - Parcel Sales" hits (`wvhk-k5uv`, `3723-97qp`) are another jurisdiction (Cook County).

## 2. Orleans Parish Assessor

- `https://www.nolaassessor.com/robots.txt` returned a **Cloudflare "Just a moment" challenge** to a plain curl request. I did not attempt to bypass it. Practical meaning: automated access to the assessor site is actively bot-gated, so assume scraping is unwelcome and not a dependable pipeline. robots.txt contents and terms of use were therefore **not read**.
- The assessor's public search is at nolaassessor.com (and a qPublic listing exists for other LA parishes at qpublic.net/la/laassessors; I did not confirm Orleans is on qPublic). I did not sample property pages.
- The City publishes the assessor-derived join (source C) monthly. That gives GEOPIN and tax bill number without touching the assessor site.
- Recommendation: email the Assessor's Office to ask for a bulk roll or sales extract (public records request) rather than scraping.

## 3. GEOPIN

- GEOPIN is the **GIS parcel identifier** in the city parcel layer (numeric, e.g. `41027259`). The first parcels sampled: 2511 Eagle St is GEOPIN 41027259 and 536 Dumaine St is 41023314. The leading digits appear to encode municipal district and square (this structure is my inference from two samples, not documented).
- The assessor's **tax bill number** (`TAXBILL`, `parid` in `pzqp-4ri7`) is a separate 9-character id (e.g. `101001001`, `37W101623`) tied to the district and the assessment, as seen in the tax roll PDFs. The two ids are not derivable from each other. The city documentation says dataset C exists "to join to tabular data based on either field".
- Relationship: **parcel polygon (GEOPIN) 1 to 1 or 1 to many with tax bill**. Condos and split parcels can have several bills on one geometry, and 162,773 rows in C vs 151,255 in B suggests the layers are not 1:1. Treat the join as many-to-many until measured.
- Site Address Point (A) has **no GEOPIN column** (columns: siteaddid, preaddrnum, addrnumsuf, addrnum, unittype, unitid, fullname, fulladdr, placename, pointtype, status, joinid, geometry, etc.). Linking an address to a parcel requires a **point-in-polygon spatial join** (A points into B/C polygons), or matching B's situs_* fields. Code enforcement and permit datasets also expose a GEOPIN column in search results, which makes those direct joins to B/C.
- Note `addrnumsuf` is empty in all 268,595 rows, so "1/2" and lettered suffixes must be embedded elsewhere (probably in `addrnum` or `fulladdr`). Check with a sample before building the normalizer.

## 4. Normalization tools

New Orleans quirks to cover: St Claude vs Saint Claude; N/S/E/W Rampart-type prefixes; Ste/St/Saint/Ste. ; "General de Gaulle" vs "Gen DeGaulle"; "Dr. Martin Luther King Jr Blvd" and MLK variants; Avenue/Ave/Av; unit designators (Apt, Unit, #, Ste); halves ("1234 1/2"); ranges ("1234-36"); double-barrel and Creole street names (Bienville, Tchoupitoulas, Chartres); city names (New Orleans, Metairie, NOLA) and ZIP 701xx.

| Tool | License | Runs where | NOLA fit | Verdict |
|---|---|---|---|---|
| **usaddress** (python CRF parser) | MIT | Python only, needs a container or a precomputed batch step. Not WASM-friendly | Tags components well, no canonicalization or abbreviation tables. Struggles with ranges and halves, needs rules on top | Good for offline batch tagging |
| **libpostal** | MIT | C library, ~2 GB model, container only | Strong multilingual expansion (generates variants like "saint claude"/"st claude"). Heavy | Overkill. Only if rules fall short |
| **Pelias** | MIT | Large multi-service stack (Elasticsearch, needs OA/OSM data) | Full geocoder, high ops cost | No. Too heavy for a free hobby project |
| **PostGIS address_standardizer (PAGC)** | GPL-2 (PostGIS extension) | Needs Postgres/PostGIS container | Rule-table driven, tunable lex/gaz, handles `Ste`, directionals | Viable if a Postgres exists. Not Worker compatible |
| **Census geocoder** | Public domain, hosted API | Any (fetch from Worker or batch job) | Interpolated ranges only, no units, misses new/odd addresses | Fallback only. Rate and batch limits apply |
| **Custom rules + canonical key (recommended)** | ours | Pure TypeScript, runs in a Worker | Can be tuned directly to the Site Address Point vocabulary | Primary |

Worker-compatibility summary: only a hand-written TypeScript normalizer (or a tiny WASM build) runs in a Cloudflare Worker. usaddress, libpostal, Pelias, and PAGC all need a container or an offline batch step.

## 5. Recommended canonical-address strategy

1. **Canonical address table = Site Address Point (A)**, filtered to status Current plus Retired (keep retired for historical permits). Re-sync weekly via SODA. It is CC0, owned by the permitting department (so permit addresses were largely issued from it), and gives units, which parcel layers lack.
2. **Canonical parcel table = Parcels To Join (C)** (GEOPIN + parid), enriched with B's situs fields. Sync monthly.
3. **Build an address-to-GEOPIN link once**, offline: point-in-polygon of A into C, then store `address_id -> geopin[]`. Fall back to B `situs_number + situs_street + situs_type` text match for the ~17.6k "Parcel"-type points and for misses.
4. **Normalizer (TypeScript, shared by ingest and Worker)**: uppercase, strip punctuation, expand Saint/St/Ste by position (leading token of the street name -> SAINT, trailing token -> ST as street type), canonicalize directionals and street types against A's own `fullname` vocabulary (build the lookup from the data itself, not from a USPS list), map MLK and Gaulle aliases, split units (`APT`, `UNIT`, `#`, `STE`), parse `1234 1/2` and `1234-36` into a base number plus suffix or range expansion. Output a key like `NUMBER|STREETKEY|UNIT?`.
5. **Match ladder**, record the rung per row for auditing: (a) exact key with unit; (b) exact key without unit, mapped to the building point; (c) range member or half-number to the base number; (d) fuzzy street (trigram or edit distance 1) with same number; (e) Census geocoder for the remainder, then spatial join to parcel. Log unmatched rows for hand-built alias entries.
6. **Measure before promising 98%.** First step: run the ladder on a few thousand rows of `rcm3-fn58` Permits and `en36-xvxg` STR data and report the rung distribution. Expect STR and old permits to be the hard tail (retired addresses, parcel-only points, condos).
7. Skip Regrid, Overture, OpenAddresses, and Pelias. They add cost or are redundant copies of A. Keep OpenAddresses as the downstream consumer reference only.
8. Open item: ask the Assessor for a bulk extract (owner, sales). Do not scrape the Cloudflare-protected site.

## 6. Caveats and unverified

- Overture, NAD, Regrid, libpostal/usaddress/Pelias/PAGC license and capability notes are from knowledge, not fetched.
- Whether Orleans is on qPublic is unconfirmed.
- Whether dataset B/C have a license is unknown (field empty on Socrata).
- Meaning of GEOPIN digits is inferred.
- The `addrnumsuf` column was empty for every row, so half-address handling in source A needs inspection.
