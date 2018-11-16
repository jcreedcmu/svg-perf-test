import { Point, Ctx, Mode, RawCamera, Rect, Path, ArPoint, SmPoint, Bundle, Layer, ArRectangle, Label } from './types';
import { Loader, Data } from './loader';
import { clone, cscale } from './util';
import { simplify } from './simplify';
import { colors } from './colors';

let g_mode: Mode = "Pan";

import { CoastlineLayer } from './coastline';
import { RiverLayer } from './rivers';
import { ImageLayer } from './images';
import { SketchLayer } from './sketch';
import { State } from './state';
import { key } from './key';
import * as geom from './geom';
import modal = require('./modal');

const DEBUG = false;
const DEBUG_PROF = false;
const OFFSET = DEBUG ? 100 : 0;
const VERTEX_SENSITIVITY = 10;
const FREEHAND_SIMPLIFICATION_FACTOR = 100;
const PANNING_MARGIN = 200;

let g_selection: { arc?: string } | null = null;
let g_panning: boolean = false;

let state = new State();

// Just for debugging
declare var window: any;

// some regrettable globals
let c: HTMLCanvasElement;
let d: Ctx;
let w: number;
let h: number;
let g_layers: Layer[];
let g_lastz: string = "[]";
let coastline_layer: CoastlineLayer;
let image_layer: ImageLayer;
let river_layer: RiverLayer;
let sketch_layer: SketchLayer;
let g_render_extra: null | ((camera: RawCamera, d: Ctx) => void);
let g_mouse: Point = { x: 0, y: 0 };
let data: Data;

const ld = new Loader();
ld.json_file('geo', '/data/geo.json');
ld.json_file('rivers', '/data/rivers.json');

ld.done(function(_data) {
  data = _data;
  let count = 0;
  const geo = data.json.geo;
  coastline_layer = new CoastlineLayer(geo.arcs, geo.polys, geo.labels, geo.counter);
  image_layer = new ImageLayer(dispatch, 0, geo.images);
  river_layer = new RiverLayer(data.json.rivers);
  sketch_layer = new SketchLayer(geo.sketches);
  g_layers = [coastline_layer,
    river_layer,
    sketch_layer,
    image_layer];

  c = document.getElementById("c") as HTMLCanvasElement;
  c.onwheel = onMouseWheel;
  window.c = c;

  const _d = c.getContext('2d');
  if (_d != null)
    d = _d;
  window.d = d;

  reset_canvas_size();
  render_origin();

  if (DEBUG && DEBUG_PROF) {
    console.profile("rendering");
    console.time("whatev");
    const ITER = 1000;
    for (let i = 0; i < ITER; i++) {
      render();
    }
    // d.getImageData(0,0,1,1);
    console.timeEnd("whatev");
    console.profileEnd();
  }
  else {
    render();
  }
});

function inv_xform(camera: RawCamera, xpix: number, ypix: number): Point {
  return {
    x: (xpix - camera.x) / cscale(camera),
    y: (ypix - camera.y) / -cscale(camera)
  };
}
window['inv_xform'] = inv_xform;
window['xform'] = xform;

function xform(camera: RawCamera, xworld: number, yworld: number): Point {
  return { x: camera.x + xworld * cscale(camera), y: camera.y - yworld * cscale(camera) };
}

let lastTime = 0;
let interval: number | null = null;
function maybe_render() {
  if (Date.now() - lastTime < 20) {
    if (interval != null) {
      clearInterval(interval);
      interval = null;
    }
    interval = setInterval(render, 40);
    return;
  }
  render();
}

window['render'] = render;
function dispatch() {
  render();
}

function render_origin() {
  const or = state.get_origin();
  $("#c").css({
    top: or.y + "px",
    left: or.x + "px",
    position: "fixed",
  });
}

function reset_canvas_size() {
  const margin = g_panning ? PANNING_MARGIN : 0;
  // not 100% sure this is right on retina
  state.set_origin(-margin, -margin);
  c.width = (w = innerWidth + 2 * margin) * devicePixelRatio;
  c.height = (h = innerHeight + 2 * margin) * devicePixelRatio;
  c.style.width = (innerWidth + 2 * margin) + "px";
  c.style.height = (innerHeight + 2 * margin) + "px";
}

