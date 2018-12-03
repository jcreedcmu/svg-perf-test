import * as react from 'react';
import * as ReactDOM from 'react-dom';

import { Point, Ctx, Mode, Camera, Rect, Path, Target, ArcVertexTarget } from './types';
import { Geo, Rivers, Zpoint, Bundle, Layer, ArRectangle, Label } from './types';
import { Stopper, UIState } from './types';

import { Loader, Data } from './loader';
import { clone, cscale, nope, xform, inv_xform, meters_to_string, vdist } from './util';
import { resimplify } from './simplify';

import { colors } from './colors';
import { key } from './key';

import { State } from './state';
import { Throttler } from './throttler';

import { CoastlineLayer } from './coastline';
import { RiverLayer } from './rivers';
import { ImageLayer } from './images';
import { SketchLayer } from './sketch';
import { ArcStore } from './arcstore';
import { LabelStore } from './labelstore';

import * as geom from './geom';
import * as modal from './modal';
import { renderUi } from './ui';

// These two lines force webpack to believe that the file types.ts is
// actually used, since otherwise treeshaking or whatever finds out,
// correctly, that it has no runtime effect. But I do want changes
// to the file to trigger typescript rechecking.
import * as t from './types';
const undefined = t.nonce;

// Some global constants
const DEBUG = false;
const DEBUG_PROF = false;
const OFFSET = DEBUG ? 100 : 0;
const VERTEX_SENSITIVITY = 10;
const FREEHAND_SIMPLIFICATION_FACTOR = 100;
const PANNING_MARGIN = 200;

// Just for debugging
declare var window: any;

// Used only by zoom_to for now.
function has_label(x: Label, label: string) {
  return x.properties.text && x.properties.text.match(new RegExp(label, "i"))
}

// This doesn't work right now. In any event, the only way I had it
// working was from console.
function zoom_to(label: string) {
  const selection = app.data.json.geo.labels.filter((x: any) => has_label(x, label) && x.pt);
  const pt = selection[0].pt;
  if (pt == null) throw `couldn\'t find ${label}`;
  const pixel_offset = xform(this.state.camera(), pt[0], pt[1]);
  this.state.inc_cam(app.w / 2 - pixel_offset.x, app.h / 2 - pixel_offset.y);
  app.render();
}
window['zoom_to'] = zoom_to;

// The main meat of this file.
class App {
  c: HTMLCanvasElement;
  d: Ctx;
  w: number;
  h: number;
  layers: Layer[];
  lastz: Target[] = [];
  slastz: string = "[]";
  coastline_layer: CoastlineLayer;
  image_layer: ImageLayer;
  river_layer: RiverLayer;
  sketch_layer: SketchLayer;
  render_extra: null | ((camera: Camera, d: Ctx) => void);
  mode: Mode = "Pan";
  panning: boolean = false;
  data: Data; // Probably want to eventually get rid of this
  mouse: Point = { x: 0, y: 0 };
  selection: { arc: string } | null = null;
  state = new State(); // really this is camera state
  uistate: UIState = {
    mode: { t: 'normal' },
    layers: {
      road: false,
      boundary: false,
      river: false,
    },
  };
  th: Throttler;

  constructor() {
    const ld = new Loader();
    ld.json_file('geo', '/data/geo.json');
    ld.json_file('rivers', '/data/rivers.json');
    ld.done(data => this.init(data));
  }

  init(_data: Data): void {
    this.th = new Throttler(() => this.render());
    this.data = _data;
    let count = 0;
    const geo: Geo = _data.json.geo;
    const rivers: Rivers = _data.json.rivers;
    const arcStore = new ArcStore(geo.points, geo.arcs, geo.polys);
    const labelStore = new LabelStore(geo.labels);
    this.coastline_layer = new CoastlineLayer(arcStore, labelStore, geo.counter);
    this.image_layer = new ImageLayer(() => this.render(), 0, geo.images);
    this.river_layer = new RiverLayer(rivers);
    this.sketch_layer = new SketchLayer();
    this.layers = [
      this.coastline_layer,
      this.river_layer,
      this.sketch_layer,
      this.image_layer
    ];

    const c = document.getElementById("c") as HTMLCanvasElement;
    this.c = c;

    $('#c').on('mousedown', e => this.handleMouseDown(e));
    $('#c').on('mousemove', e => this.handleMouseMove(e));
    $(document).on('keydown', e => this.handleKey(e));
    c.onwheel = e => this.handleMouseWheel(e);

    window.c = c; // debugging

    const _d = c.getContext('2d');
    if (_d != null)
      this.d = _d;

    this.reset_canvas_size();
    this.render_origin();

    if (DEBUG && DEBUG_PROF) {
      console.profile("rendering");
      console.time("whatev");
      const ITER = 1000;
      for (let i = 0; i < ITER; i++) {
        this.render();
      }
      // d.getImageData(0,0,1,1);
      console.timeEnd("whatev");
      console.profileEnd();
    }
    else {
      this.render();
    }
  }

