import { produce } from 'immer';
import * as React from 'react';
import { useEffect } from 'react';
import { Action, ArRectangle, Dict, Geometry, MouseState, Point, Rect, SizedImage, Target, UiMode, UiState } from './types';
import { Dispatch, SIDEBAR_WIDTH } from './ui';
import { CanvasInfo, useCanvas } from './use-canvas';
import { compose, translate } from './se2';
import { vadd, vsub } from './vutil';
import { OFFSET } from './main';
import { CameraData, scale_of_camera, set_offset_pres, zoom_of_camera } from './camera-state';
import { colors } from './colors';
import { renderImageOverlay } from './images';
import { app_world_from_canvas, canvasIntoWorld, meters_to_string } from './util';
import { getCanvasDims } from './canvas-utils';
import { getAvtPoint, getTargets, renderCoastline } from './coastline';

const VERTEX_SENSITIVITY = 10;

export function get_bbox_in_world(cameraData: CameraData, size: Point): Rect {
  const { x: w, y: h } = size;
  const tl = app_world_from_canvas(cameraData, { x: OFFSET, y: OFFSET });
  const br = app_world_from_canvas(cameraData, { x: w - OFFSET, y: h - OFFSET });
  return [tl.x, br.y, br.x, tl.y];
}

export type MapCanvasProps = {
  uiState: UiState,
  dispatch: Dispatch,
  geo: Geometry,
};

export type MapCanvasState = {
  ui: UiState,
  geo: Geometry,
}

function render_scale(d: CanvasRenderingContext2D, size: Point, cameraData: CameraData): void {
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

function render(ci: CanvasInfo, state: MapCanvasState) {
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
  const bbox_in_world = get_bbox_in_world(cameraData, dims)

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


function handleMouseWheel(e: React.WheelEvent, dispatch: Dispatch): void {
  const x = e.pageX!;
  const y = e.pageY!;
  const zoom = e.deltaY > 0 ? -1 : 1;
  e.preventDefault();
  dispatch({ t: 'doZoom', zoom_amount: zoom, p_in_canvas: { x: e.pageX!, y: e.pageY! } });
}

function equalTargets(t1: Target | undefined, t2: Target | undefined): boolean {
  if (t1 == undefined) return t2 == undefined;
  return t2 !== undefined && JSON.stringify(t1) == JSON.stringify(t2);
}

function shouldShowVertices(state: UiState): boolean {
  const { mode } = state;
  if (mode.t != 'normal') return false;
  if (state.mouseState.t != 'up') return false;
  if (mode.tool == 'Pan') return true;
  if (mode.tool == 'Move') return true;
  return false;
}

export function MapCanvas(props: MapCanvasProps): JSX.Element {
  const { uiState: state, dispatch, geo } = props;
  const [cref, mc] = useCanvas({ ui: state, geo }, render,

    // Some discussion on what should cause changes of state here:
    //
    // - The moment we start panning, we should repaint (with expanded
    //   boundaries)
    //
    // - Whenever we do a mousemove that would make us pan so that our
    //   boundary-expansion strategy is noticeable, the reduce should change
    //   our 'origin', i.e. page_from_canvas

    [
      state.slastz,
      state.mouseState.t,
      state.mode,
      state.cameraData,
      state.layers,
      state.mouseState.t == 'pan' ? state.mouseState.cameraData.canvas_from_world : undefined,
      state.imageLayerState,
      // note that geo isn't here
    ],
    () => { }
  );

  useEffect(() => {
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    }
  }, [state]);

  function onMouseDown(e: React.MouseEvent) {
    dispatch({ t: 'mouseDown', p_in_page: { x: e.pageX!, y: e.pageY! } })
  }

  function onMouseMove(e: MouseEvent) {
    const p_in_page = { x: e.pageX!, y: e.pageY! };
    if (shouldShowVertices(state)) {
      const actions: Action[] = [{ t: 'mouseMove', p_in_page }];
      const p_in_world = app_world_from_canvas(state.cameraData, p_in_page);
      const rad = VERTEX_SENSITIVITY / scale_of_camera(state.cameraData);
      const bbox: ArRectangle = [
        p_in_world.x - rad, p_in_world.y - rad,
        p_in_world.x + rad, p_in_world.y + rad
      ];
      const targets = getTargets(bbox, geo.arcStore, geo.labelStore);
      const newHighlight: Target | undefined = targets.length > 0 ? targets[0] : undefined;
      const oldHighlight: Target | undefined = state.lastz[0];
      if (!equalTargets(oldHighlight, newHighlight)) {
        actions.push({ t: 'setHighlight', highlight: newHighlight })
      }
      dispatch({ t: 'multiple', actions });
    }
    else {
      dispatch({ t: 'mouseMove', p_in_page })
    }
  }

  function onMouseUp(e: MouseEvent) {
    dispatch({ t: 'mouseUp', p_in_page: { x: e.pageX!, y: e.pageY! } })
  }

  const ms = state.mouseState;
  /* if (ms.t == 'pan') {
   *   canvasStyle = {
   *     top: ms.page_from_canvas.y + ms.p_in_page.y - ms.orig_p_in_page.y,
   *     left: ms.page_from_canvas.x + ms.p_in_page.x - ms.orig_p_in_page.x, position: 'fixed'
   *   };
   * } */

  const dims = getCanvasDims(state.mouseState);
  const canvasStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0, left: 0,
    width: dims.x,
    height: dims.y,
  };

  if (mc.current) {
    // const origin = {x:-margin, y:-margin};
    if (mc.current) {
      const c = mc.current.c;
      // c.width = dims.x * devicePixelRatio;
      // c.height = dims.y * devicePixelRatio;
    }

    if (ms.t == 'pan') {
      canvasStyle.top = ms.cameraData.page_from_canvas.y;
      canvasStyle.left = ms.cameraData.page_from_canvas.x;
    }
  }

  return <canvas
    onMouseDown={onMouseDown}
    onWheel={e => handleMouseWheel(e, dispatch)}
    style={canvasStyle} width={dims.x} height={dims.y} ref={cref} />;
}