function get_world_bbox(camera: RawCamera): Rect {
  const tl = inv_xform(camera, OFFSET, OFFSET);
  const br = inv_xform(camera, w - OFFSET, h - OFFSET);
  return [tl.x, br.y, br.x, tl.y];
}

function render() {
  //  const t = Date.now();
  d.save();
  d.scale(devicePixelRatio, devicePixelRatio);
  lastTime = Date.now();
  if (interval != null) {
    clearInterval(interval);
    interval = null;
  }
  const camera = state.camera();
  const t = Date.now();
  d.fillStyle = "#bac7f8";
  d.fillRect(0, 0, w, h);
  d.strokeStyle = "gray";

  if (DEBUG) {
    d.strokeRect(OFFSET + 0.5, OFFSET + 0.5, w - 2 * OFFSET, h - 2 * OFFSET);
  }

  const world_bbox = get_world_bbox(camera);

  g_layers.forEach(function(layer) {
    layer.render(d, camera, g_mode, world_bbox);
  });


  // vertex hover display
  if (camera.zoom >= 1 && g_lastz != "[]") {
    const pts = JSON.parse(g_lastz);
    if (pts.length != 0) {
      const rad = 3 / cscale(camera);
      d.save();
      d.translate(camera.x, camera.y);
      d.scale(cscale(camera), -cscale(camera));
      pts.forEach((bundle: Bundle) => {
        if (bundle[0] == "coastline") {
          const pt = bundle[1].point;
          d.fillStyle = "white";
          d.fillRect(pt[0] - rad, pt[1] - rad, rad * 2, rad * 2);
          d.lineWidth = 1 / cscale(camera);
          d.strokeStyle = "#000";
          d.strokeRect(pt[0] - rad, pt[1] - rad, rad * 2, rad * 2);
        }
        else if (bundle[0] == "label") {
          const pt = coastline_layer.labels[bundle[1]].pt;
          d.beginPath();
          d.fillStyle = "white";
          d.globalAlpha = 0.5;
          d.arc(pt[0], pt[1], 20 / cscale(camera), 0, Math.PI * 2);
          d.fill();
        }
      });
      d.restore();
    }
  }

  if (!g_panning) {
    // scale
    render_scale(camera, d);

    // mode
    d.fillStyle = "black";
    d.strokeStyle = "white";
    d.font = "bold 12px sans-serif";
    d.lineWidth = 2;
    d.strokeText(g_mode, 20, h - 20);
    d.fillText(g_mode, 20, h - 20);


    // debugging


    d.fillStyle = "black";
    d.strokeStyle = "white";
    d.font = "bold 12px sans-serif";
    d.lineWidth = 2;
    const txt = "Zoom: " + camera.zoom + " (1px = " + 1 / cscale(camera) + "m) g_lastz: " + g_lastz + " img: " + image_layer.named_imgs[image_layer.cur_img_ix].name;
    d.strokeText(txt, 20, 20);
    d.fillText(txt, 20, 20);


    // used for ephemeral stuff on top, like point-dragging
    if (g_render_extra) {
      g_render_extra(camera, d);
    }

    if (g_selection) {
      d.save();
      d.translate(camera.x, camera.y);
      d.scale(cscale(camera), -cscale(camera));
      if (g_selection.arc) {
        d.lineWidth = 2 / cscale(camera);
        d.strokeStyle = "#0ff";
        coastline_layer.draw_selected_arc(d, g_selection.arc);
      }
      d.restore();
    }
  }

  d.restore();
  //  console.log(Date.now() - t);
}

function meters_to_string(raw: number): string {
  let str = "0";
  if (raw > 0) {
    str = (raw > 1000) ? Math.floor(raw / 10) / 100 + "km" : Math.floor(raw) + "m";
  }
  return str;
}

