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
