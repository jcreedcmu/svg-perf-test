import { produce } from 'immer';
import * as React from 'react';
import { useEffect } from 'react';
import { Dict, Geometry, MouseState, Point, Rect, SizedImage, UiState } from './types';
import { Dispatch, SIDEBAR_WIDTH } from './ui';
import { CanvasInfo, useCanvas } from './use-canvas';
import { compose, translate } from './se2';
import { vadd, vsub } from './vutil';
import { OFFSET, PANNING_MARGIN } from './main';
import { CameraData, scale_of_camera, set_offset_pres, zoom_of_camera } from './camera-state';
import { colors } from './colors';
import { renderImageOverlay } from './images';
import { app_world_from_canvas, meters_to_string } from './util';

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
  state.geo.coastlineLayer.render({
    d, bbox_in_world, cameraData, mode: mm, us: state.ui,
  });

  const { mode } = state.ui;
  const { named_imgs, cur_img_ix, overlay } = state.ui.imageLayerState;
  renderImageOverlay(d, cameraData, named_imgs, cur_img_ix, overlay == null ? null : (window as any)._image);

  state.geo.riverLayer.render({
    d, bbox_in_world, cameraData, mode: mm, us: state.ui,
  });
  state.geo.sketchLayer.render({
    d, bbox_in_world, cameraData, mode: mm, us: state.ui,
  });

  // TODO: Vertex hover
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
    const img_name = named_imgs[cur_img_ix].name;
    const txt = "Zoom: " + zoom_of_camera(cameraData) + " (1px = " + Math.round(1 / scale) + "m) img: " + img_name;
    d.strokeText(txt, 20, 20);
    d.fillText(txt, 20, 20);


    // TODO: "Render Extra", like point dragging
    // TODO: Selection
  }
}

// Gets width and height of canvas
function getCanvasDims(ms: MouseState): Point {
  const margin = ms.t == 'pan' ? PANNING_MARGIN : 0;
  return { x: innerWidth + 2 * margin, y: innerHeight + 2 * margin };
}

function handleMouseWheel(e: React.WheelEvent, dispatch: Dispatch): void {
  const x = e.pageX!;
  const y = e.pageY!;
  const zoom = e.deltaY > 0 ? -1 : 1;
  e.preventDefault();
  dispatch({ t: 'doZoom', zoom_amount: zoom, p_in_canvas: { x: e.pageX!, y: e.pageY! } });
}

export function MapCanvas(props: MapCanvasProps): JSX.Element {
  const { uiState: state, dispatch } = props;
  const [cref, mc] = useCanvas({ ui: state, geo: props.geo }, render,

    // Some discussion on what should cause changes of state here:
    //
    // - The moment we start panning, we should repaint (with expanded
    //   boundaries)
    //
    // - Whenever we do a mousemove that would make us pan so that our
    //   boundary-expansion strategy is noticeable, the reduce should change
    //   our 'origin', i.e. page_from_canvas

    [
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
    if (state.mouseState.t == 'pan') {
      document.addEventListener('mousemove', onMouseMoveDrag);
      document.addEventListener('mouseup', onMouseUpDrag);
      return () => {
        document.removeEventListener('mousemove', onMouseMoveDrag);
        document.removeEventListener('mouseup', onMouseUpDrag);
      }
    }
  }, [state.mouseState.t]);
  function onMouseDown(e: React.MouseEvent) {
    dispatch({ t: 'mouseDown', p_in_page: { x: e.pageX!, y: e.pageY! } })
  }

  function onMouseMoveDrag(e: MouseEvent) {
    dispatch({ t: 'mouseMove', p_in_page: { x: e.pageX!, y: e.pageY! } })
  }

  function onMouseUpDrag(e: MouseEvent) {
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
