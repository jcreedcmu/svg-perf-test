import { produce } from 'immer';
import * as React from 'react';
import { useEffect } from 'react';
import { get_bbox_in_world } from './render';
import { Geometry, UiState } from './types';
import { Dispatch } from './ui';
import { CanvasInfo, useCanvas } from './use-canvas';
import { compose, translate } from './se2';
import { vadd, vsub } from './vutil';

export type MapCanvasProps = {
  uiState: UiState,
  dispatch: Dispatch,
  geo: Geometry,
};

export type MapCanvasState = {
  ui: UiState,
  geo: Geometry,
}

function render(ci: CanvasInfo, state: MapCanvasState) {
  const { d } = ci;
  console.log('painting');

  d.save();
  d.fillStyle = "white";
  d.fillRect(0, 0, ci.size.x, ci.size.y);
  d.fillStyle = "black";
  d.textBaseline = 'top';
  d.restore();

  let cameraData = state.ui.cameraData;
  const ms = state.ui.mouseState;
  if (ms.t == 'pan') {
    const v = vsub(vsub(ms.p_in_page, ms.orig_p_in_page), ms.page_from_canvas);
    cameraData = produce(cameraData, c => {
      c.page_from_world = compose(translate(v), c.page_from_world);
    });
  }
  const bbox_in_world = get_bbox_in_world(cameraData, ci.size)
  state.geo.coastlineLayer.render({
    d, bbox_in_world, cameraData, mode: 'Pan', us: state.ui,
  });
  d.fillText(JSON.stringify(state.ui.cameraData.page_from_world, null, 2), 0, 10);
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

    [state.mouseState.t], // note geo isn't here
    () => { }
  );
  useEffect(() => {
    if (state.mouseState.t == 'pan') {
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
      return () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      }
    }
  }, [state.mouseState.t, state.mouseState.t == 'pan' ? state.mouseState.page_from_canvas : undefined]);
  function onMouseDown(e: React.MouseEvent) {
    dispatch({ t: 'mouseDown', p_in_page: { x: e.pageX!, y: e.pageY! } })
  }

  function onMouseMove(e: MouseEvent) {
    dispatch({ t: 'mouseMove', p_in_page: { x: e.pageX!, y: e.pageY! } })
  }

  function onMouseUp(e: MouseEvent) {
    dispatch({ t: 'mouseUp', p_in_page: { x: e.pageX!, y: e.pageY! } })
  }

  let canvasStyle: React.CSSProperties = {};
  const ms = state.mouseState;
  if (ms.t == 'pan') {
    canvasStyle = {
      top: ms.page_from_canvas.y + ms.p_in_page.y - ms.orig_p_in_page.y,
      left: ms.page_from_canvas.x + ms.p_in_page.x - ms.orig_p_in_page.x, position: 'fixed'
    };
  }
  return <canvas onMouseDown={onMouseDown}
    className="map-canvas" style={canvasStyle} ref={cref} />;
}
