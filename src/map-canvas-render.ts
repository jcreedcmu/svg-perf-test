import { CameraData, scale_of_camera, zoom_of_camera } from './camera-state';
import { getCanvasDims } from './canvas-utils';
import { getAvtPoint, renderCoastline } from './coastline';
import { colors } from './colors';
import { renderImageOverlay } from './images';
import { DEBUG } from './consts';
import { Geometry, Point, Rect, UiState } from './types';
import { app_world_from_canvas, canvasIntoWorld, meters_to_string } from './util';

const OFFSET = DEBUG ? 100 : 0;

export type MapCanvasState = {
  ui: UiState,
  geo: Geometry,
}

export function get_bbox_in_world(cameraData: CameraData, size: Point): Rect {
  const { x: w, y: h } = size;
  const tl = app_world_from_canvas(cameraData, { x: OFFSET, y: OFFSET });
  const br = app_world_from_canvas(cameraData, { x: w - OFFSET, y: h - OFFSET });
  return [tl.x, br.y, br.x, tl.y];
}

export function render_scale(d: CanvasRenderingContext2D, size: Point, cameraData: CameraData): void {
  const scale = scale_of_camera(cameraData);
  const { x: w, y: h } = size;
  d.save();
  d.fillStyle = "black";
  d.font = "10px sans-serif";

  d.translate(Math.floor(w / 2) + 0.5, 0.5);
  function label(px_dist: number) {
    const str = meters_to_string(px_dist / scale);
    d.textAlign = "center";
    d.fillText(str, px_dist, h - 12);
  }
  d.lineWidth = 1;
  d.strokeStyle = "rgba(0,0,0,0.1)";
  d.strokeRect(0, h - 25 - 50, 50, 50);
  d.strokeRect(0, h - 25 - 128, 128, 128);
  d.beginPath()
  d.strokeStyle = "black";
  d.moveTo(0, h - 30);
  d.lineTo(0, h - 25);
  d.lineTo(50, h - 25);
  d.lineTo(50, h - 30);
  d.moveTo(50, h - 25);
  d.lineTo(128, h - 25);
  d.lineTo(128, h - 30);
  d.stroke();
  label(0);
  label(50);
  label(128);

  d.restore();
}

export function render(d: CanvasRenderingContext2D, canvasDims: Point, state: MapCanvasState) {
  console.log('painting');
  const { geo } = state;
  // background ocean
  d.fillStyle = colors.ocean;
  d.fillRect(0, 0, canvasDims.x, canvasDims.y);

  let cameraData = state.ui.cameraData;
  const ms = state.ui.mouseState;
  if (ms.t == 'pan') {
    cameraData = ms.cameraData;
  }
  const bbox_in_world = get_bbox_in_world(cameraData, canvasDims);

  const mm = state.ui.mode.t == 'normal' ? state.ui.mode.tool : 'Pan';
  renderCoastline({
    d, bbox_in_world, cameraData, mode: mm, us: state.ui,
  }, geo.arcStore, geo.labelStore);

  const { mode } = state.ui;
  const { named_imgs, cur_img_ix, overlay } = state.ui.imageLayerState;
  renderImageOverlay(d, cameraData, named_imgs, cur_img_ix, overlay == null ? null : (window as any)._image);

  geo.riverLayer.render({
    d, bbox_in_world, cameraData, mode: mm, us: state.ui,
  });
  geo.sketchLayer.render({
    d, bbox_in_world, cameraData, mode: mm, us: state.ui,
  });

  // vertex highlight
  const tgt = state.ui.lastz[0];
  if (tgt != undefined) {
    const scale = scale_of_camera(cameraData);
    const rad = 3 / scale;
    d.save();
    canvasIntoWorld(d, cameraData);

    if (tgt[0] == "coastline") {
      const pt = getAvtPoint(geo.arcStore, tgt[1]);
      d.fillStyle = "white";
      d.fillRect(pt.x - rad, pt.y - rad, rad * 2, rad * 2);
      d.lineWidth = 1 / scale;
      d.strokeStyle = "black";
      d.strokeRect(pt.x - rad, pt.y - rad, rad * 2, rad * 2);

      d.strokeStyle = colors.motion_guide;
      d.strokeRect(pt.x - 2 * rad, pt.y - 2 * rad, rad * 4, rad * 4);
    }
    else if (tgt[0] == "label") {
      const pt = geo.labelStore.labels[tgt[1]].pt;
      d.beginPath();
      d.fillStyle = "white";
      d.globalAlpha = 0.5;
      d.arc(pt.x, pt.y, 20 / scale, 0, Math.PI * 2);
      d.fill();
    }

    d.restore();

  }
  const panning = state.ui.mouseState.t == 'pan';
  if (!panning) {

    // Distance Scale
    render_scale(d, canvasDims, cameraData);

    // Ui Mode
    if (mode.t == 'normal') {
      d.fillStyle = "black";
      d.strokeStyle = "white";
      d.font = "bold 12px sans-serif";
      d.lineWidth = 2;
      d.strokeText(mode.tool, 20, canvasDims.y - 20);
      d.fillText(mode.tool, 20, canvasDims.y - 20);
    }

    // Zoom indicator
    d.fillStyle = "black";
    d.strokeStyle = "white";
    d.font = "bold 12px sans-serif";
    d.lineWidth = 2;

    const scale = scale_of_camera(cameraData);
    const { named_imgs, cur_img_ix } = state.ui.imageLayerState;
    const { slastz } = state.ui;
    const img_name = named_imgs[cur_img_ix].name;
    const txt = "Zoom: " + Math.round(zoom_of_camera(cameraData)) + " (1px = " + Math.round(1 / scale) + "m) lastz: " + slastz + " img: " + named_imgs[cur_img_ix].name;
    d.strokeText(txt, 20, 20);
    d.fillText(txt, 20, 20);

    // TODO: "Render Extra", like point dragging
    // TODO: Selection
  }
}
