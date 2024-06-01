import { produce } from 'immer';
import * as React from 'react';
import { useEffect } from 'react';
import { get_bbox_in_world } from './render';
import { Geometry, UiState } from './types';
import { Dispatch } from './ui';
import { CanvasInfo, useCanvas } from './use-canvas';
import { compose, translate } from './se2';
import { vsub } from './vutil';

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
    cameraData = produce(cameraData, c => {
      c.page_from_world = compose(translate(vsub(ms.p_in_page, ms.orig_p_in_page)), c.page_from_world);
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
    [state], // note geo isn't here
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
  }, [state.mouseState.t]);
  function onMouseDown(e: React.MouseEvent) {
    dispatch({ t: 'mouseDown', p_in_page: { x: e.pageX!, y: e.pageY! } })
  }

  function onMouseMove(e: MouseEvent) {
    dispatch({ t: 'mouseMove', p_in_page: { x: e.pageX!, y: e.pageY! } })
  }

  function onMouseUp(e: MouseEvent) {
    dispatch({ t: 'mouseUp', p_in_page: { x: e.pageX!, y: e.pageY! } })
  }

  return <canvas onMouseDown={onMouseDown}
    className="map-canvas" ref={cref} />;
}
