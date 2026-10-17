// ABOUTME: Pure-TS point-in-polygon for GeoJSON Polygon/MultiPolygon, a grid spatial index, and representativePoint.
// ABOUTME: Used at ingest to assign zoning, districts and other spatial attributes to parcels.

export type Ring = [number, number][];
export interface Polygon { type: "Polygon"; coordinates: Ring[] }
export interface MultiPolygon { type: "MultiPolygon"; coordinates: Ring[][] }
export type PolygonGeometry = Polygon | MultiPolygon;
export type BBox = [minX: number, minY: number, maxX: number, maxY: number];

const at = <T>(xs: readonly T[], i: number): T => xs[i] as T;

const polygonsOf = (g: PolygonGeometry): Ring[][] => (g.type === "Polygon" ? [g.coordinates] : g.coordinates);

export function bboxOf(g: PolygonGeometry): BBox {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const poly of polygonsOf(g)) {
    for (const [x, y] of at(poly, 0) ?? []) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  return [minX, minY, maxX, maxY];
}

/** -1 = on the ring's boundary, 1 = strictly inside, 0 = outside (even-odd crossing count). */
function ringSide(x: number, y: number, ring: Ring, bands?: RingBands): -1 | 0 | 1 {
  let inside = false;
  const edges = bands ? bands.edgesAt(y) : null;
  const n = edges ? edges.length : ring.length;
  for (let k = 0; k < n; k++) {
    const i = edges ? at(edges, k) : k;
    const j = i === 0 ? ring.length - 1 : i - 1;
    const [xi, yi] = at(ring, i), [xj, yj] = at(ring, j);
    const cross = (xj - xi) * (y - yi) - (yj - yi) * (x - xi);
    if (cross === 0 && x >= Math.min(xi, xj) && x <= Math.max(xi, xj) && y >= Math.min(yi, yj) && y <= Math.max(yi, yj)) return -1;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside ? 1 : 0;
}

/** Horizontal-band lookup of the edges that can cross or touch a given y, for rings with many vertices. */
class RingBands {
  private bands: number[][];
  private minY = Infinity;
  private h: number;
  constructor(ring: Ring, count = 128) {
    let maxY = -Infinity;
    for (const [, y] of ring) { if (y < this.minY) this.minY = y; if (y > maxY) maxY = y; }
    this.h = (maxY - this.minY) / count || 1;
    this.bands = Array.from({ length: count + 1 }, () => []);
    for (let i = 0; i < ring.length; i++) {
      const y1 = at(ring, i)[1], y2 = at(ring, i === 0 ? ring.length - 1 : i - 1)[1];
      const b0 = Math.floor((Math.min(y1, y2) - this.minY) / this.h), b1 = Math.floor((Math.max(y1, y2) - this.minY) / this.h);
      for (let b = b0; b <= b1; b++) at(this.bands, b).push(i);
    }
  }
  edgesAt(y: number): number[] {
    const b = Math.floor((y - this.minY) / this.h);
    return b < 0 || b >= this.bands.length ? [] : at(this.bands, b);
  }
}

const BAND_THRESHOLD = 256;
const bandCache = new WeakMap<Ring, RingBands | null>();
function bandsFor(ring: Ring): RingBands | undefined {
  let b = bandCache.get(ring);
  if (b === undefined) { b = ring.length >= BAND_THRESHOLD ? new RingBands(ring) : null; bandCache.set(ring, b); }
  return b ?? undefined;
}

function inPolygon(x: number, y: number, rings: Ring[]): boolean {
  const outer = ringSide(x, y, at(rings, 0), bandsFor(at(rings, 0)));
  if (outer === 0) return false;
  if (outer === -1) return true;
  for (let h = 1; h < rings.length; h++) {
    const s = ringSide(x, y, at(rings, h), bandsFor(at(rings, h)));
    if (s === -1) return true; // hole boundary belongs to the polygon
    if (s === 1) return false;
  }
  return true;
}

/** True if the point is inside the geometry. Points exactly on any ring boundary count as inside. */
export function pointInGeometry(x: number, y: number, g: PolygonGeometry): boolean {
  return polygonsOf(g).some((rings) => inPolygon(x, y, rings));
}

function ringArea(ring: Ring): number {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) a += at(ring, j)[0] * at(ring, i)[1] - at(ring, i)[0] * at(ring, j)[1];
  return a / 2;
}

/** Area-weighted centroid and net area (holes subtracted) of one polygon. */
function polygonCentroid(rings: Ring[]): { x: number; y: number; area: number } {
  let area = 0, cx = 0, cy = 0;
  rings.forEach((ring, idx) => {
    const sign = idx === 0 ? 1 : -1;
    let a = 0, rx = 0, ry = 0;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const f = at(ring, j)[0] * at(ring, i)[1] - at(ring, i)[0] * at(ring, j)[1];
      a += f;
      rx += (at(ring, j)[0] + at(ring, i)[0]) * f;
      ry += (at(ring, j)[1] + at(ring, i)[1]) * f;
    }
    if (a === 0) return;
    const w = sign * Math.abs(a) / 2;
    // centroid of the ring is (rx, ry) / (3a); weight by absolute area.
    cx += (rx / (3 * a)) * w;
    cy += (ry / (3 * a)) * w;
    area += w;
  });
  return area === 0 ? { x: NaN, y: NaN, area: 0 } : { x: cx / area, y: cy / area, area };
}