  render(): void {
    const { w, h, d, mode } = this;

    //  const t = Date.now();
    d.save();
    d.scale(devicePixelRatio, devicePixelRatio);
    this.th.reset();
    const camera = this.state.camera();
    const t = Date.now();
    d.fillStyle = "#bac7f8";
    d.fillRect(0, 0, w, h);
    d.strokeStyle = "gray";

    if (DEBUG) {
      d.strokeRect(OFFSET + 0.5, OFFSET + 0.5, w - 2 * OFFSET, h - 2 * OFFSET);
    }

    const world_bbox = this.get_world_bbox(camera);

    this.layers.forEach(layer => {
      layer.render({ d, us: this.uistate, camera, mode, world_bbox });
    });


    // vertex hover display
    if (camera.zoom >= 1 && this.lastz.length != 0) {
      const pts = this.lastz;
      const rad = 3 / cscale(camera);
      d.save();
      d.translate(camera.x, camera.y);
      d.scale(cscale(camera), -cscale(camera));
      pts.forEach((bundle: Target) => {
        if (bundle[0] == "coastline") {
          const pt = this.coastline_layer.avtPoint(bundle[1]);
          d.fillStyle = "white";
          d.fillRect(pt.x - rad, pt.y - rad, rad * 2, rad * 2);
          d.lineWidth = 1 / cscale(camera);
          d.strokeStyle = "black";
          d.strokeRect(pt.x - rad, pt.y - rad, rad * 2, rad * 2);

          d.strokeStyle = colors.motion_guide;
          d.strokeRect(pt.x - 2 * rad, pt.y - 2 * rad, rad * 4, rad * 4);
        }
        else if (bundle[0] == "label") {
          const pt = this.coastline_layer.labelStore.labels[bundle[1]].pt;
          d.beginPath();
          d.fillStyle = "white";
          d.globalAlpha = 0.5;
          d.arc(pt.x, pt.y, 20 / cscale(camera), 0, Math.PI * 2);
          d.fill();
        }
      });
      d.restore();
    }

    if (!this.panning) {
      // scale
      this.render_scale(camera, d);

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
      const im = this.image_layer;
      const txt = "Zoom: " + camera.zoom + " (1px = " + 1 / cscale(camera) + "m) lastz: " + this.slastz + " img: " + im.named_imgs[im.cur_img_ix].name;
      d.strokeText(txt, 20, 20);
      d.fillText(txt, 20, 20);


      // used for ephemeral stuff on top, like point-dragging
      if (this.render_extra) {
        (this.render_extra)(camera, d);
      }

      if (this.selection) {
        d.save();
        d.translate(camera.x, camera.y);
        d.scale(cscale(camera), -cscale(camera));
        if (this.selection.arc) {
          d.lineWidth = 2 / cscale(camera);
          d.strokeStyle = "#0ff";
          this.coastline_layer.draw_selected_arc(d, this.selection.arc);
        }
        d.restore();
      }
    }

    d.restore();
    //  console.log(Date.now() - t);

    // render react stuff
    ReactDOM.render(
      renderUi(this.uistate, () => { this.render() }),
      document.getElementById('react-root')
    );
  }

  handleMouseWheel(e: WheelEvent): void {
    if (e.ctrlKey) {
      if (e.wheelDelta < 0) {
        this.image_layer.scale(1 / 2);
      }
      else {
        this.image_layer.scale(2);
      }
      this.render();
      e.preventDefault();
    }
    else {
      const x = e.pageX;
      const y = e.pageY;
      const zoom = e.wheelDelta / 120;
      e.preventDefault();
      this.state.zoom(x, y, zoom);
      this.render();
    }
  }

  handleMouseMove(e: JQuery.Event<HTMLElement, null>) {
    this.mouse = { x: e.pageX, y: e.pageY };

    if (this.panning)
      return;
    const camera = this.state.camera();
    if (camera.zoom >= 1) {
      const x = e.pageX;
      const y = e.pageY;
      const worldp = inv_xform(camera, x, y);
      const rad = VERTEX_SENSITIVITY / cscale(camera);
      const bbox: ArRectangle = [worldp.x - rad, worldp.y - rad, worldp.x + rad, worldp.y + rad];
      const targets = this.coastline_layer.targets(bbox);
      const sz = JSON.stringify(targets);
      if (sz != this.slastz) {
        this.lastz = targets;
        this.slastz = sz;
        this.render();
      }
    }
  }

