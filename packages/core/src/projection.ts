// ABOUTME: Converts Louisiana South state-plane coordinates (feet), used by many city datasets, to WGS84 lat/lon.
// ABOUTME: City xpos/ypos and the address points' LAT/LONG fields are in this system, not degrees.
import proj4 from "proj4";

// EPSG:3452, NAD83 / Louisiana South (ftUS). The city's ArcGIS layers report wkid 102682 / latestWkid 3452.
const LA_SOUTH_FTUS = "+proj=lcc +lat_0=28.5 +lon_0=-91.3333333333333 +lat_1=30.7 +lat_2=29.3 +x_0=999999.999996 +y_0=0 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=us-ft +no_defs";
const toWgs84 = proj4(LA_SOUTH_FTUS, "WGS84");

/** Returns null for the -1 / 0 placeholders the city uses for "not geocoded". */
export function statePlaneToLatLon(x: number | string | null | undefined, y: number | string | null | undefined): { lat: number; lon: number } | null {
  const fx = Number(x), fy = Number(y);
  if (!Number.isFinite(fx) || !Number.isFinite(fy) || fx <= 0 || fy <= 0) return null;
  const [lon, lat] = toWgs84.forward([fx, fy]);
  return { lat: lat!, lon: lon! };
}
