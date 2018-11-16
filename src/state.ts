import { Point, RawCamera } from './types';
import { clone, scale_of_zoom } from './util';

export function cscale(c: RawCamera): number {
  return scale_of_zoom(c.zoom);
}

type Locus = any;
export class State {
  origin: Point;
  state: {
    camera: RawCamera,
    locus: Locus,
  };

  constructor() {
    this.origin = { x: 0, y: 0 };
    let camera: RawCamera = { x: -432.125, y: 3321.875, zoom: 4 };
    if (localStorage.camera != null) {
      camera = JSON.parse(localStorage.camera);
    }
    this.state = {
      camera: camera,
      locus: null,
    };
  }

  camera() {
    const c = clone(this.state.camera);
    c.x -= this.origin.x;
    c.y -= this.origin.y;

    return { ...c, scale: () => scale_of_zoom(c.zoom) };
  }

  zoom(x: number, y: number, zoom: number) {
    var zoom2 = Math.pow(2, zoom);
    const s = clone(this.state);
    s.camera.x = zoom2 * (s.camera.x - x) + x;
    s.camera.y = zoom2 * (s.camera.y - y) + y;
    s.camera.zoom = s.camera.zoom + zoom;
    this.state = s;
    this.store_cam();
  }

  store_cam() {
    localStorage.camera = JSON.stringify(this.state.camera);
  }

  set_cam(x: number, y: number) {
    this.state = clone(this.state);
    this.state.camera = { x, y, zoom: this.state.camera.zoom };
    this.store_cam();
  }

  inc_cam(dx: number, dy: number) {
    const s = clone(this.state);
    s.camera.x = s.camera.x + dx;
    s.camera.y = s.camera.y + dy;
    this.state = s;
    this.store_cam();
  }

  set_locus(p: Locus) {
    this.state.locus = p;
  }

  get_locus() {
    return this.state.locus;
  }

  set_origin(x: number, y: number) {
    this.origin.x = x;
    this.origin.y = y;
  }

  get_origin() {
    return this.origin;
  }

  inc_origin(dx: number, dy: number) {
    this.origin.x += dx;
    this.origin.y += dy;

  }
}
