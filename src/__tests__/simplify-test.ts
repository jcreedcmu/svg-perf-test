import { Geo } from '../types';
import { simplify } from '../simplify';

// Got this out of
// console.log(JSON.stringify(app.coastline_layer.arcStore.arcs["arc380"]._points.map(pt => app.coastline_layer.arcStore.points[pt.point.id])))

// this island is found just south (and a little west) of the label "Miatesork Bay" in the south of Piada at zoom 5.
const data =
  [{ "x": 731750, "y": 1278464 },
  { "x": 728678, "y": 1277132 },
  { "x": 722534, "y": 1278976 },
  { "x": 721612, "y": 1277952 },
  { "x": 731000, "y": 1274952 },
  { "x": 737689, "y": 1273753 },
  { "x": 734003, "y": 1277849 },
  { "x": 735334, "y": 1280000 },
  { "x": 731750, "y": 1278464 }];

const expectedData =
  [{ point: { x: 731750, y: 1278464 }, z: 50800886, extra: 0 },
  { point: { x: 728678, y: 1277132 }, z: 11930952, extra: 1 },
  { point: { x: 722534, y: 1278976 }, z: 7991624, extra: 2 },
  { point: { x: 721612, y: 1277952 }, z: 50800886, extra: 3 },
  { point: { x: 731000, y: 1274952 }, z: 8810788, extra: 4 },
  { point: { x: 737689, y: 1273753 }, z: 50800886, extra: 5 },
  { point: { x: 734003, y: 1277849 }, z: 6961398, extra: 6 },
  { point: { x: 735334, y: 1280000 }, z: 5664768, extra: 7 },
  { point: { x: 731750, y: 1278464 }, z: 50800886, extra: 8 }];

test('basic', () => {
  const z = simplify(data.map((point, n) => ({ point, extra: n })));
  expect(z).toEqual(expectedData);
});
