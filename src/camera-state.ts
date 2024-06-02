import { Point } from './types';
import { clone, scale_of_zoom, zoom_of_scale } from './util';
import { produce } from 'immer';
import { SE2, compose, composen, inverse, mkSE2, scale, translate } from './se2';
import { vadd, vdiag } from './vutil';
import { PANNING_MARGIN } from './main';

export type CameraData = {
  // The "origin" is the where the top-left of the canvas ends up in
  // webpage coordinates. We do this so that we can cheaply do panning
  // by letting the browser just move the <canvas> element around,
  // without actually repainting the canvas contents ourselves.

  // So this is the translation part of the transform page_from_canvas
  // It's always (0,0) whenever we aren't currently in the state of panning.
  page_from_canvas: Point,

  // page coordinates have (0,0) at the top left of the page and increase right and down
  // their units are pixels
  // canvas coordinates have (0,0) at the top left of the page and increase right and down
  // their units are pixels
  // world coordinates have (0,0) a bit south-west of the spring islands and increase east and north
  // their units are meters
  canvas_from_world: SE2,
};

export function mkCameraData(): CameraData {
  let canvas_from_world: SE2 = mkSE2({ x: 0.001953125, y: -0.001953125 }, { x: -432.125, y: 3321.875 });

  if (localStorage.page_from_world != null) {
    canvas_from_world = JSON.parse(localStorage.canvas_from_world);
  }

  return { page_from_canvas: { x: 0, y: 0 }, canvas_from_world };
}

export function doZoom(data: CameraData, p_in_canvas: Point, zoom: number): CameraData {
  var zoom_scale = Math.pow(2, zoom);

  const new_canvas_from_world = composen(
    translate(p_in_canvas),
    scale(vdiag(zoom_scale)),
    inverse(translate(p_in_canvas)),
    data.canvas_from_world,
  );

  const new_data = produce(data, d => {
    d.canvas_from_world = new_canvas_from_world;
  });
  return storeCam(new_data);
}

export function incCam(data: CameraData, dx: number, dy: number): CameraData {
  const new_canvas_from_world = compose(translate({ x: dx, y: dy }), data.canvas_from_world);
  const new_data = produce(data, d => {
    d.canvas_from_world = new_canvas_from_world;
  });
  return storeCam(new_data);
}

export function setOrigin(data: CameraData, x: number, y: number): CameraData {
  return produce(data, s => {
    s.page_from_canvas.x = x;
    s.page_from_canvas.y = y;
  });
}

export function getOrigin(data: CameraData): Point {
  return data.page_from_canvas;
}

export function incOrigin(data: CameraData, dx: number, dy: number): CameraData {
  return storeCam(produce(data, s => {
    s.page_from_canvas.x += dx;
    s.page_from_canvas.y += dy;
  }));
}


function storeCam(data: CameraData): CameraData {
  localStorage.canvas_from_world = JSON.stringify(data.canvas_from_world);
  return data;
}

export function page_from_world_of_cameraData(data: CameraData): SE2 {
  return compose(translate(data.page_from_canvas), data.canvas_from_world);
}

export function canvas_from_page_of_cameraData(data: CameraData): SE2 {
  return translate({ x: -data.page_from_canvas.x, y: -data.page_from_canvas.y });
}

export function canvas_from_world_of_cameraData(data: CameraData): SE2 {
  return data.canvas_from_world;
}

export function scale_of_camera(data: CameraData): number {
  return canvas_from_world_of_cameraData(data).scale.x;
}

export function zoom_of_camera(data: CameraData): number {
  return zoom_of_scale(scale_of_camera(data));
}

// This sets page_from_canvas and compensates so as to preserve page_from_world
export function set_offset_pres(data: CameraData, page_from_canvas: Point): CameraData {
  const new_canvas_from_world = composen(
    inverse(translate(page_from_canvas)),
    translate(data.page_from_canvas),
    data.canvas_from_world,
  );
  return produce(data, d => {
    d.page_from_canvas = page_from_canvas;
    d.canvas_from_world = new_canvas_from_world;
  });
}

function add_offset_pres(data: CameraData, dpage_from_canvas: Point): CameraData {
  return set_offset_pres(data, vadd(data.page_from_canvas, dpage_from_canvas));
}

function correctForPanning(data: CameraData): CameraData {
  if (data.page_from_canvas.x > 0) { data = add_offset_pres(data, { x: -PANNING_MARGIN, y: 0 }); }
  if (data.page_from_canvas.y > 0) { data = add_offset_pres(data, { y: -PANNING_MARGIN, x: 0 }); }
  if (data.page_from_canvas.x < -2 * PANNING_MARGIN) { data = add_offset_pres(data, { x: PANNING_MARGIN, y: 0 }); }
  if (data.page_from_canvas.y < -2 * PANNING_MARGIN) { data = add_offset_pres(data, { y: PANNING_MARGIN, x: 0 }); }
  return data;
}

export function inc_offset(data: CameraData, dpage_from_canvas: Point): CameraData {
  let new_page_from_canvas = vadd(data.page_from_canvas, dpage_from_canvas);

  return correctForPanning(produce(data, d => {
    d.page_from_canvas = new_page_from_canvas;
  }));
}
