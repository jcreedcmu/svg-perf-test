import * as React from 'react';
import { useEffect } from 'react';
import { useCanvas, CanvasInfo } from './use-canvas';
import { UiState } from './types';
import { Dispatch } from './ui';

export type MapCanvasProps = {
  uiState: UiState,
  dispatch: Dispatch,
};

export type MapCanvasState = UiState;

function render(ci: CanvasInfo, state: MapCanvasState) {
  const { d } = ci;
  d.fillStyle = "white";
  d.fillRect(0, 0, ci.size.x, ci.size.y);
  d.fillStyle = "black";
  d.textBaseline = 'top';
  console.log('painting');
  d.fillText(JSON.stringify(state.cameraData.page_from_world, null, 2), 0, 10);
}

export function MapCanvas(props: MapCanvasProps): JSX.Element {
  const { uiState: state, dispatch } = props;
  const [cref, mc] = useCanvas(state, render, [state], () => { });
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
