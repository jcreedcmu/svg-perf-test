import * as React from 'react';

import { createRoot } from 'react-dom/client';
import { ArRectangle, Ctx, Geo, Label, Layer, Mode, Path, Point, Rect, Rivers, Stopper, Target, Zpoint } from './types';

import { Data, Loader } from './loader';
import { resimplify } from './simplify';
import { app_world_from_canvas, canvasIntoWorld, clone, colorToHex, meters_to_string, nope, vdist, vint } from './util';

import { colors } from './colors';
import { key } from './key';

import { CameraData, canvas_from_world_of_cameraData, doZoom, getOrigin, incCam, incOrigin, scale_of_camera, setOrigin, zoom_of_camera } from './camera-state';
import { Throttler } from './throttler';

import { ArcStore } from './arcstore';
import { CoastlineLayer } from './coastline';
import { ImageLayer } from './images';
import { LabelStore } from './labelstore';
import { RiverLayer } from './rivers';
import { SketchLayer } from './sketch';

import * as geom from './geom';
import { AccessRef, MainUi, MainUiProps, SIDEBAR_WIDTH } from './ui';

// These two lines force webpack to believe that the file types.ts is
// actually used, since otherwise treeshaking or whatever finds out,
// correctly, that it has no runtime effect. But I do want changes
// to the file to trigger typescript rechecking.
// XXX this all should be obsolete maybe since I'm not using webpack anymore.
import { apply } from './se2';
import * as t from './types';
import { paint } from './render';
const undefined = t.nonce;

// Some global constants
export const DEBUG = false;
const DEBUG_PROF = false;
export const OFFSET = DEBUG ? 100 : 0;
const VERTEX_SENSITIVITY = 10;
const FREEHAND_SIMPLIFICATION_FACTOR = 100;
export const PANNING_MARGIN = 200;

// Just for debugging
declare var window: any;

// Used only by zoom_to for now.
function has_label(x: Label, label: string) {
  return x.properties.text && x.properties.text.match(new RegExp(label, "i"))
}

// Meant to call this from console

window['zoom_to'] = (label: string) => {
  (window['app'] as any).zoom_to(label);
}

function mkApp(): Promise<App> {
  return new Promise((res, rej) => {
    const ld = new Loader();
    ld.json_file('geo', '/data/geo.json');
    ld.json_file('rivers', '/data/rivers.json');
    ld.done(data => { res(new App(data)); });
  });
}

// function render_origin(cameraData: CameraData): void {
//   const or = getOrigin(cameraData);
//   $("#c").css({
//     top: or.y + "px",
//     left: or.x + "px",
//     position: "fixed",
//   });
// }

function reset_canvas_size(c: HTMLCanvasElement, panning: boolean, cameraData: CameraData): {
  newCameraData: CameraData,
  dims: Point
} {
  const margin = panning ? PANNING_MARGIN : 0;
  // not 100% sure this is right on retina
  const newCameraData = setOrigin(cameraData, -margin, -margin);
  const dims = { x: innerWidth + 2 * margin, y: innerHeight + 2 * margin };
  c.width = dims.x * devicePixelRatio;
  c.height = dims.y * devicePixelRatio;
  c.style.width = (innerWidth + 2 * margin) + "px";
  c.style.height = (innerHeight + 2 * margin) + "px";
  return { newCameraData, dims };
}


// The main meat of this file.
export class App {
  accessRef: React.RefObject<AccessRef> = React.createRef<AccessRef>();
  c: HTMLCanvasElement;
  d: Ctx;
  w: number = 0;
  h: number = 0;
  layers: Layer[];
  lastz: Target[] = [];
  slastz: string = "[]";
  coastline_layer: CoastlineLayer;
  image_layer: ImageLayer;
  river_layer: RiverLayer;
  sketch_layer: SketchLayer;
  render_extra: null | ((cameraData: CameraData, d: Ctx) => void) = null;
  mode: Mode = "Pan";
  panning: boolean = false;
  data: Data; // Probably want to eventually get rid of this
  mouse: Point = { x: 0, y: 0 };
  selection: { arc: string } | null = null;
  th: Throttler;

  setCameraData(camera: CameraData): void {
    if (this.accessRef.current == null)
      throw new Error(`access not yet ready`);
    const { dispatch } = this.accessRef.current;
    dispatch({ t: 'setCameraData', camera });
  }