  get_snap(last: Target[]): Point | null {
    // .targets is already making sure that multiple targets returned at
    // this stage are on the same exact point
    if (last.length >= 1) {
      const u = last[0];
      if (u[0] == "coastline")
        return this.coastline_layer.avtPoint(u[1]);
    }
    return null;
  }

  handleMouseDown(e: JQuery.Event<HTMLElement, null>) {
    const { image_layer, coastline_layer, sketch_layer } = this;
    const camera = this.state.camera();
    const x = e.pageX;
    const y = e.pageY;
    const worldp = inv_xform(camera, x, y);
    const slack = VERTEX_SENSITIVITY / cscale(camera);
    const bbox: ArRectangle = [worldp.x - slack, worldp.y - slack, worldp.x + slack, worldp.y + slack];

    const th = $(this);

    switch (this.mode) {
      case "Pan":
        if (e.ctrlKey) {
          const membase = image_layer.get_pos();
          $(document).on('mousemove.drag', e => {
            image_layer.set_pos({
              x: membase.x + (e.pageX - x) / cscale(camera),
              y: membase.y - (e.pageY - y) / cscale(camera)
            });
            this.th.maybe();
          });
          $(document).on('mouseup.drag', e => {
            $(document).off('.drag');
            this.render();
          });
        }
        else
          this.start_pan(x, y, camera);
        break;

      case "Measure":
        this.start_measure(worldp);
        break;

      case "Select":
        const candidate_features = coastline_layer.arc_targets(bbox);
        const hit_lines = geom.find_hit_lines(
          worldp, candidate_features, coastline_layer.arcStore, slack
        );
        if (hit_lines.length == 1) {
          this.selection = { arc: hit_lines[0].arc_id };
        }
        else {
          this.selection = null;
        }
        this.render();
        break;

      case "Label":
        if (this.lastz.length != 0) {
          const z = this.lastz;
          console.log(this.lastz);
          if (z.length == 1) {
            const u = z[0];
            if (u[0] == "label") {
              modal.make_insert_label_modal(worldp, coastline_layer.labelStore.labels[u[1]], obj => {
                coastline_layer.labelStore.replace_point_feature(obj);
                this.render();
              });
            }
          }
        }
        else {
          modal.make_insert_label_modal(worldp, null, obj => {
            coastline_layer.new_point_feature(obj);
            this.render();
          });
        }
        break;

      case "Move":
        const pretargets = coastline_layer.targets(bbox);

        if (pretargets.length >= 1) {
          // yikes, what happens if I got two or more?? looks like I
          // drag them all together. Maybe don't want to do that. On
          // the other hand, setting pickone to true below causes
          // problems with the RTrees that cache where vertices are;
          // if I have more than one vertex sitting in the same place,
          // I'll incorrectly delete the entry from the rtree if *one*
          // of the many vertices move away. Ugh, maybe I do want
          // identity for vertices.
          const pickone = false;
          const targets = pickone ? [pretargets[0]] : pretargets;
          const neighbors = coastline_layer.targets_nabes(targets);

          this.start_drag(worldp, neighbors, dragp => {
            coastline_layer.replace_vert(targets, dragp);
          });
        }
        else {
          const candidate_features = coastline_layer.arc_targets(bbox);
          const hit_lines = geom.find_hit_lines(
            worldp, candidate_features, coastline_layer.arcStore, slack
          );
          if (hit_lines.length == 1) {
            const arc_id = hit_lines[0].arc_id;
            const ix = hit_lines[0].ix;
            const arc = coastline_layer.arcStore.getPoints(arc_id);
            this.start_drag(worldp, [arc[ix], arc[ix + 1]], (dragp: Point) => {
              coastline_layer.arcStore.break_segment(
                () => this.coastline_layer.namegen('r'),
                hit_lines[0],
                dragp
              );
            });
          }
          else
            this.start_pan(x, y, camera);
        }
        break;

      case "Freehand":
        let startp: Point = worldp;

        const spoint = this.get_snap(this.lastz);
        if (spoint != null)
          startp = spoint;

        this.start_freehand(startp, path => sketch_layer.add(path));
        break;

      default:
        nope(this.mode);
    }
  }

