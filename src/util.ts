import { CameraData, canvas_from_world_of_cameraData } from './camera-state';
import { apply, inverse } from './se2';
import { Bbox, Bush, Dict, Label, Point, Poly, RawLabel, RawPoly } from './types';

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
}

export function zoom_of_scale(scale: number): number {
  return Math.log(1024 * 8 * scale) / Math.log(2);
}

const SIMPLIFICATION_FACTOR = 10; // higher = more simplification

// true if the z-coordinate (which means the point is more resistant
// to simplification the bigger it is) should be displayed at scale
export function above_simp_thresh(z: number, scale: number): boolean {
  return z > SIMPLIFICATION_FACTOR / (scale * scale);
}

// meant to be used in a default case
// to enforce exhaustive pattern matching
export function nope<T>(x: never): T {
  throw "nope";
}

export function app_canvas_from_world(cameraData: CameraData, p_in_world: Point): Point {
  return apply(canvas_from_world_of_cameraData(cameraData), p_in_world);
}

export function app_world_from_canvas(cameraData: CameraData, p_in_page: Point): Point {
  return apply(inverse(canvas_from_world_of_cameraData(cameraData)), p_in_page);
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

export function rawOfPoly(poly: Poly): RawPoly {
  return {
    arcs: poly.arcs,
    properties: poly.properties,
  };
}

export function unrawOfLabel(name: string, label: RawLabel): Label {
  return {
    name,
    pt: { x: label.pt[0], y: label.pt[1] },
    properties: label.properties,
  };
}

export function rawOfLabel(label: Label): RawLabel {
  return {
    pt: [label.pt.x, label.pt.y],
    properties: label.properties,
  };
}

export function trivBbox(): Bbox {
  return {
    minX: Number.MAX_VALUE, minY: Number.MAX_VALUE,
    maxX: Number.MIN_VALUE, maxY: Number.MIN_VALUE
  };
}

export function unrawOfPoly(name: string, poly: RawPoly): Poly {
  return {
    name,
    properties: poly.properties,
    bbox: trivBbox(),
    arcs: poly.arcs,
  };
}

export function insertPt<T>(rt: Bush<T>, pt: Point, payload: T): void {
  rt.insert({
    minX: pt.x, maxX: pt.x,
    minY: pt.y, maxY: pt.y,
    payload
  });
}

export function removePt<T>(rt: Bush<T>, pt: Point): void {
  rt.search({
    minX: pt.x, maxX: pt.x,
    minY: pt.y, maxY: pt.y,
  }).forEach(res => {
    rt.remove(res);
  });
}

export function removeSamePt<T>(rt: Bush<T>, pt: Point, payload: T): void {
  rt.remove(
    {
      minX: pt.x, maxX: pt.x,
      minY: pt.y, maxY: pt.y,
      payload
    },
    (a, b) => a.payload == b.payload
  );
}

export function findPt<T>(rt: Bush<T>, pt: Point): T[] {
  const res = rt.search({
    minX: pt.x, maxX: pt.x,
    minY: pt.y, maxY: pt.y,
  });
  return res.map(x => x.payload);
}

// adds a k,v pair to a one-to-many map m, first inserting the empty
// list if necessary
export function colAppend<T>(m: Dict<T[]>, k: string, v: T) {
  if (!m[k])
    m[k] = [];
  m[k].push(v);
}

export function vint(p: Point): Point {
  return { x: Math.floor(p.x), y: Math.floor(p.y) };
}

export type Buffer = {
  c: HTMLCanvasElement,
  d: CanvasRenderingContext2D,
}

export function buffer(sz: Point): Buffer {
  const c = document.createElement('canvas');
  c.width = sz.x;
  c.height = sz.y;
  const d = c.getContext('2d');
  if (d == null) {
    throw "couldn't create canvas rendering context for buffer";
  }
  return { c, d };
}

export function colorToHex(c: number[]) {
  function comp(c: number): string {
    const hex = c.toString(16);
    return hex.length == 1 ? '0' + hex : hex;
  }
  return '#' + comp(c[0]) + comp(c[1]) + comp(c[2]);
}

export function canvasIntoWorld(d: CanvasRenderingContext2D, cameraData: CameraData): void {
  const canvas_from_world = canvas_from_world_of_cameraData(cameraData);
  const scale = canvas_from_world.scale.x;
  const xlate = canvas_from_world.translate;
  d.translate(xlate.x, xlate.y);
  d.scale(scale, -scale);
}