  getCameraData(): CameraData {
    if (this.accessRef.current == null)
      throw new Error(`access not yet ready`);
    const { state } = this.accessRef.current;
    return state.cameraData;
  }

  constructor(_data: Data) {
    this.th = new Throttler(() => this.render(this.getCameraData()));
    this.data = _data;
    let count = 0;
    const geo: Geo = _data.json.geo;
    const rivers: Rivers = _data.json.rivers;
    const arcStore = new ArcStore(geo.points, geo.arcs, geo.polys);
    const labelStore = new LabelStore(geo.labels);
    this.coastline_layer = new CoastlineLayer(arcStore, labelStore, geo.counter);
    this.image_layer = new ImageLayer(() => this.render(this.getCameraData()), 0, geo.images);
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

    (document.querySelector('#c') as HTMLCanvasElement).addEventListener('mousedown', e => this.handleMouseDown(e));
    (document.querySelector('#c') as HTMLCanvasElement).addEventListener('mousemove', e => this.handleMouseMove(e));
    document.addEventListener('keydown', e => this.handleKey(e));
    c.onwheel = e => this.handleMouseWheel(e);

    window.c = c; // debugging

    const _d = c.getContext('2d');
    if (_d == null) {
      throw new Error('null context');
    }
    this.d = _d;

    if (DEBUG && DEBUG_PROF) {
      console.time("whatev");
      const ITER = 1000;
      for (let i = 0; i < ITER; i++) {
        this.render(this.getCameraData());
      }
      // d.getImageData(0,0,1,1);
      console.timeEnd("whatev");
    }
    else {
      // this.render(this.getCameraData());
    }

    // React rendering

    const root = createRoot(document.getElementById('react-root')!);

    (window as any)['access'] = this.accessRef;

    const onMount = () => {
      let cameraData = this.getCameraData();
      const { newCameraData, dims } = reset_canvas_size(this.c, this.panning, cameraData);
      this.w = dims.x;
      this.h = dims.y;
      // render_origin(newCameraData);
      this.render(newCameraData);
    }

    const props: MainUiProps = {
      accessRef: this.accessRef,
      onMount,
      geo: {
        riverLayer: this.river_layer,
        coastlineLayer: this.coastline_layer,
        imageLayer: this.image_layer,
        sketchLayer: this.sketch_layer,
      },
      images: geo.images,
    };
    const comp = React.createElement(MainUi, props, null);

    root.render(comp);
  }

  render(cameraData: CameraData): void {
    const { w, h, d, mode } = this;
    this._render(w, h, d, mode, cameraData);
  }

  _render(w: number, h: number, d: Ctx, mode: Mode, cameraData: CameraData): void {
    const access: AccessRef | null = this.accessRef.current;
    if (access == null)
      return;
    const { state } = access;

    paint(d, { x: w, y: h }, mode, cameraData, state, this);
  }

  handleMouseWheel(e: WheelEvent): void {
    if (e.ctrlKey) {
      if (e.deltaY < 0) {
        this.image_layer.scale(1 / 2);
      }
      else {
        this.image_layer.scale(2);
      }
      this.render(this.getCameraData());
      e.preventDefault();
    }
    else {
      const x = e.pageX!;
      const y = e.pageY!;
      const zoom = -e.deltaY / 120;
      e.preventDefault();
      const cameraData = doZoom(this.getCameraData(), { x, y }, zoom);
      this.setCameraData(cameraData);
      this.render(cameraData);
    }
  }