function render_scale(camera: RawCamera, d: Ctx) {
  d.save();
  d.fillStyle = "black";
  d.font = "10px sans-serif";

  d.translate(Math.floor(w / 2) + 0.5, 0.5);
  function label(px_dist: number) {
    const str = meters_to_string(px_dist / cscale(camera));
    d.textAlign = "center";
    d.fillText(str, px_dist, h - 12);
  }
  d.lineWidth = 1;
  d.strokeStyle = "rgba(0,0,0,0.1)";
  d.strokeRect(0, h - 25 - 50, 50, 50);
  d.strokeRect(0, h - 25 - 128, 128, 128);
  d.beginPath()
  d.strokeStyle = "black";
  d.moveTo(0, h - 30);
  d.lineTo(0, h - 25);
  d.lineTo(50, h - 25);
  d.lineTo(50, h - 30);
  d.moveTo(50, h - 25);
  d.lineTo(128, h - 25);
  d.lineTo(128, h - 30);
  d.stroke();
  label(0);
  label(50);
  label(128);

  d.restore();
}

function onMouseWheel(e: WheelEvent): void {
  if (e.ctrlKey) {
    if (e.wheelDelta < 0) {
      image_layer.scale(1 / 2);
    }
    else {
      image_layer.scale(2);
    }
    render();
    e.preventDefault();
  }
  else {
    const x = e.pageX;
    const y = e.pageY;
    const zoom = e.wheelDelta / 120;
    e.preventDefault();
    state.zoom(x, y, zoom);
    render();
  }
};

function start_pan(x: number, y: number, camera: RawCamera) {
  const stop_at = start_pan_and_stop(x, y, camera);
  $(document).on('mouseup.drag', function(e) {
    stop_at(e.pageX, e.pageY);
  });
}

// returns stopping function
function start_pan_and_stop(x: number, y: number, camera: RawCamera) {
  $("#c").css({ cursor: 'move' });
  g_panning = true;
  //  state.set_cam(camera.x + PANNING_MARGIN, camera.y + PANNING_MARGIN);
  reset_canvas_size();
  render_origin();
  render();
  const last = { x: x, y: y };
  $(document).on('mousemove.drag', function(e) {
    const org = state.get_origin();
    state.inc_origin(e.pageX - last.x,
      e.pageY - last.y);

    state.inc_cam(e.pageX - last.x,
      e.pageY - last.y);

    last.x = e.pageX;
    last.y = e.pageY;

    let stale = false;
    if (org.x > 0) { state.inc_origin(-PANNING_MARGIN, 0); stale = true; }
    if (org.y > 0) { state.inc_origin(0, -PANNING_MARGIN); stale = true; }
    if (org.x < -2 * PANNING_MARGIN) { state.inc_origin(PANNING_MARGIN, 0); stale = true; }
    if (org.y < -2 * PANNING_MARGIN) { state.inc_origin(0, PANNING_MARGIN); stale = true; }

    // if (g_origin.y > 0) { g_origin.y -= PANNING_MARGIN; stale = true;
    // 			  state.inc_cam(0, PANNING_MARGIN); }

    if (stale) {
      render();
    }
    render_origin();

    //maybe_render();
  });

  return function(offx: number, offy: number) {
    $("#c").css({ cursor: '' });
    $(document).off('.drag');
    state.set_cam(camera.x + offx - x, camera.y + offy - y);
    g_panning = false;
    reset_canvas_size();
    render_origin();
    render();
  };
}

