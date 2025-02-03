import { CanvasInfo } from './use-canvas';
import { scale_of_camera, zoom_of_camera } from './camera-state';
import { colors } from './colors';
import { renderImageOverlay } from './images';
import { canvasIntoWorld } from './util';
import { getCanvasDims } from './canvas-utils';
import { getAvtPoint, renderCoastline } from './coastline';
import { MapCanvasState, get_bbox_in_world, render_scale } from './map-canvas';

export function render(ci: CanvasInfo, state: MapCanvasState) {
  const { d } = ci;
  console.log('painting');
  const { geo } = state;
  const dims = getCanvasDims(state.ui.mouseState);
  // background ocean
  d.fillStyle = colors.ocean;
  d.fillRect(0, 0, dims.x, dims.y);

  let cameraData = state.ui.cameraData;
  const ms = state.ui.mouseState;
  if (ms.t == 'pan') {
    cameraData = ms.cameraData;
  }
  const bbox_in_world = get_bbox_in_world(cameraData, dims);

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
    render_scale(d, dims, cameraData);

    // Ui Mode
    if (mode.t == 'normal') {
      d.fillStyle = "black";
      d.strokeStyle = "white";
      d.font = "bold 12px sans-serif";
      d.lineWidth = 2;
      d.strokeText(mode.tool, 20, dims.y - 20);
      d.fillText(mode.tool, 20, dims.y - 20);
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