  handleMouseMove(e: MouseEvent) {
    this.mouse = { x: e.pageX!, y: e.pageY! };

    if (this.panning)
      return;
    const cameraData = this.getCameraData();
    const scale = scale_of_camera(cameraData);

    if (zoom_of_camera(cameraData) >= 1) {
      const x = e.pageX!;
      const y = e.pageY!;
      const worldp = app_world_from_canvas(cameraData, { x, y });
      const rad = VERTEX_SENSITIVITY / scale;
      const bbox: ArRectangle = [worldp.x - rad, worldp.y - rad, worldp.x + rad, worldp.y + rad];
      const targets = this.coastline_layer.targets(bbox);
      const sz = JSON.stringify(targets);
      if (sz != this.slastz) {
        this.lastz = targets;
        this.slastz = sz;
        this.render(cameraData);
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

  handleMouseDown(e: MouseEvent) {
    const { image_layer, coastline_layer, sketch_layer } = this;
    const cameraData = this.getCameraData();
    const canvas_from_world = canvas_from_world_of_cameraData(cameraData);
    const scale = scale_of_camera(cameraData);

    const x = e.pageX!;
    const y = e.pageY!;
    const worldp = app_world_from_canvas(cameraData, { x, y });
    const slack = VERTEX_SENSITIVITY / scale;
    const bbox: ArRectangle = [worldp.x - slack, worldp.y - slack, worldp.x + slack, worldp.y + slack];

    switch (this.mode) {
      case "Pan":
        // if (e.ctrlKey) {
        //   const membase = image_layer.get_pos();
        //   $(document).on('mousemove.drag', e => {
        //     image_layer.set_pos({
        //       x: membase.x + (e.pageX! - x) / scale,
        //       y: membase.y - (e.pageY! - y) / scale
        //     });
        //     this.th.maybe();
        //   });
        //   $(document).on('mouseup.drag', e => {
        //     $(document).off('.drag');
        //     this.render(this.getCameraData());
        //   });
        // }
        // else
        //   this.start_pan(x, y, cameraData);
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
        this.render(this.getCameraData());
        break;

      case "Label":
        if (this.lastz.length != 0) {
          const z = this.lastz;
          console.log(this.lastz);
          if (z.length == 1) {
            const u = z[0];
            if (u[0] == "label") {
              const lab = coastline_layer.labelStore.labels[u[1]];
              this.accessRef.current?.dispatch({
                t: 'SetMode', mode: {
                  t: "label-modal", status: { isNew: false, prev: lab }, v: {
                    text: lab.properties.text,
                    zoom: lab.properties.zoom + '',
                    tp: lab.properties.label
                  }
                }
              });
            }
          }
        }
        else {
          this.accessRef.current?.dispatch({
            t: 'SetMode', mode: {
              t: "label-modal",
              status: { isNew: true, pt: worldp },
              v: { text: "", zoom: "4", tp: "region" }
            }
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
            this.start_pan(x, y, cameraData);
        }
        break;

      case "Freehand":
        let startp: Point = worldp;

        const spoint = this.get_snap(this.lastz);
        if (spoint != null)
          startp = spoint;

        this.start_freehand(startp, path => sketch_layer.add(path));
        break;

      case "Extract": {
        const im = this.image_layer.get_img_state();
        const imagep = vint({
          x: (worldp.x - im.x) / im.scale,
          y: (im.y - worldp.y) / im.scale
        });
        const z = this.lastz;
        if (z.length == 1) {
          const z0 = z[0];
          if (z0[0] == "label") {
            const labelId = z0[1];
            const lab = this.coastline_layer.labelStore.labels[labelId];
            const labText = lab.properties.text;
            const imd = this.image_layer.get_image_data();
            const base = 4 * (imagep.x + imagep.y * imd.width);
            let colorlist: { [k: string]: string } = (window as any)['colorlist'];
            if (colorlist == null)
              colorlist = {};
            colorlist[labText] = colorToHex([imd.data[base], imd.data[base + 1], imd.data[base + 2], imd.data[base + 3]]);
            console.log(JSON.stringify(colorlist, null, 2));
            window.colorlist = colorlist;
          }
        }
      } break;
      default:
        nope(this.mode);
    }
  }

  handleKey(e: KeyboardEvent) {

    const { image_layer, coastline_layer, sketch_layer } = this;

    // Disable key event handling if modal is up
    if (this.accessRef.current?.state.mode.t != 'normal')
      return;

    // XXX eventually delete this
    // const modals = $(".modal");
    // if (modals.filter(function(ix, e) { return $(e).css("display") == "block" }).length)
    //   return;

    const k = key(e);

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
        this.render(this.getCameraData());
      } break;
      case "x": {
        this.mode = "Extract";
        this.render(this.getCameraData());
      } break;
      case "m": {
        this.mode = "Move";
        this.render(this.getCameraData());
      } break;

      // XXX disabled space panning for now

      // case "<space>": {
      //   $(document).off('keydown');
      //   const stop_at = this.start_pan_and_stop(this.mouse.x, this.mouse.y, this.state.camera());
      //   $(document).on('keyup.holdspace', e => {
      //     if (key(e.originalEvent as KeyboardEvent) == "<space>") {
      //       stop_at(this.mouse.x, this.mouse.y);
      //       $(document).off('.holdspace');
      //       $(document).on('keydown', e => this.handleKey(e));
      //     }
      //   });

      // } break;

      case "p": {
        this.mode = "Pan";
        this.render(this.getCameraData());
      } break;
      case "s": {
        this.mode = "Select";
        this.render(this.getCameraData());
      } break;
      case "l": {
        this.mode = "Label";
        this.render(this.getCameraData());
      } break;
      case "e": {
        this.mode = "Measure";
        this.render(this.getCameraData());
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
          this.accessRef.current?.dispatch({
            t: 'SetMode', mode: { t: 'feature-modal', points: sk.map(p => p.point) }
          });
        }
      } break;
      case "S-f": {
        coastline_layer.filter();
        this.render(this.getCameraData());
      } break;

      // debugging operation
      case "d": {
        Object.entries(this.coastline_layer.arcStore.arcs).forEach(([k, v]) => {

          this.coastline_layer.arcStore.replace_arc(
            k,
            () => this.coastline_layer.namegen('r')
          );
        });
        this.render(this.getCameraData());
      } break;
    }
    //  console.log(e.charCode, k);
  }

  start_pan(x: number, y: number, cameraData: CameraData): void {
    const stop_at: Stopper = this.start_pan_and_stop(x, y, cameraData);
    // $(document).on('mouseup.drag', e => {
    //   stop_at(e.pageX!, e.pageY!);
    // });
  }

  // returns stopping function
  start_pan_and_stop(x: number, y: number, origCameraData: CameraData): Stopper {
    // $("#c").css({ cursor: 'move' });
    this.panning = true;
    //  state.set_cam(camera.x + PANNING_MARGIN, camera.y + PANNING_MARGIN);

    const { newCameraData, dims } = reset_canvas_size(this.c, this.panning, origCameraData);
    this.w = dims.x;
    this.h = dims.y;
    //    render_origin(origCameraData);
    this.render(origCameraData);

    const last = { x: x, y: y };
    // $(document).on('mousemove.drag', e => {
    //   let cameraData = this.getCameraData();
    //   const org = getOrigin(cameraData);
    //   cameraData = incOrigin(cameraData, e.pageX! - last.x, e.pageY! - last.y);
    //   cameraData = incCam(cameraData, e.pageX! - last.x, e.pageY! - last.y);

    //   last.x = e.pageX!;
    //   last.y = e.pageY!;

    //   let stale = false;
    //   if (org.x > 0) { cameraData = incOrigin(cameraData, -PANNING_MARGIN, 0); stale = true; }
    //   if (org.y > 0) { cameraData = incOrigin(cameraData, 0, -PANNING_MARGIN); stale = true; }
    //   if (org.x < -2 * PANNING_MARGIN) { cameraData = incOrigin(cameraData, PANNING_MARGIN, 0); stale = true; }
    //   if (org.y < -2 * PANNING_MARGIN) { cameraData = incOrigin(cameraData, 0, PANNING_MARGIN); stale = true; }
    //   this.setCameraData(cameraData);

    //   if (stale) {
    //     this.render(cameraData);
    //   }
    //   render_origin(cameraData);
    // });

    return (offx: number, offy: number) => {
      //      $("#c").css({ cursor: '' });
      //    $(document).off('.drag');
      const canvas_from_world = canvas_from_world_of_cameraData(origCameraData);
      let cameraData = incCam(
        origCameraData,
        offx - x,
        offy - y
      );
      this.panning = false;
      const { dims, newCameraData } = reset_canvas_size(this.c, this.panning, cameraData);
      this.w = dims.x;
      this.h = dims.y;
      cameraData = newCameraData;
      // render_origin(cameraData);
      this.setCameraData(cameraData);
      this.render(cameraData);
    };
  }

  // The continuation k is what to do when the drag ends. The argument
  // dragp to k is the point we released the drag on.
  start_drag(startp: Point, neighbors: Point[], k: (dragp: Point) => void) {
    const cameraData = this.getCameraData();
    const scale = scale_of_camera(cameraData);
    let dragp = clone(startp);

    this.render_extra = (camera, d) => {
      d.save();
      canvasIntoWorld(d, cameraData);
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
    // $(document).on('mousemove.drag', e => {
    //   const x = e.pageX!;
    //   const y = e.pageY!;
    //   const worldp = app_world_from_canvas(cameraData, { x, y });
    //   dragp.x = worldp.x;
    //   dragp.y = worldp.y;
    //   this.th.maybe();
    // });
    // $(document).on('mouseup.drag', e => {
    //   this.render_extra = null;
    //   $(document).off('.drag');
    //   const snaps = this.lastz;
    //   if (snaps.length >= 1) {
    //     dragp = this.coastline_layer.target_point(snaps[0]);
    //   }
    //   k(dragp);
    //   this.render(this.getCameraData());
    // });
  }

  save(): void {
    const geo: Geo = {
      ...this.coastline_layer.model(),
      ...this.image_layer.model(),
    };

    // $.ajax("/export", {
    //   method: "POST", data: JSON.stringify(geo), contentType: "text/plain", success: function() {
    //     console.log("success");
    //   }
    // });
  }

  start_measure(startp_in_world: Point): void {
    const cameraData = this.getCameraData();

    const dragp = clone(startp_in_world);
    const scale = scale_of_camera(cameraData);
    this.render_extra = (cameraData, d) => {
      d.save();
      canvasIntoWorld(d, cameraData);
      d.beginPath();

      d.moveTo(startp_in_world.x, startp_in_world.y);
      d.lineTo(dragp.x, dragp.y);

      d.lineWidth = 1 / scale;
      d.strokeStyle = colors.motion_guide;
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
      d.strokeText(dist, -width / 2, -3);
      d.fillText(dist, -width / 2, -3);

      d.restore();
    }
    // $(document).on('mousemove.drag', e => {
    //   const x = e.pageX!;
    //   const y = e.pageY!;
    //   const worldp = app_world_from_canvas(cameraData, { x, y });
    //   dragp.x = worldp.x;
    //   dragp.y = worldp.y;
    //   this.th.maybe();
    // });
    // $(document).on('mouseup.drag', e => {
    //   this.render_extra = null;
    //   $(document).off('.drag');
    //   this.render(this.getCameraData());
    // });
  }

  start_freehand(startp: Point, k: (dragp: Path) => void): void {
    const cameraData = this.getCameraData();
    const scale = scale_of_camera(cameraData);
    const path: Zpoint[] = [{ point: startp, z: 1000 }];
    const thresh = FREEHAND_SIMPLIFICATION_FACTOR / (scale * scale);
    this.render_extra = (camera, d) => {
      d.save();
      canvasIntoWorld(d, cameraData);
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
      d.lineWidth = 2 / scale;
      d.strokeStyle = colors.motion_guide;
      d.stroke();
      d.restore();
    }
    // $(document).on('mousemove.drag', e => {
    //   const x = e.pageX!;
    //   const y = e.pageY!;
    //   const worldp = app_world_from_canvas(cameraData, { x, y });
    //   path.push({ point: worldp, z: 1000 });
    //   resimplify(path);
    //   this.th.maybe();
    // });
    // $(document).on('mouseup.drag', e => {
    //   const spoint = this.get_snap(this.lastz);
    //   if (spoint != null) {
    //     path[path.length - 1] = { point: spoint, z: 1000 };
    //     startp = spoint;
    //   }

    //   this.render_extra = null;
    //   $(document).off('.drag');
    //   k(path.filter(({ point: pt, z }: Zpoint, n: number) => {
    //     return z > thresh || n == 0 || n == path.length - 1;
    //   }));
    //   this.render(this.getCameraData());
    // });
  }


  render_scale(cameraData: CameraData, d: Ctx): void {
    const scale = scale_of_camera(cameraData);
    const { w, h } = this;
    d.save();
    d.fillStyle = "black";
    d.font = "10px sans-serif";

    d.translate(Math.floor(w / 2) + 0.5, 0.5);
    function label(px_dist: number) {
      const str = meters_to_string(px_dist / scale);
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

  zoom_to(label: string): void {
    const { data, w, h } = this;
    const rawLabels: [string, t.RawLabel][] = Object.entries(data.json.geo.labels);
    const labels: Label[] = rawLabels.map(
      ([name, { pt: [x, y], properties }]) =>
        ({ name, pt: { x, y }, properties })
    );
    const selection = labels.filter(x => has_label(x, label));
    const pt = selection[0].pt;
    if (pt == null) throw `couldn\'t find ${label}`;
    const cameraData = this.getCameraData();
    const pixel_offset = apply(canvas_from_world_of_cameraData(cameraData), pt);
    const newCameraData = incCam(cameraData, (w - SIDEBAR_WIDTH) / 2 - pixel_offset.x, h / 2 - pixel_offset.y);
    this.setCameraData(newCameraData);
    this.render(newCameraData);
  }
}

// Entry point.
async function go() {
  const app = await mkApp();
  // For debugging in console.
  window['app'] = app;
}

go();