$('#c').on('mousedown', function(e) {
  const camera = state.camera();
  const x = e.pageX;
  const y = e.pageY;
  const worldp = inv_xform(camera, x, y);
  const slack = VERTEX_SENSITIVITY / cscale(camera);
  const bbox: ArRectangle = [worldp.x - slack, worldp.y - slack, worldp.x + slack, worldp.y + slack];

  const th = $(this);

  switch (g_mode) {
    case "Pan":
      if (e.ctrlKey) {
        const membase = image_layer.get_pos();
        $(document).on('mousemove.drag', function(e) {
          image_layer.set_pos({
            x: membase.x + (e.pageX - x) / cscale(camera),
            y: membase.y - (e.pageY - y) / cscale(camera)
          });
          maybe_render();
        });
        $(document).on('mouseup.drag', function(e) {
          $(document).off('.drag');
          render();
        });

      }
      else
        start_pan(x, y, camera);
      break;

    case "Measure":
      start_measure(worldp);
      break;

    case "Select":
      const candidate_features = coastline_layer.arc_targets(bbox);
      const hit_lines = geom.find_hit_lines(
        worldp, candidate_features, coastline_layer.arcs, slack
      );
      if (hit_lines.length == 1) {
        g_selection = hit_lines[0];
      }
      else {
        g_selection = null;
      }
      render();
      break;

    case "Label":
      if (g_lastz != "[]") {
        const z = JSON.parse(g_lastz);
        console.log(g_lastz);
        if (z.length == 1 && z[0][0] == "label") {
          modal.make_insert_label_modal(worldp, coastline_layer.labels[z[0][1]], obj => {
            coastline_layer.replace_point_feature(obj);
            render();
          });
        }
      }
      else {
        modal.make_insert_label_modal(worldp, null, obj => {
          coastline_layer.new_point_feature(obj);
          render();
        });
      }
      break;

    case "Move":
      const targets = coastline_layer.targets(bbox);

      if (targets.length >= 1) {
        // yikes, what happens if I got two or more?? looks like I drag
        // them all together. Don't want to do that.
        const neighbors = coastline_layer.targets_nabes(targets);

        start_drag(worldp, neighbors, dragp => {
          coastline_layer.replace_vert(targets, dragp);
        });
      }
      else {
        const candidate_features = coastline_layer.arc_targets(bbox);
        const hit_lines = geom.find_hit_lines(
          worldp, candidate_features, coastline_layer.arcs, slack
        );
        if (hit_lines.length == 1) {
          const arc_id = hit_lines[0].arc;
          const ix = hit_lines[0].ix;
          const arc = coastline_layer.arcs[arc_id].points;
          start_drag(worldp, [arc[ix], arc[ix + 1]], (dragp: Point) => {
            coastline_layer.break_segment(hit_lines[0], dragp);
          });
        }
        else
          start_pan(x, y, camera);
      }
      break;

    case "Freehand":
      let startp: ArPoint = [worldp.x, worldp.y];

      const spoint = get_snap();
      if (spoint != null)
        startp = spoint;

      start_freehand(startp, path => sketch_layer.add(path));
      break;
  }
});

function get_snap() {
  const last = JSON.parse(g_lastz);
  // .targets is already making sure that multiple targets returned at
  // this stage are on the same exact point
  if (last.length >= 1 &&
    last[0][0] == "coastline")
    return clone(last[0][1].point);
  else
    return null;
}

function vdist(p1: Point, p2: Point) {
  function sqr(x: number) { return x * x };
  return Math.sqrt(sqr(p1.x - p2.x) + sqr(p1.y - p2.y));
}

function start_measure(startp: Point) {
  const camera = state.camera();
  const dragp = clone(startp);
  const scale = cscale(camera);
  g_render_extra = function(camera, d) {
    d.save();
    d.translate(camera.x, camera.y);
    d.scale(scale, -scale);
    d.beginPath();

    d.moveTo(startp.x, startp.y);
    d.lineTo(dragp.x, dragp.y);

    d.lineWidth = 1 / scale;
    d.strokeStyle = colors.motion_guide;
    d.stroke();
    d.restore();

    d.font = "14px sans-serif";
    d.fillStyle = colors.motion_guide;
    const dist = meters_to_string(vdist(dragp, startp));
    const width = d.measureText(dist).width;
    d.save();
    d.translate((startp.x + dragp.x) / 2 * scale + camera.x,
      (startp.y + dragp.y) / 2 * -scale + camera.y);
    d.rotate(-Math.atan2(dragp.y - startp.y, dragp.x - startp.x));

    d.strokeStyle = "#fff";
    d.lineWidth = 2;
    d.strokeText(dist, -width / 2, -3);
    d.fillText(dist, -width / 2, -3);

    d.restore();
  }
  $(document).on('mousemove.drag', function(e) {
    const x = e.pageX;
    const y = e.pageY;
    const worldp = inv_xform(camera, x, y);
    dragp.x = worldp.x;
    dragp.y = worldp.y;
    maybe_render();
  });
  $(document).on('mouseup.drag', function(e) {
    g_render_extra = null;
    $(document).off('.drag');
    render();
  });

}

