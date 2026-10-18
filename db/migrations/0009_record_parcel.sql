-- ABOUTME: Extra parcels a record names beyond its primary one ("1835-1839 Louisa St", "1800 Prytania St, 1808 Prytania St"),
-- ABOUTME: so a multi-address permit or case shows on every parcel it covers. The primary parcel stays on the record itself.
CREATE TABLE record_parcel (
  entity    TEXT NOT NULL,      -- 'permit' | 'code_case' | 'str_license' | 'business_license'
  entity_id TEXT NOT NULL,
  geopin    INTEGER NOT NULL REFERENCES parcel(geopin),
  PRIMARY KEY (entity, entity_id, geopin)
);
CREATE INDEX record_parcel_geopin ON record_parcel(geopin, entity);
