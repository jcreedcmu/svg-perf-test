import { PANNING_MARGIN } from "./camera-state";
import { MouseState, Point } from "./types";

// Gets width and height of canvas
export function getCanvasDims(ms: MouseState): Point {
  const margin = ms.t == 'pan' ? PANNING_MARGIN : 0;
  return { x: innerWidth + 2 * margin, y: innerHeight + 2 * margin };
}
