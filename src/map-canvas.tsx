import * as React from 'react';
import { useEffect } from 'react';
import { CameraData, scale_of_camera } from './camera-state';
import { getCanvasDims } from './canvas-utils';
import { getTargets } from './coastline';
import { OFFSET } from './main';
import { render } from './map-canvas-render';
import { Action, ArRectangle, Geometry, Point, Rect, Target, UiState } from './types';
import { Dispatch } from './ui';
import { useCanvas } from './use-canvas';
import { app_world_from_canvas, meters_to_string } from './util';

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

function shouldHighlightVertices(state: UiState): boolean {
  const { mode } = state;
  if (mode.t != 'normal') return false;
  if (state.mouseState.t != 'up') return false;
  if (mode.tool == 'Pan') return true;
  if (mode.tool == 'Move') return true;
  if (mode.tool == 'Label') return true;
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
    if (shouldHighlightVertices(state)) {
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
