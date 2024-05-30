import { getCamera, CameraData, camera_of_se2, se2_of_camera, canvas_from_world_of_cameraData } from '../camera-state'
import { apply, compose, inverse, scale, translate } from '../se2';
import { Camera, Point } from '../types';
import { inv_xform, app_world_from_canvas, xform } from '../util';

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

  test('inverse have same behavior as inv_xform', () => {
    const camera: Camera = { x: 403, y: 201, zoom: 4 };
    const p_in_page: Point = { x: 12, y: 19 };
    const se2 = se2_of_camera(camera);
    const result1 = inv_xform(camera, p_in_page);
    const result2 = apply(inverse(se2), p_in_page);
    expect(result1).toEqual({
      x: expect.closeTo(result2.x),
      y: expect.closeTo(result2.y),
    });
  });

  test('should be inverse of camera_of_se2', () => {
    // ...as long as scale is isotropic with y-flip
    const se2 = compose(translate({ x: 4, y: 5 }), scale({ x: 5, y: -5 }));
    const se2b = se2_of_camera(camera_of_se2(se2));
    expect(se2b).toEqual({
      translate: { x: expect.closeTo(se2.translate.x), y: expect.closeTo(se2.translate.y) },
      scale: { x: expect.closeTo(se2.scale.x), y: expect.closeTo(se2.scale.y) },
    });
  });
});

describe('camera_of_se2', () => {
  test('should be inverse of se2_of_camera', () => {
    const camera: Camera = { x: 403, y: 201, zoom: 4 };
    const se2 = se2_of_camera(camera);
    const camera2 = camera_of_se2(se2);
    expect(camera).toEqual({
      x: expect.closeTo(camera2.x),
      y: expect.closeTo(camera2.y),
      zoom: expect.closeTo(camera2.zoom),
    });
  });
});

describe('inv_xform', () => {
  // inv_xform_d is deprecated
  test('should match inv_xform_d if origin is zero', () => {
    const page_from_world = compose(translate({ x: 4, y: 5 }), scale({ x: 5, y: -5 }));
    const cameraData: CameraData = { origin: { x: 19, y: 11 }, page_from_world };
    const camera: Camera = getCamera(cameraData);
    const p_in_page = { x: 578, y: 123 };
    const r1 = inv_xform(camera, p_in_page);
    const r2 = app_world_from_canvas(cameraData, p_in_page);
    expect(r1).toEqual({ x: expect.closeTo(r2.x), y: expect.closeTo(r2.y) });
  });
});