// The continuation k is what to do when the drag ends. The argument
// dragp to k is the point we released the drag on.
function start_drag(startp: Point, neighbors: SmPoint[], k: (dragp: Point) => void) {
  const camera = state.camera();
  let dragp = clone(startp);
  const scale = cscale(camera);
  g_render_extra = function(camera, d) {
    d.save();
    d.translate(camera.x, camera.y);
    d.scale(scale, -scale);
    d.beginPath();
    if (neighbors.length == 0) {
      // if no neighbors, we're moving a label; draw a little crosshairs.
      d.moveTo(dragp.x, dragp.y - 10 / scale);
      d.lineTo(dragp.x, dragp.y + 10 / scale);
      d.moveTo(dragp.x - 10 / scale, dragp.y);
      d.lineTo(dragp.x + 10 / scale, dragp.y);
      d.arc(dragp.x, dragp.y, 10 / scale, 0, 2 * Math.PI);
    }
    else {
      // ...else, we're moving an arc point. Draw some guides to show
      // how the moved point connects to its neighbors.
      neighbors.forEach(nabe => {
        d.moveTo(nabe[0], nabe[1]);
        d.lineTo(dragp.x, dragp.y);
      });
    }
    d.lineWidth = 1 / scale;
    d.strokeStyle = colors.motion_guide;
    d.stroke();
    d.restore();
  }
  $(document).on('mousemove.drag', function(e) {
    const x = e.pageX;
    const y = e.pageY;
    const worldp = inv_xform(camera, x, y);
    dragp.x = worldp.x;
    dragp.y = worldp.y;
    maybe_render();
  });
  $(document).on('mouseup.drag', function(e) {
    g_render_extra = null;
    $(document).off('.drag');
    const snaps = JSON.parse(g_lastz);
    if (snaps.length >= 1) {
      dragp = coastline_layer.target_point(snaps[0]);
    }
    k(dragp);
    render();
  });
}

function start_freehand(startp: ArPoint, k: (dragp: Path) => void) {
  const camera = state.camera();
  const path: SmPoint[] = [startp];
  const thresh = FREEHAND_SIMPLIFICATION_FACTOR
    / (cscale(camera) * cscale(camera));
  g_render_extra = function(camera, d) {
    d.save();
    d.translate(camera.x, camera.y);
    d.scale(cscale(camera), -cscale(camera));
    d.beginPath();
    let count = 0;
    path.forEach((pt: SmPoint, n: number) => {
      if (n == 0)
        d.moveTo(pt[0], pt[1]);
      else {
        if (n == path.length - 1 ||
          (pt[2] || 0) > 1) {
          count++;
          d.lineTo(pt[0], pt[1]);
        }
      }
    });
    d.lineWidth = 2 / cscale(camera);
    d.strokeStyle = colors.motion_guide;
    d.stroke();
    d.restore();
  }
  $(document).on('mousemove.drag', function(e) {
    const x = e.pageX;
    const y = e.pageY;
    const worldp = inv_xform(camera, x, y);
    path.push([worldp.x, worldp.y]);
    simplify(path);
    maybe_render();
  });
  $(document).on('mouseup.drag', function(e) {

    const spoint = get_snap();
    if (spoint != null) {
      path[path.length - 1] = spoint;
      startp = spoint;
    }

    g_render_extra = null;
    $(document).off('.drag');
    k(path.filter((pt: SmPoint, n: number) => {
      return (pt[2] || 0) > thresh || n == 0 || n == path.length - 1;
    }));
    render();
  });
}