  handleKey(e: JQuery.Event<Document, null>) {
    const { image_layer, coastline_layer, sketch_layer } = this;

    // Disable key event handling if modal is up
    const modals = $(".modal");
    if (modals.filter(function(ix, e) { return $(e).css("display") == "block" }).length)
      return;

    const k = key(e.originalEvent as KeyboardEvent);
    // if (k == "i") {
    //   label_layer.add_label(state, prompt("name"));
    //   render();
    // }
    switch (k) {
      case ",": {
        image_layer.prev();
      } break;
      case ".": {
        image_layer.next();
      } break;
      case "f": {
        this.mode = "Freehand";
        this.render();
      } break;
      case "m": {
        this.mode = "Move";
        this.render();
      } break;
      case "<space>": {
        $(document).off('keydown');
        const stop_at = this.start_pan_and_stop(this.mouse.x, this.mouse.y, this.state.camera());
        $(document).on('keyup.holdspace', e => {
          if (key(e.originalEvent as KeyboardEvent) == "<space>") {
            stop_at(this.mouse.x, this.mouse.y);
            $(document).off('.holdspace');
            $(document).on('keydown', e => this.handleKey(e));
          }
        });

      } break;
      case "p": {
        this.mode = "Pan";
        this.render();
      } break;
      case "s": {
        this.mode = "Select";
        this.render();
      } break;
      case "l": {
        this.mode = "Label";
        this.render();
      } break;
      case "e": {
        this.mode = "Measure";
        this.render();
      } break;

      // if (k == "i") {
      //   this.mode = "Insert";
      //   this.render();
      // }
      case "v": {
        this.save();
      } break;
      case "q": {
        const sk = sketch_layer.pop();
        if (sk != null) {
          coastline_layer.make_insert_feature_modal(sk.map(p => p.point), () => this.render());
        }
      } break;
      case "S-f": {
        coastline_layer.filter();
        this.render();
      } break;

      // debugging operation
      case "d": {
        Object.entries(this.coastline_layer.arcStore.arcs).forEach(([k, v]) => {

          this.coastline_layer.arcStore.replace_arc(
            k,
            () => this.coastline_layer.namegen('r')
          );
        });
        this.render();
      } break;
    }
    //  console.log(e.charCode, k);
  }

  reset_canvas_size(): void {
    const { c } = this;
    const margin = this.panning ? PANNING_MARGIN : 0;
    // not 100% sure this is right on retina
    this.state.set_origin(-margin, -margin);
    c.width = (this.w = innerWidth + 2 * margin) * devicePixelRatio;
    c.height = (this.h = innerHeight + 2 * margin) * devicePixelRatio;
    c.style.width = (innerWidth + 2 * margin) + "px";
    c.style.height = (innerHeight + 2 * margin) + "px";
  }

  start_pan(x: number, y: number, camera: Camera): void {
    const stop_at: Stopper = this.start_pan_and_stop(x, y, camera);
    $(document).on('mouseup.drag', e => {
      stop_at(e.pageX, e.pageY);
    });
  }

  // returns stopping function
  start_pan_and_stop(x: number, y: number, camera: Camera): Stopper {
    $("#c").css({ cursor: 'move' });
    this.panning = true;
    //  state.set_cam(camera.x + PANNING_MARGIN, camera.y + PANNING_MARGIN);
    this.reset_canvas_size();
    this.render_origin();
    this.render();
    const last = { x: x, y: y };
    $(document).on('mousemove.drag', e => {
      const org = this.state.get_origin();
      this.state.inc_origin(e.pageX - last.x,
        e.pageY - last.y);

      this.state.inc_cam(e.pageX - last.x,
        e.pageY - last.y);

      last.x = e.pageX;
      last.y = e.pageY;

      let stale = false;
      if (org.x > 0) { this.state.inc_origin(-PANNING_MARGIN, 0); stale = true; }
      if (org.y > 0) { this.state.inc_origin(0, -PANNING_MARGIN); stale = true; }
      if (org.x < -2 * PANNING_MARGIN) { this.state.inc_origin(PANNING_MARGIN, 0); stale = true; }
      if (org.y < -2 * PANNING_MARGIN) { this.state.inc_origin(0, PANNING_MARGIN); stale = true; }

      if (stale) {
        this.render();
      }
      this.render_origin();

      //this.th.maybe();
    });

    return (offx: number, offy: number) => {
      $("#c").css({ cursor: '' });
      $(document).off('.drag');
      this.state.set_cam(camera.x + offx - x, camera.y + offy - y);
      this.panning = false;
      this.reset_canvas_size();
      this.render_origin();
      this.render();
    };
  }

