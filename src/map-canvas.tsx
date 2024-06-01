import * as React from 'react';
import { useCanvas, CanvasInfo } from './use-canvas';

export type MapCanvasProps = {

};

export type MapCanvasState = {

};

function render(ci: CanvasInfo, state: MapCanvasState) {
  const { d } = ci;
  d.fillStyle = "red";
  d.fillRect(0, 0, ci.size.x, ci.size.y);
}

export function MapCanvas(props: MapCanvasProps): JSX.Element {
  const [cref, mc] = useCanvas({}, render, [], () => { });
  return <canvas className="map-canvas" ref={cref} />;
}
