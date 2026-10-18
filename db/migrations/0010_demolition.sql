-- ABOUTME: Demolitions from the frozen BlightStatus dataset (e3wd-h7q2, 2009–2019): NORA, IDC, FEMA and SDER programs.
-- ABOUTME: A table of its own because these records have no permit number to hang permit_event rows on.
CREATE TABLE demolition (
  demolition_id TEXT PRIMARY KEY,            -- hash of program, address and start date (the dataset has no id)
  geopin INTEGER, address_id INTEGER, match_type TEXT NOT NULL, match_score REAL,
  address_raw   TEXT, block_id TEXT,
  program       TEXT,                        -- 'NORA' | 'IDC' | 'FEMA' | 'SDER' | 'NOSD' | 'SDER (NOSD)'
  case_id       TEXT,                        -- program case id where published
  units         INTEGER,
  council_district_filed TEXT,
  start_date TEXT, complete_date TEXT,
  row_hash TEXT NOT NULL,
  first_seen_at TEXT NOT NULL, last_seen_at TEXT NOT NULL, removed_at TEXT
);
CREATE INDEX demolition_geopin ON demolition(geopin, start_date);

DROP VIEW unmatched;
CREATE VIEW unmatched AS
  SELECT 'permit' AS entity, permit_num AS entity_id, address_raw, match_type FROM permit WHERE geopin IS NULL AND removed_at IS NULL
  UNION ALL SELECT 'code_case', CAST(case_id AS TEXT), address_raw, match_type FROM code_case WHERE geopin IS NULL AND removed_at IS NULL
  UNION ALL SELECT 'str_license', str_id, address_raw, match_type FROM str_license WHERE geopin IS NULL AND removed_at IS NULL
  UNION ALL SELECT 'demolition', demolition_id, address_raw, match_type FROM demolition WHERE geopin IS NULL AND removed_at IS NULL;
