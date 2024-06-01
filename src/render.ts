import { CameraData, scale_of_camera, zoom_of_camera } from "./camera-state";
import { colors } from "./colors";
import { App, DEBUG, OFFSET } from "./main";
import { Mode, Point, Target } from "./types";
import { AccessRef } from "./ui";
import { canvasIntoWorld } from "./util";

export function paint(d: CanvasRenderingContext2D, size: Point, mode: Mode, cameraData: CameraData, app: App): void {
  const { x: w, y: h } = size;

  const access: AccessRef | null = app.accessRef.current;
  if (access == null)
    return;
  const { state, dispatch } = access;

  //  const t = Date.now();
  d.save();
  d.scale(devicePixelRatio, devicePixelRatio);
  app.th.reset();
  const scale = scale_of_camera(cameraData);
  const t = Date.now();
  d.fillStyle = "#bac7f8";
  d.fillRect(0, 0, w, h);
  d.strokeStyle = "gray";

  if (DEBUG) {
    d.strokeRect(OFFSET + 0.5, OFFSET + 0.5, w - 2 * OFFSET, h - 2 * OFFSET);
  }

  const bbox_in_world = app.get_bbox_in_world(cameraData);

  app.layers.forEach(layer => {
    layer.render({ d, us: state, cameraData, mode, bbox_in_world });
  });


  // vertex hover display
  if (zoom_of_camera(cameraData) >= 1 && app.lastz.length != 0) {
    const pts = app.lastz;
    const rad = 3 / scale;
    d.save();
    canvasIntoWorld(d, cameraData);
    pts.forEach((bundle: Target) => {
      if (bundle[0] == "coastline") {
        const pt = app.coastline_layer.avtPoint(bundle[1]);
        d.fillStyle = "white";
        d.fillRect(pt.x - rad, pt.y - rad, rad * 2, rad * 2);
        d.lineWidth = 1 / scale;
        d.strokeStyle = "black";
        d.strokeRect(pt.x - rad, pt.y - rad, rad * 2, rad * 2);

        d.strokeStyle = colors.motion_guide;
        d.strokeRect(pt.x - 2 * rad, pt.y - 2 * rad, rad * 4, rad * 4);
      }
      else if (bundle[0] == "label") {
        const pt = app.coastline_layer.labelStore.labels[bundle[1]].pt;
        d.beginPath();
        d.fillStyle = "white";
        d.globalAlpha = 0.5;
        d.arc(pt.x, pt.y, 20 / scale, 0, Math.PI * 2);
        d.fill();
      }
    });
    d.restore();
  }

  if (!app.panning) {
    // scale
    app.render_scale(cameraData, d);

    // mode
    d.fillStyle = "black";
    d.strokeStyle = "white";
    d.font = "bold 12px sans-serif";
    d.lineWidth = 2;
    d.strokeText(mode, 20, h - 20);
    d.fillText(mode, 20, h - 20);

    d.fillStyle = "black";
    d.strokeStyle = "white";
    d.font = "bold 12px sans-serif";
    d.lineWidth = 2;
    const im = app.image_layer;
    const txt = "Zoom: " + Math.round(zoom_of_camera(cameraData)) + " (1px = " + Math.round(1 / scale) + "m) lastz: " + app.slastz + " img: " + im.named_imgs[im.cur_img_ix].name;
    d.strokeText(txt, 20, 20);
    d.fillText(txt, 20, 20);


    // used for ephemeral stuff on top, like point-dragging
    if (app.render_extra) {
      (app.render_extra)(cameraData, d);
    }

    if (app.selection) {
      d.save();
      canvasIntoWorld(d, cameraData)
      if (app.selection.arc) {
        d.lineWidth = 2 / scale;
        d.strokeStyle = "#0ff";
        app.coastline_layer.draw_selected_arc(d, app.selection.arc);
      }
      d.restore();
    }
  }

  d.restore();
  //  console.log(Date.now() - t);

}
