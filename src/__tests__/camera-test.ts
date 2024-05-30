import { se2_of_camera } from '../camera-state'
import { apply } from '../se2';
import { Camera, Point } from '../types';
import { xform } from '../util';

describe('se2_of_camera', () => {
  test('should have same behavior as xform', () => {
    const camera: Camera = { x: 403, y: 201, zoom: 4 };
    const p_in_world: Point = { x: 100, y: 203 };
    const se2 = se2_of_camera(camera);
    const result1 = xform(camera, p_in_world);
    const result2 = apply(se2, p_in_world);
    expect(result1).toEqual({
      x: expect.closeTo(result2.x),
      y: expect.closeTo(result2.y),
    });
  });
});
