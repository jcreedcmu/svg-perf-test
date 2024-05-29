import { Point, Camera } from './types';
import { clone, scale_of_zoom } from './util';

export type CameraData = {
  origin: Point,
  camera: Camera,
};

export class CameraState {
  data: CameraData;

  constructor() {
    let camera: Camera = { x: -432.125, y: 3321.875, zoom: 4 };
    if (localStorage.camera != null) {
      camera = JSON.parse(localStorage.camera);
    }
    this.data = { origin: { x: 0, y: 0 }, camera };
  }

  camera() {
    const c = clone(this.data.camera);
    c.x -= this.data.origin.x;
    c.y -= this.data.origin.y;

    return { ...c, scale: () => scale_of_zoom(c.zoom) };
  }

  zoom(x: number, y: number, zoom: number) {
    var zoom2 = Math.pow(2, zoom);
    const s = clone(this.data);
    s.camera.x = zoom2 * (s.camera.x - x) + x;
    s.camera.y = zoom2 * (s.camera.y - y) + y;
    s.camera.zoom = s.camera.zoom + zoom;
    this.data = s;
    this.store_cam();
  }

  store_cam() {
    localStorage.camera = JSON.stringify(this.data.camera);
  }

  set_cam(x: number, y: number) {
    this.data = clone(this.data);
    this.data.camera = { x, y, zoom: this.data.camera.zoom };
    this.store_cam();
  }

  inc_cam(dx: number, dy: number) {
    const s = clone(this.data);
    s.camera.x = s.camera.x + dx;
    s.camera.y = s.camera.y + dy;
    this.data = s;
    this.store_cam();
  }

  set_origin(x: number, y: number) {
    this.data.origin.x = x;
    this.data.origin.y = y;
  }

  get_origin() {
    return this.data.origin;
  }

  inc_origin(dx: number, dy: number) {
    this.data.origin.x += dx;
    this.data.origin.y += dy;

  }
}
