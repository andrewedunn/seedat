-- ABOUTME: The city's SITEADDID is not unique (108 ids are shared by unrelated addresses), so address_id becomes
-- ABOUTME: a stable hash of (SITEADDID, full address, unit) and the city's id moves to its own column.
ALTER TABLE address ADD COLUMN site_address_id INTEGER;
CREATE INDEX address_site_id ON address(site_address_id);
