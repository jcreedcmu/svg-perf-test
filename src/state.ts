import { Point, Camera } from './types';
import { clone, scale_of_zoom } from './util';
import { produce } from 'immer';

export type CameraData = {
  origin: Point,
  camera: Camera,
};

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
