-- ABOUTME: Initial D1 schema for See Dat: canonical parcels and addresses, activity records, events, and provenance.
-- ABOUTME: Design rationale is in docs/schema.md; address matching in docs/address-matching.md.

-- ───────────── Provenance ─────────────

-- One row per upstream dataset or layer we pull.
CREATE TABLE source (
  source_id        TEXT PRIMARY KEY,          -- e.g. 'socrata:72f9-bi28', 'arcgis:Addresses/Site_Address_Point_LAMA/0', 'onestop:detail'
  name             TEXT NOT NULL,
  url              TEXT NOT NULL,
  license          TEXT,                      -- 'CC0-1.0', 'NOPD terms (non-commercial, block-level)', ...
  cadence          TEXT,                      -- observed, e.g. 'nightly full replace'
  upstream_updated_at TEXT,                   -- Socrata rowsUpdatedAt or our change-detection time
  last_pulled_at   TEXT,
  last_success_at  TEXT,
  last_row_count   INTEGER,
  stale_after_hours INTEGER NOT NULL DEFAULT 48
);

-- One row per pull. The raw payload lives in R2 (seedat-raw) at r2_key, so any load can be replayed.
CREATE TABLE snapshot (
  snapshot_id   INTEGER PRIMARY KEY,
  source_id     TEXT NOT NULL REFERENCES source(source_id),
  fetched_at    TEXT NOT NULL,
  r2_key        TEXT NOT NULL,
  row_count     INTEGER,
  inserted      INTEGER, updated INTEGER, deleted INTEGER,
  status        TEXT NOT NULL                -- 'ok' | 'failed' | 'skipped-unchanged'
);
CREATE INDEX snapshot_source ON snapshot(source_id, fetched_at);

-- Field-level change history, produced by diffing consecutive snapshots.
-- The city publishes current state only; this table is how we know *when* things changed.
CREATE TABLE change_log (
  entity      TEXT NOT NULL,                   -- 'permit' | 'code_case' | 'str_license' | 'parcel' ...
  entity_id   TEXT NOT NULL,
  field       TEXT NOT NULL,                   -- '*' for insert/delete
  old_value   TEXT,
  new_value   TEXT,
  observed_at TEXT NOT NULL,
  snapshot_id INTEGER REFERENCES snapshot(snapshot_id)
);
CREATE INDEX change_entity ON change_log(entity, entity_id, observed_at);
CREATE INDEX change_time ON change_log(observed_at, entity);

-- ───────────── Canonical geography ─────────────

