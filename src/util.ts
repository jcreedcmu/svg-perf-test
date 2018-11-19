import { Point, Zpoint, ArPoint, Camera, Rect, Bbox } from './types';
import { Arc, RawArc, Poly, RawPoly, Label, RawLabel, ArcSpec, Dict } from './types';

export function clone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x));
}

// export function mkobj<V>(xs: [string, V][]): { [k: string]: V } {
//   const rv: { [k: string]: V } = {};
//   xs.forEach(x => { rv[x[0]] = x[1] });
//   return rv;
// }

// export function omap<W, B>(ob: { [k: string]: W }, f: (k: string, v: W) => B): B[] {
//   const e: [string, W][] = Object.entries(ob);
//   return e.map(([k, v]) => f(k, v));
// }

export function vmap<V, W>(xs: { [k: string]: W }, f: (x: W) => V): { [k: string]: V } {
  const rv: { [k: string]: V } = {};
  Object.keys(xs).forEach(k => rv[k] = f(xs[k]));
  return rv;
}

export function vkmap<V, W>(xs: { [k: string]: W }, f: (k: string, x: W) => V): { [k: string]: V } {
  const rv: { [k: string]: V } = {};
  Object.keys(xs).forEach(k => rv[k] = f(k, xs[k]));
  return rv;
}

export function scale_of_zoom(zoom: number): number {
  return (1 / 8) * (1 / 1024) * Math.pow(2, zoom);
};

export function cscale(c: Camera): number {
  return scale_of_zoom(c.zoom);
}

const SIMPLIFICATION_FACTOR = 10; // higher = more simplification

// true if the z-coordinate (which means the point is more resistant
// to simplification the bigger it is) should be displayed at scale
export function above_simp_thresh(z: number, scale: number): boolean {
  return z > SIMPLIFICATION_FACTOR / (scale * scale);
}

export function adapt(x: Zpoint): ArPoint {
  return [x.point[0], x.point[1]];
}

// meant to be used in a default case
// to enforce exhaustive pattern matching
export function nope<T>(x: never): T {
  throw "nope";
}

export function xform(camera: Camera, xworld: number, yworld: number): Point {
  return { x: camera.x + xworld * cscale(camera), y: camera.y - yworld * cscale(camera) };
}

export function inv_xform(camera: Camera, xpix: number, ypix: number): Point {
  return {
    x: (xpix - camera.x) / cscale(camera),
    y: (ypix - camera.y) / -cscale(camera)
  };
}

export function meters_to_string(raw: number): string {
  let str = "0";
  if (raw > 0) {
    str = (raw > 1000) ? Math.floor(raw / 10) / 100 + "km" : Math.floor(raw) + "m";
  }
  return str;
}

export function vdist(p1: Point, p2: Point) {
  function sqr(x: number) { return x * x };
  return Math.sqrt(sqr(p1.x - p2.x) + sqr(p1.y - p2.y));
}

export function rawOfArc(arc: Arc): RawArc {
  return {
    points: arc.points.map(({ point: p }) => {
      const z: ArPoint = [p[0], p[1]];
      return z;
    })
  };
}

export function unrawOfArc(name: string, arc: RawArc): Arc {
  const { points } = arc;
  return {
    name,
    bbox: { minx: 1e9, miny: 1e9, maxx: -1e9, maxy: -1e9 },
    points: points.map(p => {
      const z: Zpoint = { point: p, z: 1e9 };
      return z;
    })
  };
}

export function rawOfPoly(poly: Poly): RawPoly {
  return {
    arcs: poly.arcs,
    properties: poly.properties,
  };
}

export function unrawOfLabel(name: string, label: RawLabel): Label {
  return {
    name,
    pt: label.pt,
    properties: label.properties,
  };
}

export function rawOfLabel(label: Label): RawLabel {
  return {
    pt: label.pt,
    properties: label.properties,
  };
}

export function trivBbox(): Bbox {
  return { minx: 1e9, miny: 1e9, maxx: -1e9, maxy: -1e9 };
}

export function unrawOfPoly(name: string, poly: RawPoly): Poly {
  return {
    name,
    properties: poly.properties,
    bbox: trivBbox(),
    arcs: poly.arcs,
  };
}

export function getArc(arcs: Dict<Arc>, spec: ArcSpec) {
  return arcs[spec.id];
}
