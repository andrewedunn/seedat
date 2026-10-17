<!-- ABOUTME: Inventory of New Orleans ArcGIS REST layers relevant to See Dat. -->
<!-- ABOUTME: Produced by a source-inventory subagent. -->

# New Orleans ArcGIS REST inventory (maps.nola.gov)

Probed 2026-10-17. Root: `https://maps.nola.gov/server/rest/services` (ArcGIS Server 10.91, 28 folders, all anonymous, no token). Full crawl: `samples/arcgis/inventory.json` (247 layers), produced by `scripts/crawl_arcgis.py` (stdlib only, >=1s between requests, UA `seedat-research/0.1 (...)`). `maps.nola.gov/robots.txt` returns an HTML page (no robots rules). `gis.nola.gov` did not respond. No ArcGIS Hub site exists at `portal-nola.opendata.arcgis.com` ("Site does not exist"); city open data lives on Socrata (`data.nola.gov`) instead. Everything is MapServer except `CPC_Projects` (also FeatureServer). **No layer exposes `editingInfo.lastEditDate`**, so freshness is unknown except per-record fields (`LASTUPDATE`, `last_edited_date`, `EditDate`). All layers: SR 102682 / **3452** (NAD83 Louisiana South ftUS); use `outSR=4326` for lat/lon. All: maxRecordCount 2000 (permits 3500), `supportsPagination=true`, formats JSON/geoJSON/PBF.

Base for the paths below: `https://maps.nola.gov/server/rest/services/`

## Relevant layers

| Need | Layer path | Geom | Count | Key fields |
|---|---|---|---|---|
| Parcels | `Assessor/Landbase_Layers/MapServer/0` | poly | 151,255 | GEOPIN (int), SITUS_NUMBER/DIR/STREET/TYPE, ACRES |
| Parcel to assessor id | `Assessor/Parcels_To_Join/MapServer/0` | poly | 163,637 | GEOPIN, PARID |
| Lots / Squares | `Assessor/Landbase_Layers/MapServer/1`, `/2` | poly | 190,009 / 10,749 | (not inspected) |
| Address points (canonical) | `Addresses/Site_Address_Point_LAMA/MapServer/0` | point | 275,122 | SITEADDID, FULLADDR, ADDRNUM, FULLNAME, UNITTYPE/UNITID, STATUS, **GEOPIN (string)**, ZCTA5CE10 |
| Zoning (CZO base) | `LandUsePlanning/Land_Use_Planning_Layers/MapServer/2` | poly | 1,496 | ZONECLASS, ZONEDESC, ZONENUM, ZONEYEAR, ORDNUM, HYPERLINK |
| Overlay + interim zoning | `.../Land_Use_Planning_Layers/MapServer/1` | poly | 203 | Name, DESCRIPTION (e.g. "RDO-1 ..."), DOCKET, ORDINANCE, WEBLINK |
| Conditional use | `.../Land_Use_Planning_Layers/MapServer/0` | poly | 1,455 | ZONECLASS, RECNUM, ORDNUM |
| Mandatory inclusionary zoning | `.../Land_Use_Planning_Layers/MapServer/4` | poly | 3 | Name, DESCRIPTION |
| Future land use | `.../Land_Use_Planning_Layers/MapServer/3` | poly | 1,493 | FUTLANDUSE, FLU_DESC, FLU_YEAR, FLU_LINK |
| Pre-2015 zoning | `.../Land_Use_Planning_Layers/MapServer/5` | poly | 3,066 | ZONECLASS, ZONEDESC |
| Local historic districts (HDLC) | `Administrative/Historic_Preservation/MapServer/1` | poly | 22 | NAME, ORDINANCE, JURISDICTION, CONTROL (Full/partial) |
| National Register districts | `.../Historic_Preservation/MapServer/2` | poly | 32 | REFNUM, NAME, STATUS |
| HDLC landmarks | `.../Historic_Preservation/MapServer/0` | point | 342 | addr, name, Architect, nom_des, Date_, Hyperlink, EditDate |
| Neighborhood Conservation Dist. | `.../Historic_Preservation/MapServer/3` | poly | 1 | Descript |
| HDLC solar review area | `Resilience/HDLC_Solar_Panel_Review_Area/MapServer` | ? | ? | **layer list empty; queries fail (see below)** |
| Neighborhood statistical areas | `Reference/Reference_Layers/MapServer/0` | poly | 72 | NEIGH_ID, GNOCDC_LAB, LUP_LAB |
| Council districts | `Administrative/Administrative_Layers/MapServer/1` | poly | 5 | DISTRICTID, NAME, REPNAME, LASTUPDATE |
| Wards / planning districts | `.../Administrative_Layers/MapServer/3`, `/4` | poly | 17 / 14 | WARD ... |
| Building footprints | `Basemap/BuildingFootprints/MapServer/0` | poly | 162,486 | GEOPIN (double), StructureID, ActiveStatus |
| Building permits 2018-present | `Revenue/Revenue_Layers/MapServer/2` | point | 35,720 | PrmtID, Address, IssueDate, PermitType, ConstructionVal, LandUse |
| CPC / BZA cases | `LandUsePlanning/CPC_Projects/FeatureServer/1..7` | point | BZA 202, closed 7,877 | (not inspected) |
| Other candidates | Code Enforcement Districts, Residential Parking zones, NOPD/NOFD districts, Council Demographics 2020 (`Census/Census_2020/MapServer/3` neighborhoods), TaxIncentives (TIF, BID, Opportunity Zone) | | | |