-- Parcel = the property key. GEOPIN from the city parcel layer.
-- Spatial attributes are assigned at ingest (point-in-polygon on the parcel's representative point), never at request time.
CREATE TABLE parcel (
  geopin            INTEGER PRIMARY KEY,
  situs             TEXT,                      -- parcel layer's own address, e.g. '3210 GRAVIER ST'
  lat REAL, lon REAL,                          -- representative point (WGS84)
  acres             REAL,
  zoning            TEXT, zoning_desc TEXT,    -- CZO base district, e.g. 'HU-RD2'
  overlays          TEXT,                      -- JSON array of overlay/interim zoning names
  future_land_use   TEXT,
  local_historic_district TEXT, hdlc_control TEXT,   -- HDLC district and 'Full' | 'Partial'
  nr_district       TEXT,                      -- National Register district
  is_landmark       INTEGER NOT NULL DEFAULT 0,
  hdlc_solar_review INTEGER NOT NULL DEFAULT 0,      -- rebuilt from its published definition (service is broken)
  flood_zone        TEXT,                      -- FEMA NFHL
  neighborhood      TEXT, council_district TEXT, ward TEXT, planning_district TEXT,
  first_seen_at     TEXT NOT NULL, last_seen_at TEXT NOT NULL,
  retired_at        TEXT                       -- set when it disappears upstream; never deleted
);
CREATE INDEX parcel_neighborhood ON parcel(neighborhood);
CREATE INDEX parcel_zoning ON parcel(zoning);
CREATE INDEX parcel_historic ON parcel(local_historic_district);
CREATE INDEX parcel_council ON parcel(council_district);

-- Canonical address points (city LAMA site address points). Many per parcel (units, doubles, corners).
CREATE TABLE address (
  address_id   INTEGER PRIMARY KEY,            -- stable hash of SITEADDID + address + unit (see 0002)
  geopin       INTEGER REFERENCES parcel(geopin),
  full_address TEXT NOT NULL,                  -- as published, e.g. '3210 Gravier Street'
  number       INTEGER, number_suffix TEXT,    -- '1/2', 'A'
  street_key   TEXT NOT NULL,                  -- normalized street, e.g. 'GRAVIER ST' (see docs/address-matching.md)
  unit_type TEXT, unit_id TEXT,
  status       TEXT,                           -- 'Current' | 'Retired' | 'Pending'
  zip TEXT, lat REAL, lon REAL,
  cell         TEXT NOT NULL,                  -- ~100 m grid cell, for nearest-address lookups without spatial SQL
  block_id     TEXT NOT NULL                   -- hundred-block, e.g. '3200 GRAVIER ST'
);
CREATE INDEX address_key ON address(street_key, number);
CREATE INDEX address_geopin ON address(geopin);
CREATE INDEX address_cell ON address(cell);
CREATE INDEX address_block ON address(block_id);

-- Street dictionary and aliases. Canonical names come from address points; aliases are learned
-- (parcel situs names sharing a GEOPIN, accent folding, official renames) or added by hand.
CREATE TABLE street_alias (
  alias_key  TEXT PRIMARY KEY,                 -- normalized variant, e.g. '2ND ST', 'ROBERT E LEE BLVD'
  street_key TEXT NOT NULL,                    -- canonical, e.g. 'SECOND ST', 'ALLEN TOUSSAINT BLVD'
  origin     TEXT NOT NULL,                    -- 'canonical' | 'parcel-situs' | 'accent-fold' | 'rename' | 'manual'
  votes      INTEGER                           -- for learned aliases: agreeing GEOPINs
);

-- Learned crosswalk: assessor tax-bill number (permit `pin`) -> GEOPIN. Built from permits matched by address.
CREATE TABLE tax_bill_geopin (
  tax_bill  TEXT NOT NULL,
  geopin    INTEGER NOT NULL REFERENCES parcel(geopin),
  evidence  INTEGER NOT NULL,                  -- how many address-matched permits agree
  PRIMARY KEY (tax_bill, geopin)
);

-- Hundred-blocks: the unit for 311 and NOPD calls (which must never be shown at address level).
CREATE TABLE block (
  block_id TEXT PRIMARY KEY,                   -- '1100 GRAVIER ST'
  street_key TEXT NOT NULL, block_number INTEGER NOT NULL,
  lat REAL, lon REAL,
  neighborhood TEXT, council_district TEXT
);

-- ───────────── Activity records ─────────────
-- Every record carries the same match columns so coverage can be measured per source:
--   geopin, address_id   the resolved keys (NULL when unmatched)
--   match_type           'exact' | 'generic_unit' | 'base_address' | 'range_member' | 'alias' | 'fuzzy_street'
--                        | 'parcel_situs' | 'tax_bill' | 'nearest_point' | 'source_geopin' | 'unmatched'
--   match_score          0..1
--   address_raw          the string exactly as the city published it

CREATE TABLE permit (
  permit_num     TEXT PRIMARY KEY,             -- '26-30446-RENO'
  geopin INTEGER, address_id INTEGER, match_type TEXT NOT NULL, match_score REAL,
  address_raw    TEXT,
  block_id       TEXT,
  permit_type TEXT, permit_type_desc TEXT, permit_class TEXT, work_class TEXT,   -- BLDS + mapped
  description    TEXT,
  status         TEXT, status_mapped TEXT, status_date TEXT,
  is_closed      INTEGER,
  applied_date TEXT, issued_date TEXT, completed_date TEXT, expires_date TEXT, co_issued_date TEXT,
  est_cost       REAL,                         -- applicant-reported; label as such in UI
  fees_total REAL, fees_unpaid REAL,
  contractor     TEXT,                         -- JSON array [{name, trade, license}]
  owner_name     TEXT,                         -- as shown on the city's own record
  land_use TEXT, zoning_filed TEXT, historic_district_filed TEXT, council_district_filed TEXT,
  tax_bill       TEXT,                         -- `pin`, raw
  lat REAL, lon REAL,                          -- from rcm3/aib5 when present
  onestop_ref    TEXT, onestop_id INTEGER,     -- 6-char reference code; detail-page integer id
  days_to_issue  INTEGER,                      -- derived: issued - applied
  sources        TEXT NOT NULL,                -- JSON array of source_ids that contain this permit
  detail_fetched_at TEXT,                      -- last One Stop detail crawl
  row_hash       TEXT NOT NULL,
  first_seen_at TEXT NOT NULL, last_seen_at TEXT NOT NULL, removed_at TEXT
);
CREATE INDEX permit_geopin ON permit(geopin, applied_date);
CREATE INDEX permit_type_date ON permit(permit_type, issued_date);
CREATE INDEX permit_applied ON permit(applied_date);
CREATE INDEX permit_cost ON permit(est_cost);
CREATE INDEX permit_open ON permit(is_closed, status_date);
CREATE INDEX permit_unmatched ON permit(match_type) WHERE geopin IS NULL;

-- Permit timeline: status milestones, plan reviews, inspections, fees. From One Stop detail pages and our diffs.
CREATE TABLE permit_event (
  permit_num TEXT NOT NULL,
  seq        INTEGER NOT NULL,
  kind       TEXT NOT NULL,                    -- 'status' | 'review' | 'inspection' | 'fee' | 'observed_change'
  name       TEXT,                             -- 'Plan Review - Zoning', 'Final Electric', ...
  status     TEXT,                             -- 'Approved', 'Failed', 'Unscheduled', ...
  event_date TEXT,
  actor      TEXT,                             -- division or reviewer role; never staff email/phone
  detail     TEXT,
  source_id  TEXT NOT NULL,
  PRIMARY KEY (permit_num, seq)
);
CREATE INDEX permit_event_kind ON permit_event(kind, event_date);

CREATE TABLE code_case (
  case_id      INTEGER PRIMARY KEY,
  case_no      TEXT,                           -- '26-11902-MPM'
  system       TEXT NOT NULL,                  -- 'legacy' (u6yx-v2tw family) | 'obes' (wy29-i338 family)
  geopin INTEGER, address_id INTEGER, match_type TEXT NOT NULL, match_score REAL,
  address_raw  TEXT, block_id TEXT,
  stage TEXT, key_status TEXT, is_open INTEGER,
  filed_date TEXT, status_date TEXT,
  initial_inspection_date TEXT, initial_inspection_result TEXT,
  next_hearing_date TEXT, prev_hearing_date TEXT, prev_hearing_result TEXT,
  last_permit_num TEXT,                        -- the city's own case->permit link
  row_hash TEXT NOT NULL,
  first_seen_at TEXT NOT NULL, last_seen_at TEXT NOT NULL, removed_at TEXT
);
CREATE INDEX code_case_geopin ON code_case(geopin, filed_date);
CREATE INDEX code_case_open ON code_case(is_open, filed_date);
CREATE INDEX code_case_no ON code_case(case_no);

CREATE TABLE code_event (
  case_id    INTEGER NOT NULL,
  kind       TEXT NOT NULL,                    -- 'inspection' | 'violation' | 'hearing' | 'abatement' | 'fine'
  event_date TEXT,
  type       TEXT, result TEXT, detail TEXT,
  source_id  TEXT NOT NULL,
  source_key TEXT NOT NULL,                    -- upstream row identity, for idempotent upserts
  PRIMARY KEY (source_id, source_key)
);
CREATE INDEX code_event_case ON code_event(case_id, event_date);

CREATE TABLE str_license (
  str_id       TEXT PRIMARY KEY,               -- license number, else application reference code
  license_number TEXT, reference_code TEXT,
  geopin INTEGER, address_id INTEGER, match_type TEXT NOT NULL, match_score REAL,
  address_raw  TEXT, block_id TEXT,
  license_type TEXT,                           -- 'Residential' | 'Commercial' | 'Non-commercial' | ...
  status TEXT,                                 -- application/licence status as published
  is_active    INTEGER NOT NULL DEFAULT 0,     -- present in the active-licences dataset today
  applied_date TEXT, issued_date TEXT, expiration_date TEXT,
  operator_name TEXT,                          -- name only; phones/emails are dropped at ingest
  lat REAL, lon REAL,
  row_hash TEXT NOT NULL,
  first_seen_at TEXT NOT NULL, last_seen_at TEXT NOT NULL, removed_at TEXT
);
CREATE INDEX str_geopin ON str_license(geopin);
CREATE INDEX str_active ON str_license(is_active, license_type);

CREATE TABLE business_license (
  license_id TEXT PRIMARY KEY,
  geopin INTEGER, address_id INTEGER, match_type TEXT NOT NULL, match_score REAL,
  address_raw TEXT, block_id TEXT,
  business_name TEXT, business_type TEXT, status TEXT, issued_date TEXT,
  row_hash TEXT NOT NULL,
  first_seen_at TEXT NOT NULL, last_seen_at TEXT NOT NULL, removed_at TEXT
);
CREATE INDEX business_geopin ON business_license(geopin);

-- 311 requests, stored at block level only (no address, no point).
CREATE TABLE service_request (
  request_id   TEXT PRIMARY KEY,               -- '2021-847416'
  block_id     TEXT,
  request_type TEXT, request_reason TEXT,
  status TEXT, created_date TEXT, closed_date TEXT,
  row_hash TEXT NOT NULL,
  first_seen_at TEXT NOT NULL, last_seen_at TEXT NOT NULL
);
CREATE INDEX service_request_block ON service_request(block_id, created_date);
CREATE INDEX service_request_type ON service_request(request_type, created_date);

-- NOPD calls for service, aggregated to block x month x category. Raw rows stay in R2 only.
-- Per NOPD terms: never joined to a parcel or address, non-commercial use, show disclaimer.
CREATE TABLE police_call_month (
  block_id TEXT NOT NULL,
  month    TEXT NOT NULL,                      -- 'YYYY-MM'
  category TEXT NOT NULL,                      -- grouped from initial type, e.g. 'disturbance', 'theft', 'traffic'
  n        INTEGER NOT NULL,
  PRIMARY KEY (block_id, month, category)
);

-- ───────────── Read-optimized page support ─────────────

-- Precomputed per-parcel facts for the address page, MCP filters, and summaries.
CREATE TABLE parcel_summary (
  geopin INTEGER PRIMARY KEY REFERENCES parcel(geopin),
  permits_total INTEGER, permits_open INTEGER, last_permit_date TEXT, last_permit_type TEXT,
  permit_value_5y REAL,
  code_cases_total INTEGER, code_cases_open INTEGER, last_code_case_date TEXT,
  str_active INTEGER NOT NULL DEFAULT 0, str_type TEXT,
  demolition_permit_date TEXT,
  block_311_12m INTEGER, block_police_12m INTEGER,
  summary_text TEXT,                           -- plain-English, generated from these facts only
  computed_at TEXT NOT NULL
);
CREATE INDEX summary_open_cases ON parcel_summary(code_cases_open, last_permit_date);

-- Full-text search over permit descriptions ("roof", "solar", "demolish").
CREATE VIRTUAL TABLE permit_fts USING fts5(permit_num UNINDEXED, description, content='permit', content_rowid='rowid');

-- Records we could not place, by source, for the public "couldn't place these" page and the city feedback loop.
CREATE VIEW unmatched AS
  SELECT 'permit' AS entity, permit_num AS entity_id, address_raw, match_type FROM permit WHERE geopin IS NULL AND removed_at IS NULL
  UNION ALL SELECT 'code_case', CAST(case_id AS TEXT), address_raw, match_type FROM code_case WHERE geopin IS NULL AND removed_at IS NULL
  UNION ALL SELECT 'str_license', str_id, address_raw, match_type FROM str_license WHERE geopin IS NULL AND removed_at IS NULL;
