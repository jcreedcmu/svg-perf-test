import { Point, Camera } from './types';
import { clone, scale_of_zoom } from './util';
import { produce } from 'immer';
import { SE2, compose, scale, translate } from './se2';
import { vdiag } from './vutil';

// I'd like to use SE2 here, but one obstacle to that being nice is
// that I would like to 'snap' to power of two zoom levels. I guess
// that's probably not impossible to do somehow, though.

export type CameraData = {
  // The "origin" is the where the top-left of the canvas ends up in
  // webpage coordinates. We do this so that we can cheaply do panning
  // by letting the browser just move the <canvas> element around,
  // without actually repainting the canvas contents ourselves.

  // So this is the translation part of the transform page_from_canvas
  origin: Point,
  // Camera has an x and y and zoom level. I think the "forward transform"
  // given by xform page_from_world.
  camera: Camera,
};

function se2_of_camera(camera: Camera): SE2 {
  return compose(translate({ x: camera.x, y: camera.y }), scale(vdiag(scale_of_zoom(camera.zoom))));
}

export function mkCameraData(): CameraData {
  let camera: Camera = { x: -432.125, y: 3321.875, zoom: 4 };
  if (localStorage.camera != null) {
    camera = JSON.parse(localStorage.camera);
  }
  return { origin: { x: 0, y: 0 }, camera };

}

export function getCamera(data: CameraData): Camera {
  return produce(data.camera, d => {
    d.x -= data.origin.x;
    d.y -= data.origin.y;
  });
}

export function doZoom(data: CameraData, x: number, y: number, zoom: number): CameraData {
  var zoom2 = Math.pow(2, zoom);
  return storeCam(produce(data, s => {
    s.camera.x = zoom2 * (s.camera.x - x) + x;
    s.camera.y = zoom2 * (s.camera.y - y) + y;
    s.camera.zoom = s.camera.zoom + zoom;
  }));
}

export function setCam(data: CameraData, x: number, y: number): CameraData {
  return storeCam(produce(data, s => {
    s.camera = { x, y, zoom: data.camera.zoom };
  }));

}

export function incCam(data: CameraData, dx: number, dy: number): CameraData {
  return storeCam(produce(data, s => {
    s.camera.x += dx;
    s.camera.y += dy;
  }));
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
  localStorage.camera = JSON.stringify(data.camera);
  return data;
}
