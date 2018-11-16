import { SmPoint, ArPoint, Camera } from './types';

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

export function adapt(x: SmPoint): ArPoint {
  return [x[0], x[1]];
}

// meant to be used in a default case
// to enforce exhaustive pattern matching
export function nope<T>(x: never): T {
  throw "nope";
}