  // The continuation k is what to do when the drag ends. The argument
  // dragp to k is the point we released the drag on.
  start_drag(startp: Point, neighbors: Point[], k: (dragp: Point) => void) {
    const camera = this.state.camera();
    let dragp = clone(startp);
    const scale = cscale(camera);
    this.render_extra = (camera, d) => {
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
          d.moveTo(nabe.x, nabe.y);
          d.lineTo(dragp.x, dragp.y);
        });
      }
      d.lineWidth = 1 / scale;
      d.strokeStyle = colors.motion_guide;
      d.stroke();
      d.restore();
    }
    $(document).on('mousemove.drag', e => {
      const x = e.pageX;
      const y = e.pageY;
      const worldp = inv_xform(camera, x, y);
      dragp.x = worldp.x;
      dragp.y = worldp.y;
      this.th.maybe();
    });
    $(document).on('mouseup.drag', e => {
      this.render_extra = null;
      $(document).off('.drag');
      const snaps = this.lastz;
      if (snaps.length >= 1) {
        dragp = this.coastline_layer.target_point(snaps[0]);
      }
      k(dragp);
      this.render();
    });
  }

  save(): void {
    const geo: Geo = {
      ...this.coastline_layer.model(),
      ...this.image_layer.model(),
    };

    $.ajax("/export", {
      method: "POST", data: JSON.stringify(geo), contentType: "text/plain", success: function() {
        console.log("success");
      }
    });
  }

  start_measure(startp: Point): void {
    const camera = this.state.camera();
    const dragp = clone(startp);
    const scale = cscale(camera);
    this.render_extra = (camera, d) => {
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
      // this ensures text is always ~right-side-up
      const extraRotation = (startp.x - dragp.x > 0) ? Math.PI : 0;
      d.rotate(extraRotation + -Math.atan2(dragp.y - startp.y, dragp.x - startp.x));

      d.strokeStyle = "#fff";
      d.lineWidth = 2;
      d.strokeText(dist, -width / 2, -3);
      d.fillText(dist, -width / 2, -3);

      d.restore();
    }
    $(document).on('mousemove.drag', e => {
      const x = e.pageX;
      const y = e.pageY;
      const worldp = inv_xform(camera, x, y);
      dragp.x = worldp.x;
      dragp.y = worldp.y;
      this.th.maybe();
    });
    $(document).on('mouseup.drag', e => {
      this.render_extra = null;
      $(document).off('.drag');
      this.render();
    });
  }

  start_freehand(startp: Point, k: (dragp: Path) => void): void {
    const camera = this.state.camera();
    const path: Zpoint[] = [{ point: startp, z: 1000 }];
    const thresh = FREEHAND_SIMPLIFICATION_FACTOR
      / (cscale(camera) * cscale(camera));
    this.render_extra = (camera, d) => {
      d.save();
      d.translate(camera.x, camera.y);
      d.scale(cscale(camera), -cscale(camera));
      d.beginPath();
      let count = 0;
      path.forEach(({ point: pt, z }: Zpoint, n: number) => {
        if (n == 0)
          d.moveTo(pt.x, pt.y);
        else {
          if (n == path.length - 1 ||
            z > 1) {
            count++;
            d.lineTo(pt.x, pt.y);
          }
        }
      });
      d.lineWidth = 2 / cscale(camera);
      d.strokeStyle = colors.motion_guide;
      d.stroke();
      d.restore();
    }
    $(document).on('mousemove.drag', e => {
      const x = e.pageX;
      const y = e.pageY;
      const worldp = inv_xform(camera, x, y);
      path.push({ point: worldp, z: 1000 });
      resimplify(path);
      this.th.maybe();
    });
    $(document).on('mouseup.drag', e => {
      const spoint = this.get_snap(this.lastz);
      if (spoint != null) {
        path[path.length - 1] = { point: spoint, z: 1000 };
        startp = spoint;
      }

      this.render_extra = null;
      $(document).off('.drag');
      k(path.filter(({ point: pt, z }: Zpoint, n: number) => {
        return z > thresh || n == 0 || n == path.length - 1;
      }));
      this.render();
    });
  }

  get_world_bbox(camera: Camera): Rect {
    const { w, h } = this;
    const tl = inv_xform(camera, OFFSET, OFFSET);
    const br = inv_xform(camera, w - OFFSET, h - OFFSET);
    return [tl.x, br.y, br.x, tl.y];
  }

  render_origin(): void {
    const or = this.state.get_origin();
    $("#c").css({
      top: or.y + "px",
      left: or.x + "px",
      position: "fixed",
    });
  }

  render_scale(camera: Camera, d: Ctx): void {
    const { w, h } = this;
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
}

// Entry point.
const app = new App();

// For debugging in console.
window['app'] = app;
