-- ABOUTME: Staging table holding each source's own mapped row, so tables fed by several sources (three permit
-- ABOUTME: datasets, three STR datasets) can be re-merged for just the keys that changed in a nightly pull.
CREATE TABLE src_row (
  source_id     TEXT NOT NULL,
  key           TEXT NOT NULL,                 -- the target table's natural key
  row_json      TEXT NOT NULL,                 -- the adapter's mapped row
  match_json    TEXT,                          -- the adapter's MatchInput, when the table is matched to parcels
  row_hash      TEXT NOT NULL,
  first_seen_at TEXT NOT NULL,
  last_seen_at  TEXT NOT NULL,
  removed_at    TEXT,
  PRIMARY KEY (source_id, key)
);
CREATE INDEX src_row_key ON src_row(key);