$('#c').on('mousemove', function(e) {
  g_mouse = { x: e.pageX, y: e.pageY };

  if (g_panning)
    return;
  const camera = state.camera();
  if (camera.zoom >= 1) {
    const x = e.pageX;
    const y = e.pageY;
    const worldp = inv_xform(camera, x, y);
    const rad = VERTEX_SENSITIVITY / cscale(camera);
    const bbox: ArRectangle = [worldp.x - rad, worldp.y - rad, worldp.x + rad, worldp.y + rad];
    const targets = coastline_layer.targets(bbox);
    const z = JSON.stringify(targets);
    if (z != g_lastz) {
      g_lastz = z;
      render();
    }
  }
});

function main_key_handler(e: JQuery.Event<Document, null>) {
  // Disable key event handling if modal is up
  if (0) {
    const modals = $(".modal");
    if (modals.filter(() => $(this).css("display") == "block").length)
      return;
  }
  const k = key(e.originalEvent as KeyboardEvent);
  // if (k == "i") {
  //   label_layer.add_label(state, prompt("name"));
  //   render();
  // }
  if (k == ",") {
    image_layer.prev();
  }
  if (k == ".") {
    image_layer.next();
  }
  if (k == "f") {
    g_mode = "Freehand";
    render();
  }
  if (k == "m") {
    g_mode = "Move";
    render();
  }
  if (k == "<space>") {
    //    const old_mode = g_mode;
    //    g_mode = "Pan";
    $(document).off('keydown');
    const stop_at = start_pan_and_stop(g_mouse.x, g_mouse.y, state.camera());
    $(document).on('keyup.holdspace', function(e) {
      if (key(e.originalEvent as KeyboardEvent) == "<space>") {
        stop_at(g_mouse.x, g_mouse.y);
        $(document).off('.holdspace');
        $(document).on('keydown', main_key_handler);
      }
    });

  }
  if (k == "p") {
    g_mode = "Pan";
    render();
  }
  if (k == "s") {
    g_mode = "Select";
    render();
  }
  if (k == "l") {
    g_mode = "Label";
    render();
  }
  if (k == "e") {
    g_mode = "Measure";
    render();
  }

  // if (k == "i") {
  //   g_mode = "Insert";
  //   render();
  // }
  if (k == "v") {
    save();
  }
  if (k == "q") {
    const sk = sketch_layer.pop();
    if (sk != null) {
      coastline_layer.make_insert_feature_modal(sk, dispatch);
    }
  }
  if (k == "S-b") {
    coastline_layer.breakup();
    render();
  }
  if (k == "S-f") {
    coastline_layer.filter();
    render();
  }

  //  console.log(e.charCode, k);
}

$(document).on('keydown', main_key_handler);

function save() {
  let geo = {};
  g_layers.forEach(function(layer, n) {
    geo = { geo, ...layer.model() }
  });
  $.ajax("/export", {
    method: "POST", data: JSON.stringify(geo), contentType: "text/plain", success: function() {
      console.log("success");
    }
  });
}

// function report() {
//   g_imageStates[g_curImgName] = clone(g_imageState);
//   localStorage.allStates = JSON.stringify(g_imageStates);
//   // {pos: [g_imageState.x, g_imageState.y], scale: g_imageState.scale};
//   console.log(JSON.stringify(g_imageStates));
// }

function has_label(x: Label, label: string) {
  return x.properties.text && x.properties.text.match(new RegExp(label, "i"))
}

// this doesn't work right now
function zoom_to(label: string) {
  const selection = data.json.geo.labels.filter((x: any) => has_label(x, label) && x.pt);
  const pt = selection[0].pt;
  if (pt == null) throw `couldn\'t find ${label}`;
  const pixel_offset = xform(state.camera(), pt[0], pt[1]);
  state.inc_cam(w / 2 - pixel_offset.x, h / 2 - pixel_offset.y);
  render();
}
window['zoom_to'] = zoom_to;
