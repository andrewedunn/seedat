-- ABOUTME: State for the One Stop detail crawler that runs inside seedat-ingest on a one-minute cron.
-- ABOUTME: One row; the crawler pauses itself after a 429 until resume_after.
CREATE TABLE crawl_state (
  id            INTEGER PRIMARY KEY CHECK (id = 1),
  frontier_id   INTEGER NOT NULL,   -- highest id confirmed to exist; new records appear above it
  empty_streak  INTEGER NOT NULL DEFAULT 0,  -- consecutive empty ids above the frontier
  backfill_next INTEGER NOT NULL,   -- next id to fetch going down
  backfill_stop INTEGER NOT NULL,   -- lowest id the backfill goes to (Andrew: ~4 months for now)
  resume_after  TEXT,               -- set after a 429
  pages_ok INTEGER NOT NULL DEFAULT 0, pages_empty INTEGER NOT NULL DEFAULT 0, throttled INTEGER NOT NULL DEFAULT 0,
  updated_at    TEXT NOT NULL
);
