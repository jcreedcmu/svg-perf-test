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

// I want to give a triple (S, x, y) which means
// the rectangle
// (2^S * x, 2^S * y) -- (2^S * (x+1), 2^S * (y+1))
// in world coordinates.

// I want to render that into DIMS.
// Hence:
// apply(canvas_from_world, (2^S * x, 2^S * y)) = (0,DIMS.y)
// apply(canvas_from_world, (2^S * (x+1), 2^S * (y+1))) = (DIMS.x,0)
// canvas_from_world = scale: DIMS.x/2^S , DIMS.y /2^S
//                     xlate: -x * DIMS.x , y * DIMS.y + DIMS.y

// {"scale":{"x":512,"y":-512},"translate":{"x":262144,"y":1572864}}
const scale_world_from_canvas = 512;
const chunk = { x: 512, y: 3072 };
const world_from_canvas = mkSE2({ x: scale_world_from_canvas, y: -scale_world_from_canvas },
  vscale(chunk, scale_world_from_canvas));

// const canvas_from_world = mkSE2({ x: 1 / 512, y: -1 / 512 }, { x: -512, y: 3072 });

//const canvas_from_world = inverse(world_from_canvas)

// target : {"scale":{"x":512,"y":-512},"translate":{"x":262144,"y":1572864}}

// // This gets us Ayulnagam
// const S = 17;
// const xx = 2;
// const yy = 11;

// This gets us the whole continent
// const S = 22;
// const xx = 0;
// const yy = 0;

const S = 20;
const xx = 2;
const yy = 2;

const canvas_from_world = mkSE2(
  { x: DIMS.x / (1 << S), y: -DIMS.y / (1 << S) },
  { x: -xx * DIMS.x, y: yy * DIMS.y + DIMS.y });

ui.cameraData.canvas_from_world = canvas_from_world;

console.log(JSON.stringify(inverse(ui.cameraData.canvas_from_world)));

render((d as any) as CanvasRenderingContext2D, DIMS, { geo, ui });

const out = fs.createWriteStream('/tmp/foo.png')
const stream = c.createPNGStream()
stream.pipe(out)
out.on('finish', () => {
  console.log('done');
  process.exit(0);
});
