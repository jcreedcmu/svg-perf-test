import { Dict, Point, RawArc, RawPoly, Arc } from '../types';
import { simplify, resimplify_arc } from '../simplify';
import { ArcStore } from '../arcstore';
import { data } from './data';

const points: Dict<Point> = {}
const arcs: Dict<RawArc> = { 'a': { points: [] } };
const polys: Dict<RawPoly> = { 'f': { arcs: [{ id: 'a' }], properties: { t: "natural", natural: "coastline" } } };

data.forEach((p, n) => {
  points['p' + n] = p;
  arcs['a'].points.push('p' + n);
});

const expected: Dict<Arc> = {
  "a": {
    "name": "a",
    "bbox": {
      "minX": 721612, "minY": 1273753,
      "maxX": 737689, "maxY": 1280000
    },
    "_points": [
      { "point": { "id": "p0" }, "z": 50800886 },
      { "point": { "id": "p1" }, "z": 11930952 },
      { "point": { "id": "p2" }, "z": 7991624 },
      { "point": { "id": "p3" }, "z": 50800886 },
      { "point": { "id": "p4" }, "z": 8810788 },
      { "point": { "id": "p5" }, "z": 50800886 },
      { "point": { "id": "p6" }, "z": 6961398 },
      { "point": { "id": "p7" }, "z": 5664768 },
      { "point": { "id": "p8" }, "z": 50800886 }
    ]
  }
};

test('arcstore', () => {
  const ars = new ArcStore(points, arcs, polys);
  expect(ars.arcs).toEqual(expected);
});
