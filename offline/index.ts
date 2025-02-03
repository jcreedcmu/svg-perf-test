import * as fs from 'fs';
import * as path from 'path';
import { createCanvas } from 'canvas';
import { render } from '../src/map-canvas-render';
import { GeoModel, Geometry, Rivers, UiState } from '../src/types';
import { LabelStore } from '../src/labelstore';
import { RiverLayer } from '../src/rivers';
import { SketchLayer } from '../src/sketch';
import { ArcStore } from '../src/arcstore';

const c = createCanvas(100, 100);
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

const ui: UiState = {} as any; // XXX

render((d as any) as CanvasRenderingContext2D, { geo, ui });

const out = fs.createWriteStream('/tmp/foo.png')
const stream = c.createPNGStream()
stream.pipe(out)
out.on('finish', () => {
  console.log('done');
  process.exit(0);
});
