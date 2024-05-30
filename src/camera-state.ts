import { Point, Camera } from './types';
import { clone, scale_of_zoom, zoom_of_scale } from './util';
import { produce } from 'immer';
import { SE2, compose, mkSE2, scale, translate } from './se2';
import { vdiag } from './vutil';

export type CameraData = {
  // The "origin" is the where the top-left of the canvas ends up in
  // webpage coordinates. We do this so that we can cheaply do panning
  // by letting the browser just move the <canvas> element around,
  // without actually repainting the canvas contents ourselves.

  // So this is the translation part of the transform page_from_canvas
  // It's always (0,0) whenever we aren't currently in the state of panning.
  origin: Point,

  // page coordinates have (0,0) at the top left of the page and increase right and down
  // their units are pixels
  // world coordinates have (0,0) a bit south-west of the spring islands and increase east and north
  // their units are meters
  page_from_world: SE2,
};

export function se2_of_camera(camera: Camera): SE2 {
  const scale_amount = scale_of_zoom(camera.zoom);
  return compose(translate({ x: camera.x, y: camera.y }), scale({ x: scale_amount, y: -scale_amount }));
}

export function camera_of_se2(se2: SE2): Camera {
  const xlate = compose(se2, scale({ x: 1 / se2.scale.x, y: -1 / se2.scale.y })).translate;

  const zoom = zoom_of_scale(se2.scale.x);
  return { x: xlate.x, y: xlate.y, zoom };
}

export function mkCameraData(): CameraData {
  let page_from_world: SE2 = mkSE2({ x: 0.001953125, y: -0.001953125 }, { x: -432.125, y: 3321.875 });

  if (localStorage.page_from_world != null) {
    page_from_world = JSON.parse(localStorage.page_from_world);
  }

  return { origin: { x: 0, y: 0 }, page_from_world };
}

export function getCamera(data: CameraData): Camera {
  return produce(camera_of_se2(data.page_from_world), d => {
    d.x -= data.origin.x;
    d.y -= data.origin.y;
  });
}

export function doZoom(data: CameraData, x: number, y: number, zoom: number): CameraData {
  var zoom2 = Math.pow(2, zoom);

  const old_camera = camera_of_se2(data.page_from_world);
  const new_camera = produce(old_camera, c => {
    c.x = zoom2 * (c.x - x) + x;
    c.y = zoom2 * (c.y - y) + y;
    c.zoom = c.zoom + zoom;
  });
  const new_page_from_world = se2_of_camera(new_camera);
  const new_data = produce(data, d => {
    d.page_from_world = new_page_from_world;
  });
  return storeCam(new_data);
}

export function setCam(data: CameraData, x: number, y: number): CameraData {
  const old_camera = camera_of_se2(data.page_from_world);
  const new_camera = produce(old_camera, c => {
    c.x = x;
    c.y = y;
  });
  const new_page_from_world = se2_of_camera(new_camera);
  const new_data = produce(data, d => {
    d.page_from_world = new_page_from_world;
  });
  return storeCam(new_data);
}

export function incCam(data: CameraData, dx: number, dy: number): CameraData {
  const old_camera = camera_of_se2(data.page_from_world);
  const new_camera = produce(old_camera, c => {
    c.x += dx;
    c.y += dy;
  });
  const new_page_from_world = se2_of_camera(new_camera);
  const new_data = produce(data, d => {
    d.page_from_world = new_page_from_world;
  });
  return storeCam(new_data);
}

export function setOrigin(data: CameraData, x: number, y: number): CameraData {
  return produce(data, s => {
    s.origin.x = x;
    s.origin.y = y;
  });
}

export function getOrigin(data: CameraData): Point {
  return data.origin;
}

export function incOrigin(data: CameraData, dx: number, dy: number): CameraData {
  return storeCam(produce(data, s => {
    s.origin.x += dx;
    s.origin.y += dy;
  }));
}


function storeCam(data: CameraData): CameraData {
  localStorage.page_from_world = JSON.stringify(data.page_from_world);
  return data;
}

export function page_from_world_of_cameraData(data: CameraData): SE2 {
  return data.page_from_world;
}
