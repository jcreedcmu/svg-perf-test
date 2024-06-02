import { CameraData, scale_of_camera, zoom_of_camera } from "./camera-state";
import { colors } from "./colors";
import { App, DEBUG, OFFSET } from "./main";
import { Tool, Point, Rect, Target, UiState } from "./types";
import { app_world_from_canvas, canvasIntoWorld } from "./util";

export function get_bbox_in_world(cameraData: CameraData, size: Point): Rect {
  const { x: w, y: h } = size;
  const tl = app_world_from_canvas(cameraData, { x: OFFSET, y: OFFSET });
  const br = app_world_from_canvas(cameraData, { x: w - OFFSET, y: h - OFFSET });
  return [tl.x, br.y, br.x, tl.y];
}