## Key layer notes

**Parcels** (`Assessor/Landbase_Layers/MapServer/0`): only GEOPIN, situs address parts, acres, geometry. **No owner, no tax bill number, no assessed value.** GEOPIN is a 8-digit int (e.g. 41036019). `Parcels_To_Join` adds `PARID` (looks like `3210-GRAVIERST`, an address-derived assessor id, not a tax bill number) and has more rows (163,637 vs 151,255), so it likely includes retired/condo parcels. Owner/tax data must come from the Assessor site or another source.

**Address points**: two services. `Site_Address_Point_LAMA` (layer 0, 275,122 pts; 248,514 STATUS='Current') is the one with `GEOPIN` and `ZCTA5CE10` (4,921 rows have NULL GEOPIN). The plain `Addresses/Site_Address_Point` service reports `layers: []` and `/0` metadata returns HTTP 500, but `/0/query` does work (268,705 rows; extra fields JoinID, LASTUPDATE, LASTEDITOR) and has **no GEOPIN**. Prefer LAMA. Gotcha: the `LAT`/`LONG` fields hold state-plane coordinates, not degrees; use geometry with `outSR=4326`. `FULLADDR` is spelled out ("3210 Gravier Street"), and `SITEADDID` is the stable id.

**Solar review area**: description says it is the union of all full-control HDLC districts, Esplanade Ridge and Treme partial-control districts, and nominated/designated landmarks. The service lists no layers and `/0`, `/0/query` return 400/500, with a NaN extent, so it is currently broken or unpublished. Workaround: rebuild from Historic_Preservation layers 0 and 1 (filter CONTROL = Full, plus the two partial districts, plus landmarks). Worth emailing the city to ask for a fix.

**Flood zones**: none on maps.nola.gov. Use FEMA NFHL (hazards.fema.gov ArcGIS) or another source (outside this scope).

**Zoning**: `ZONECLASS` is the CZO district code (MU-2, HI...); `ZONECLASS1` etc. carry a second code where split. Overlays are polygons in layer 1 and the district name is in `DESCRIPTION` rather than `Name` (which is the overlay category). HYPERLINK points to czo.nola.gov.

## Join keys (tested)

- Address to parcel: `Site_Address_Point_LAMA.GEOPIN` (string) = `Parcels.GEOPIN` (int). Cast needed. Test: SITEADDID 85000086 "3210 Gravier Street" has GEOPIN '41036019'; parcel 41036019 has SITUS 3210 GRAVIER ST; PARID `3210-GRAVIERST`. A point-in-polygon query of the address geometry on Parcels also returned 41036019, so both agree.
- Footprints: `GEOPIN` (double) also joins to parcels.
- Zoning, overlay, FLU, historic, NR, council, neighborhood, solar: no parcel key; assign by spatial intersect (parcel centroid or representative point, SR 3452) and precompute offline.
- Permits layer joins by address text only (no GEOPIN in fields); the dedicated permits feed is covered by another inventory.

## Bulk-export strategy

Everything is small enough to snapshot nightly. Use `/query?where=1=1&outFields=*&resultOffset=N&resultRecordCount=2000&orderByFields=OBJECTID` (pagination supported everywhere; `exceededTransferLimit` signals more). Largest pulls: address LAMA 138 pages, parcels 76 pages, footprints 82 pages. Add `f=geojson&outSR=4326` for GeoJSON in WGS84 (tested on address points), or `f=pbf` for speed. Hub downloads are not available (no Hub site). Keep >=1s between requests. Since no layer exposes `editingInfo`, detect change by diffing counts or hashes of OBJECTID/attribute checksums. Small polygon layers (zoning, overlays, districts) can be pulled whole in one or two requests.

## Samples

`samples/arcgis/`: `inventory.json`, `sample_parcels.json`, `sample_address_points.json`, `sample_address_lama.json`, `sample_parcels_to_join.json`, `join_test_address.json`.

## Surprises

- Solar review service and non-LAMA address service report no layers.
- No `editingInfo` anywhere, no ArcGIS Hub, no flood layer, no owner/tax-bill fields on parcels.
- LAT/LONG fields on address points are projected feet.
