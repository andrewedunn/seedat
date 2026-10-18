-- ABOUTME: Index on a permit's effective date, so citywide permit searches sorted newest-first avoid a full sort.
-- ABOUTME: Matches the ORDER BY coalesce(applied_date, issued_date) used by search_permits and the property page.
CREATE INDEX permit_effective_date ON permit(coalesce(applied_date, issued_date));
