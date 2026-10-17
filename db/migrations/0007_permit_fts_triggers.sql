-- ABOUTME: Keeps the external-content permit_fts index in step with permit as the nightly Worker writes rows.
-- ABOUTME: The backfill still finishes with a full 'rebuild'; these triggers cover every write after that.
CREATE TRIGGER permit_fts_insert AFTER INSERT ON permit BEGIN
  INSERT INTO permit_fts(rowid, permit_num, description) VALUES (new.rowid, new.permit_num, new.description);
END;
CREATE TRIGGER permit_fts_delete AFTER DELETE ON permit BEGIN
  INSERT INTO permit_fts(permit_fts, rowid, permit_num, description) VALUES ('delete', old.rowid, old.permit_num, old.description);
END;
CREATE TRIGGER permit_fts_update AFTER UPDATE OF description ON permit BEGIN
  INSERT INTO permit_fts(permit_fts, rowid, permit_num, description) VALUES ('delete', old.rowid, old.permit_num, old.description);
  INSERT INTO permit_fts(rowid, permit_num, description) VALUES (new.rowid, new.permit_num, new.description);
END;
