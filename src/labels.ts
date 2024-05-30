import { CameraData, zoom_of_camera } from './camera-state';
import { Layer, Ctx, Camera, Point, Label } from './types';
import { app_canvas_from_world, cscale } from './util';

function titleCase(str: string): string {
  return str.replace(/\w\S*/g, txt =>
    txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
  );
}

export function draw_label(d: Ctx, cameraData: CameraData, lab: Label) {
  const p = lab.pt;
  const txt = titleCase(lab.properties.text);
  const typ = lab.properties.label;
  let min_zoom = lab.properties.zoom;
  const q: Point = app_canvas_from_world(cameraData, p);

  let stroke = true;
  let height = 12;
  if (min_zoom == null) {
    if (typ == "city") min_zoom = 3;
    else if (typ == "minorsea") min_zoom = 2;
    else min_zoom = 3;
  }
  if (zoom_of_camera(cameraData) < min_zoom) return;

  if (typ == "city") {
    d.fillStyle = "white";
    d.strokeStyle = "#333";
    d.lineWidth = 1.5;
    d.beginPath();

    d.arc(q.x, q.y, 3.2, 0, Math.PI * 2);
    d.stroke();
    d.fill();

    q.y -= 12;

    d.fillStyle = "#333";
    d.strokeStyle = "white";
    d.lineWidth = 2;
    height = 10;
    d.font = "bold " + height + "px sans-serif";
  }
  else if (typ == "region") {
    d.fillStyle = "#333";
    d.strokeStyle = "white";
    d.lineWidth = 2;
    height = 10;
    d.font = "italic " + height + "px sans-serif";
  }
  else if (typ == "river") {
    d.fillStyle = "#007";
    d.strokeStyle = "white";
    d.lineWidth = 2;
    height = 10;
    d.font = height + "px sans-serif";
  }
  else if (typ == "park") {
    d.fillStyle = "#070";
    d.strokeStyle = "white";
    d.lineWidth = 2;
    height = 10;
    d.font = height + "px sans-serif";
  }
  else if (typ == "sea") {
    d.fillStyle = "#444";
    stroke = false;
    height = 10;
    d.font = "bold " + height + "px sans-serif";
  }
  else if (typ == "minorsea") {
    d.fillStyle = "#44a";
    d.strokeStyle = "white";
    d.lineWidth = 2;
    height = 10;
    d.font = "bold " + height + "px sans-serif";
  }
  const width = d.measureText(txt).width;
  if (stroke)
    d.strokeText(txt, q.x - width / 2, q.y + height / 2);
  d.fillText(txt, q.x - width / 2, q.y + height / 2);
}
