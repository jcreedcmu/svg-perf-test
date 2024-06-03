import * as React from 'react';
import { getCanvasDims } from './canvas-utils';
import { colors } from './colors';
import { UiState } from './types';
import { CanvasInfo, useCanvas } from './use-canvas';
import { canvas_from_world_of_cameraData, scale_of_camera } from './camera-state';
import { app_world_from_canvas, canvasIntoWorld, meters_to_string, vdist } from './util';

export type OverlayCanvasProps = {
  uiState: UiState,
};

export type OverlayCanvasState = {
  ui: UiState,
}

function render(ci: CanvasInfo, state: OverlayCanvasState) {
  const { d } = ci;
  const { mouseState: ms, cameraData } = state.ui;

  console.log('painting overlay');
  const dims = getCanvasDims(state.ui.mouseState);

  d.clearRect(0, 0, dims.x, dims.y);


  if (ms.t == 'measure') {
    const dragp = app_world_from_canvas(cameraData, ms.p_in_page);
    const startp_in_world = app_world_from_canvas(cameraData, ms.orig_p_in_page);
    const scale = scale_of_camera(cameraData);

    d.save();
    d.strokeStyle = colors.motion_guide;
    d.setLineDash([10, 5]);
    d.lineWidth = 2;
    d.beginPath();
    d.moveTo(ms.orig_p_in_page.x, ms.orig_p_in_page.y);
    d.lineTo(ms.p_in_page.x, ms.p_in_page.y);
    d.stroke();
    d.restore();

    const canvas_from_world = canvas_from_world_of_cameraData(cameraData);

    d.font = "14px sans-serif";
    d.fillStyle = colors.motion_guide;
    const dist = meters_to_string(vdist(dragp, startp_in_world));
    const width = d.measureText(dist).width;
    d.save();
    d.translate((startp_in_world.x + dragp.x) / 2 * scale + canvas_from_world.translate.x,
      (startp_in_world.y + dragp.y) / 2 * -scale + canvas_from_world.translate.y);
    // this ensures text is always ~right-side-up
    const extraRotation = (startp_in_world.x - dragp.x > 0) ? Math.PI : 0;
    d.rotate(extraRotation + -Math.atan2(dragp.y - startp_in_world.y, dragp.x - startp_in_world.x));

    d.strokeStyle = "#fff";
    d.lineWidth = 2;
    d.strokeText(dist, -width / 2, -5);
    d.fillText(dist, -width / 2, -5);

    d.restore();
  }
}

export function OverlayCanvas(props: OverlayCanvasProps): JSX.Element {
  const { uiState: state } = props;
  const [cref, mc] = useCanvas({ ui: state }, render,
    [
      state.mouseState.t,
      state.mode,
      state.cameraData,
      state.mouseState.t == 'measure' ? state.mouseState.p_in_page : undefined,
    ],
    () => { }
  );

  const dims = getCanvasDims(state.mouseState);
  const canvasStyle: React.CSSProperties = {
    pointerEvents: 'none',
    position: 'fixed',
    top: 0, left: 0,
    width: dims.x,
    height: dims.y,
  };

  return <canvas
    style={canvasStyle} width={dims.x} height={dims.y} ref={cref} />;
}