/** Widest interior interval along the horizontal line at y, as [x0, x1], or null. */
function widestInterval(y: number, rings: Ring[]): [number, number] | null {
  const xs: number[] = [];
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = at(ring, i), [xj, yj] = at(ring, j);
      if (yi > y !== yj > y) xs.push(((xj - xi) * (y - yi)) / (yj - yi) + xi);
    }
  }
  xs.sort((a, b) => a - b);
  let best: [number, number] | null = null;
  for (let k = 0; k + 1 < xs.length; k += 2) {
    const a = at(xs, k), b = at(xs, k + 1);
    if (b - a > (best ? best[1] - best[0] : 0)) best = [a, b];
  }
  return best;
}

/**
 * A point guaranteed to lie inside the geometry: the centroid of the largest part when it is
 * strictly inside, otherwise the midpoint of the widest interior segment on a horizontal line
 * (the centroid's latitude first, then lines across the part's bbox).
 */
export function representativePoint(g: PolygonGeometry): [number, number] {
  const parts = polygonsOf(g)
    .map((rings) => ({ rings, c: polygonCentroid(rings), a: Math.abs(ringArea(at(rings, 0))) }))
    .sort((p, q) => q.a - p.a);
  for (const { rings, c } of parts) {
    if (Number.isFinite(c.x) && ringStrictlyInside(c.x, c.y, rings)) return [c.x, c.y];
    const ys = at(rings, 0).map((p) => p[1]);
    const lo = Math.min(...ys), hi = Math.max(...ys);
    const candidates = [c.y, ...[0.5, 0.4, 0.6, 0.3, 0.7, 0.2, 0.8, 0.1, 0.9].map((f) => lo + (hi - lo) * f)].filter(Number.isFinite);
    for (const y of candidates) {
      const seg = widestInterval(y, rings);
      if (seg) return [(seg[0] + seg[1]) / 2, y];
    }
  }
  throw new Error("representativePoint: degenerate geometry");
}

function ringStrictlyInside(x: number, y: number, rings: Ring[]): boolean {
  if (ringSide(x, y, at(rings, 0)) !== 1) return false;
  return rings.slice(1).every((h) => ringSide(x, y, h) === 0);
}

interface IndexItem<T> { geom: PolygonGeometry; value: T; bbox: BBox }

/** Uniform-grid index over polygon bboxes; query returns values of all polygons containing the point. */
export class PolygonIndex<T> {
  private items: IndexItem<T>[] = [];
  private cells = new Map<number, number[]>();
  private minX = Infinity; private minY = Infinity;
  private cell = 1; private cols = 1;

  constructor(entries: { geom: PolygonGeometry; value: T }[]) {
    this.items = entries.map((e) => ({ ...e, bbox: bboxOf(e.geom) }));
    let maxX = -Infinity, maxY = -Infinity;
    for (const { bbox } of this.items) {
      this.minX = Math.min(this.minX, bbox[0]); this.minY = Math.min(this.minY, bbox[1]);
      maxX = Math.max(maxX, bbox[2]); maxY = Math.max(maxY, bbox[3]);
    }
    if (!this.items.length) return;
    const span = Math.max(maxX - this.minX, maxY - this.minY) || 1;
    const side = Math.max(1, Math.min(1024, Math.ceil(Math.sqrt(this.items.length) * 2)));
    this.cell = span / side;
    this.cols = side + 1;
    this.items.forEach((it, i) => {
      const [c0, r0] = this.cellOf(it.bbox[0], it.bbox[1]);
      const [c1, r1] = this.cellOf(it.bbox[2], it.bbox[3]);
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
        const key = r * this.cols + c;
        const list = this.cells.get(key);
        if (list) list.push(i); else this.cells.set(key, [i]);
      }
    });
  }

  private cellOf(x: number, y: number): [number, number] {
    return [Math.floor((x - this.minX) / this.cell), Math.floor((y - this.minY) / this.cell)];
  }

  query(x: number, y: number): T[] {
    const [c, r] = this.cellOf(x, y);
    if (c < 0 || r < 0 || c >= this.cols || r >= this.cols) return [];
    const out: T[] = [];
    for (const i of this.cells.get(r * this.cols + c) ?? []) {
      const it = at(this.items, i);
      if (x < it.bbox[0] || x > it.bbox[2] || y < it.bbox[1] || y > it.bbox[3]) continue;
      if (pointInGeometry(x, y, it.geom)) out.push(it.value);
    }
    return out;
  }
}
