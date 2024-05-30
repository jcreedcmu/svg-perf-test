import { Point } from './types';
import { clone, scale_of_zoom, zoom_of_scale } from './util';
import { produce } from 'immer';
import { SE2, compose, composen, mkSE2, scale, translate } from './se2';
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

export function mkCameraData(): CameraData {
  let page_from_world: SE2 = mkSE2({ x: 0.001953125, y: -0.001953125 }, { x: -432.125, y: 3321.875 });

  if (localStorage.page_from_world != null) {
    page_from_world = JSON.parse(localStorage.page_from_world);
  }

  return { origin: { x: 0, y: 0 }, page_from_world };
}

export function doZoom(data: CameraData, x: number, y: number, zoom: number): CameraData {
  var zoom2 = Math.pow(2, zoom);
  // x and y are in page coordinates
  // target-centric coordinate system

  const new_page_from_world = composen(
    translate({ x, y }),
    scale(vdiag(zoom2)),
    translate({ x: -x, y: -y }),
    data.page_from_world,
  );

  const new_data = produce(data, d => {
    d.page_from_world = new_page_from_world;
  });
  return storeCam(new_data);
}

export function incCam(data: CameraData, dx: number, dy: number): CameraData {
  const new_page_from_world = compose(translate({ x: dx, y: dy }), data.page_from_world);
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

export function canvas_from_page_of_cameraData(data: CameraData): SE2 {
  return translate({ x: -data.origin.x, y: -data.origin.y });
}

export function canvas_from_world_of_cameraData(data: CameraData): SE2 {
  return compose(canvas_from_page_of_cameraData(data),
    page_from_world_of_cameraData(data));
}

export function scale_of_camera(data: CameraData): number {
  return canvas_from_world_of_cameraData(data).scale.x;
}

export function zoom_of_camera(data: CameraData): number {
  return zoom_of_scale(scale_of_camera(data));
}
