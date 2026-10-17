-- ABOUTME: Every One Stop record crawled from its public detail page. The id space covers far more than the
-- ABOUTME: building permits in the open datasets: HDLC/VCC reviews, special events, film, dumpsters, curb cuts.
CREATE TABLE onestop_record (
  onestop_id     INTEGER PRIMARY KEY,           -- SummaryContent.aspx?type=Permit&id=
  reference_code TEXT,
  permit_num     TEXT,                          -- set when it is (or links by reference code to) a permit
  record_type    TEXT,                          -- 'HDLC COA', 'Special Event - Master', 'Plumbing Permit', ...
  geopin INTEGER, address_id INTEGER, match_type TEXT NOT NULL, match_score REAL,
  address_raw    TEXT, block_id TEXT,
  description    TEXT,
  submitted_date TEXT,                          -- first status milestone date
  current_status TEXT,                          -- last completed status milestone
  detail_json    TEXT NOT NULL,                 -- parsed page (statuses, reviews, inspections, fees, contractors)
  fetched_at     TEXT NOT NULL,
  first_seen_at  TEXT NOT NULL, last_seen_at TEXT NOT NULL
);
CREATE INDEX onestop_geopin ON onestop_record(geopin, submitted_date);
CREATE INDEX onestop_type ON onestop_record(record_type, submitted_date);
CREATE INDEX onestop_ref ON onestop_record(reference_code);
CREATE INDEX permit_onestop_ref ON permit(onestop_ref);
