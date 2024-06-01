import * as React from 'react';
import { useCanvas, CanvasInfo } from './use-canvas';
import { UiState } from './types';

export type MapCanvasProps = {
  uiState: UiState,
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
  const { uiState: state } = props;
  const [cref, mc] = useCanvas(state, render, [state], () => { });
  return <canvas className="map-canvas" ref={cref} />;
}
