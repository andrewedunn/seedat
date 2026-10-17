// ABOUTME: Small geometry helpers: distance in meters and the ~100 m grid cell used for nearest-address lookups.
// ABOUTME: Lets D1 answer "what's near here" with an indexed equality lookup instead of spatial SQL.

const EARTH_RADIUS_M = 6_371_000;

export function metersBetween(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = Math.PI / 180;
  const dLat = (lat2 - lat1) * toRad, dLon = (lon2 - lon1) * toRad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

/** Grid size in degrees: 0.001° is ~111 m north-south and ~96 m east-west at New Orleans' latitude. */
export const CELL_DEGREES = 0.001;

export function cellOf(lat: number, lon: number): string {
  return `${Math.floor(lat / CELL_DEGREES)}:${Math.floor(lon / CELL_DEGREES)}`;
}

/** The cell and its eight neighbours; enough to cover any radius under one cell width. */
export function cellsAround(lat: number, lon: number): string[] {
  const r = Math.floor(lat / CELL_DEGREES), c = Math.floor(lon / CELL_DEGREES);
  const out: string[] = [];
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) out.push(`${r + dr}:${c + dc}`);
  return out;
}

/** Levenshtein distance with an early exit once it exceeds `max`. */
export function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const v = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
      cur.push(v);
      rowMin = Math.min(rowMin, v);
    }
    if (rowMin > max) return max + 1;
    prev = cur;
  }
  return prev[b.length]!;
}
