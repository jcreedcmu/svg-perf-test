import { createCanvas } from 'canvas';
import * as fs from 'fs';
import * as path from 'path';
import { ArcStore } from '../src/arcstore';
import { LabelStore } from '../src/labelstore';
import { render } from '../src/map-canvas-render';
import { RiverLayer } from '../src/rivers';
import { SketchLayer } from '../src/sketch';
import { GeoModel, Geometry, Point, Rivers, UiState } from '../src/types';
import { mkUiState } from '../src/ui-state';
import { inverse, mkSE2 } from '../src/se2';
import { vscale } from '../src/vutil';

const DIMS: Point = { x: 512, y: 512 };
const c = createCanvas(DIMS.x, DIMS.y);
const d = c.getContext('2d');
d.fillStyle = 'red';
d.fillRect(0, 0, 50, 50);

// XXX factor some common code this shares with main.ts
const geoModel: GeoModel = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/geo.json'), 'utf8'));
const rivers: Rivers = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/rivers.json'), 'utf8'));
const geo: Geometry = {
  arcStore: new ArcStore(geoModel.points, geoModel.arcs, geoModel.polys),
  images: geoModel.images,
  labelStore: new LabelStore(geoModel.labels),
  riverLayer: new RiverLayer(rivers),
  sketchLayer: new SketchLayer()
};

const ui: UiState = mkUiState(geoModel.images, 0);

// {"scale":{"x":512,"y":-512},"translate":{"x":262144,"y":1572864}}
const scale_world_from_canvas = 512;
const chunk = { x: 512, y: 3072 };
const world_from_canvas = mkSE2({ x: scale_world_from_canvas, y: -scale_world_from_canvas },
  vscale(chunk, scale_world_from_canvas));
//ui.cameraData.canvas_from_world = mkSE2({ x: 1 / 256, y: -1 / 256 }, { x: -512 * 2, y: 3072 * 2 });
ui.cameraData.canvas_from_world = inverse(world_from_canvas);

console.log(JSON.stringify(inverse(ui.cameraData.canvas_from_world)));

render((d as any) as CanvasRenderingContext2D, DIMS, { geo, ui });

const out = fs.createWriteStream('/tmp/foo.png')
const stream = c.createPNGStream()
stream.pipe(out)
out.on('finish', () => {
  console.log('done');
  process.exit(0);
});
