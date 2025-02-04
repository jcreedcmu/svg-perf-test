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

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { mkCameraData } from '../src/camera-state';

const _argv = yargs(hideBin(process.argv))
  .strict()
  .usage('$0 <scale> <x> <y>', 'render an image', yargs =>
    yargs
      .positional('scale', {
        describe: 'for a square region 2^$scale meters on each side [Example: 22]',
        type: 'number'
      })
      .positional('x', {
        describe: 'squares east of the origin [Example: 0]',
        type: 'number'
      })
      .positional('y', {
        describe: 'squares north of the origin [Example: 0]',
        type: 'number'
      })
  )
  .option('outFile', { alias: 'o', description: 'output file', type: 'string' })
  .option('dim', { alias: 'd', description: 'output image size in pixels', type: 'number', default: 512 })
  .parse()
const argv = (_argv as any) as {
  scale: number,
  x: number,
  y: number,
  outFile?: string,
  dim?: number,
}
const imageSize = argv.dim ?? 512;

const DIMS: Point = { x: imageSize, y: imageSize };
const c = createCanvas(DIMS.x, DIMS.y);
const d = c.getContext('2d');

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
ui.mouseState = { t: 'pan', cameraData: ui.cameraData, orig_p_in_page: { x: 0, y: 0 }, p_in_page: { x: 0, y: 0 } };

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
const scale_world_from_canvas = 512;
const chunk = { x: 512, y: 3072 };
const world_from_canvas = mkSE2({ x: scale_world_from_canvas, y: -scale_world_from_canvas },
  vscale(chunk, scale_world_from_canvas));

// // This gets us Ayulnagam
// const S = 17;
// const xx = 2;
// const yy = 11;

// This gets us the whole continent
// const S = 22;
// const xx = 0;
// const yy = 0;

const S = argv.scale;
const xx = argv.x;
const yy = argv.y;

const canvas_from_world = mkSE2(
  { x: DIMS.x / (1 << S), y: -DIMS.y / (1 << S) },
  { x: -xx * DIMS.x, y: yy * DIMS.y + DIMS.y });

ui.cameraData.canvas_from_world = canvas_from_world;

console.log(JSON.stringify(inverse(ui.cameraData.canvas_from_world)));

render((d as any) as CanvasRenderingContext2D, DIMS, { geo, ui });

const outFile = argv.outFile ?? `/tmp/tile-${S}-${xx}-${yy}.png`;
const out = fs.createWriteStream(outFile)
const stream = c.createPNGStream()
stream.pipe(out)
out.on('finish', () => {
  console.log(`wrote to ${outFile}`);
  process.exit(0);
});
