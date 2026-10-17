// ABOUTME: Tests for point-in-polygon, the polygon grid index, and representativePoint.
// ABOUTME: Covers holes, multipolygons, concave shapes whose centroid is outside, and edge behavior.
import { describe, expect, it } from "vitest";
import { PolygonIndex, pointInGeometry, representativePoint, type Polygon, type MultiPolygon, type Ring } from "../src/pip.js";

const square = (x0: number, y0: number, x1: number, y1: number): Ring => [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]];
const sq: Polygon = { type: "Polygon", coordinates: [square(0, 0, 10, 10)] };
const holed: Polygon = { type: "Polygon", coordinates: [square(0, 0, 10, 10), square(4, 4, 6, 6)] };
const multi: MultiPolygon = { type: "MultiPolygon", coordinates: [[square(0, 0, 2, 2)], [square(10, 10, 12, 12), square(10.5, 10.5, 11.5, 11.5)]] };
// Thin C and L shapes: their centroids fall in the empty notch, outside the polygon.
const cShape: Polygon = { type: "Polygon", coordinates: [[[0, 0], [10, 0], [10, 1], [1, 1], [1, 9], [10, 9], [10, 10], [0, 10], [0, 0]]] };
const lShape: Polygon = { type: "Polygon", coordinates: [[[0, 0], [10, 0], [10, 1], [1, 1], [1, 10], [0, 10], [0, 0]]] };

describe("pointInGeometry", () => {
  it("square", () => {
    expect(pointInGeometry(5, 5, sq)).toBe(true);
    expect(pointInGeometry(11, 5, sq)).toBe(false);
    expect(pointInGeometry(-1, -1, sq)).toBe(false);
  });
  it("hole excludes", () => {
    expect(pointInGeometry(5, 5, holed)).toBe(false);
    expect(pointInGeometry(2, 2, holed)).toBe(true);
  });
  it("multipolygon incl. its own hole", () => {
    expect(pointInGeometry(1, 1, multi)).toBe(true);
    expect(pointInGeometry(10.2, 10.2, multi)).toBe(true);
    expect(pointInGeometry(11, 11, multi)).toBe(false);
    expect(pointInGeometry(5, 5, multi)).toBe(false);
  });
  it("concave L", () => {
    expect(pointInGeometry(5, 0.5, lShape)).toBe(true);
    expect(pointInGeometry(5, 5, lShape)).toBe(false);
  });
  it("points on the boundary count as inside", () => {
    expect(pointInGeometry(0, 5, sq)).toBe(true);
    expect(pointInGeometry(10, 10, sq)).toBe(true);
    expect(pointInGeometry(5, 4, holed)).toBe(true); // on hole edge
  });
});

describe("representativePoint", () => {
  it("convex shape returns its centroid", () => {
    const [x, y] = representativePoint(sq);
    expect(x).toBeCloseTo(5);
    expect(y).toBeCloseTo(5);
  });
  it("is inside a C shape whose centroid is outside", () => {
    const p = representativePoint(cShape);
    expect(pointInGeometry(p[0], p[1], cShape)).toBe(true);
  });
  it("is inside an L shape", () => {
    const p = representativePoint(lShape);
    expect(pointInGeometry(p[0], p[1], lShape)).toBe(true);
  });
  it("avoids holes (donut)", () => {
    const donut: Polygon = { type: "Polygon", coordinates: [square(0, 0, 10, 10), square(1, 1, 9, 9)] };
    const p = representativePoint(donut);
    expect(pointInGeometry(p[0], p[1], donut)).toBe(true);
  });
  it("multipolygon: inside one of the parts", () => {
    const p = representativePoint(multi);
    expect(pointInGeometry(p[0], p[1], multi)).toBe(true);
  });
});

describe("PolygonIndex", () => {
  it("returns every containing polygon, none for misses", () => {
    const idx = new PolygonIndex<string>([
      { geom: sq, value: "sq" },
      { geom: holed, value: "holed" },
      { geom: multi, value: "multi" },
      { geom: { type: "Polygon", coordinates: [square(100, 100, 101, 101)] }, value: "far" },
    ]);
    expect(idx.query(2, 2).sort()).toEqual(["holed", "multi", "sq"]);
    expect(idx.query(5, 5)).toEqual(["sq"]);
    expect(idx.query(100.5, 100.5)).toEqual(["far"]);
    expect(idx.query(50, 50)).toEqual([]);
    expect(idx.query(-500, 500)).toEqual([]);
  });
  it("agrees with brute force on a grid of squares", () => {
    const items = [];
    for (let i = 0; i < 30; i++) for (let j = 0; j < 30; j++) items.push({ geom: { type: "Polygon", coordinates: [square(i, j, i + 0.8, j + 0.8)] } as Polygon, value: i * 100 + j });
    const idx = new PolygonIndex(items);
    for (let k = 0; k < 500; k++) {
      const x = (k * 7.13) % 31, y = (k * 3.77) % 31;
      const brute = items.filter((it) => pointInGeometry(x, y, it.geom)).map((it) => it.value).sort();
      expect(idx.query(x, y).sort()).toEqual(brute);
    }
  });
});
