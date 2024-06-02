import * as React from 'react';

import { createRoot } from 'react-dom/client';
import { Ctx, Geo, Label, Layer, Point, Rivers, Target, Tool } from './types';

import { Data, Loader } from './loader';

import { CameraData } from './camera-state';
import { Throttler } from './throttler';

import { ArcStore } from './arcstore';
import { CoastlineLayer } from './coastline';
import { LabelStore } from './labelstore';
import { RiverLayer } from './rivers';
import { SketchLayer } from './sketch';

import { MainUi, MainUiProps } from './ui';

// These two lines force webpack to believe that the file types.ts is
// actually used, since otherwise treeshaking or whatever finds out,
// correctly, that it has no runtime effect. But I do want changes
// to the file to trigger typescript rechecking.
// XXX this all should be obsolete maybe since I'm not using webpack anymore.
import * as t from './types';
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

// The main meat of this file.
export class App {
  w: number = 0;
  h: number = 0;
  layers: Layer[];
  lastz: Target[] = [];
  slastz: string = "[]";
  coastline_layer: CoastlineLayer;
  river_layer: RiverLayer;
  sketch_layer: SketchLayer;
  render_extra: null | ((cameraData: CameraData, d: Ctx) => void) = null;
  mode: Tool = "Pan";
  panning: boolean = false;
  data: Data; // Probably want to eventually get rid of this
  mouse: Point = { x: 0, y: 0 };
  selection: { arc: string } | null = null;
  th: Throttler;

  setCameraData(camera: CameraData): void {
  }

  getCameraData(): CameraData {
    throw new Error('Nope');
  }

  constructor(_data: Data) {
    this.th = new Throttler(() => { });
    this.data = _data;
    let count = 0;
    const geo: Geo = _data.json.geo;
    const rivers: Rivers = _data.json.rivers;
    const arcStore = new ArcStore(geo.points, geo.arcs, geo.polys);
    const labelStore = new LabelStore(geo.labels);
    this.coastline_layer = new CoastlineLayer(arcStore, labelStore, geo.counter);
    this.river_layer = new RiverLayer(rivers);
    this.sketch_layer = new SketchLayer();
    this.layers = [
      this.coastline_layer,
      this.river_layer,
      this.sketch_layer,
    ];

    // React rendering

    const root = createRoot(document.getElementById('react-root')!);
    const props: MainUiProps = {
      geo: {
        riverLayer: this.river_layer,
        coastlineLayer: this.coastline_layer,
        sketchLayer: this.sketch_layer,
      },
      images: geo.images,
    };
    const comp = React.createElement(MainUi, props, null);
    root.render(comp);
  }

  zoom_to(label: string): void {
    // const { data, w, h } = this;
    // const rawLabels: [string, t.RawLabel][] = Object.entries(data.json.geo.labels);
    // const labels: Label[] = rawLabels.map(
    //   ([name, { pt: [x, y], properties }]) =>
    //     ({ name, pt: { x, y }, properties })
    // );
    // const selection = labels.filter(x => has_label(x, label));
    // const pt = selection[0].pt;
    // if (pt == null) throw `couldn\'t find ${label}`;
    // const cameraData = this.getCameraData();
    // const pixel_offset = apply(canvas_from_world_of_cameraData(cameraData), pt);
    // const newCameraData = incCam(cameraData, (w - SIDEBAR_WIDTH) / 2 - pixel_offset.x, h / 2 - pixel_offset.y);
    // this.setCameraData(newCameraData);
    // this.render(newCameraData);
  }
}

// Entry point.
async function go() {
  const app = await mkApp();
  // For debugging in console.
  window['app'] = app;
}

go();
