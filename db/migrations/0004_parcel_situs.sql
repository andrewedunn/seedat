-- ABOUTME: Lookup tables the nightly matcher prefetches from: parcel situs addresses by street and number, and
-- ABOUTME: an index for "which streets have this house number" (fuzzy street rung).
CREATE TABLE parcel_situs (
  street_key TEXT NOT NULL,
  number     INTEGER NOT NULL,
  geopin     INTEGER NOT NULL REFERENCES parcel(geopin),
  PRIMARY KEY (street_key, number, geopin)
);
CREATE INDEX address_number ON address(number);
CREATE INDEX parcel_situs_number ON parcel_situs(number);
