import { Geo, Arc, Point, RawPoly } from '../src/types';
import { resimplify_arc } from '../src/simplify';
import { readFileSync, createWriteStream } from 'fs';
import { scale_of_zoom, above_simp_thresh } from '../src/util';
import { unrawOfArc, ArcStore } from '../src/arcstore';
import * as PDF from 'pdfkit';

const ZOOM = 3;
const DEBUG = false;
const pageWidth = 8.5 * 72;
const pageHeight = 11 * 72;
const worldWidth = 4e6;
const worldHeight = 3.3e6;
const targetWidth = 8.5 * 72;
const targetHeight = worldHeight / worldWidth * targetWidth;

const doc = new PDF({ size: [pageWidth, pageHeight], bufferPages: true });
doc.pipe(createWriteStream('output.pdf'));
doc.lineWidth(0.01);
doc.lineJoin('round');

const geo: Geo = JSON.parse(readFileSync('../data/geo.json', 'utf8'));

const arcs: { [k: string]: Arc } = {};

const arcStore = new ArcStore(geo.points, geo.arcs, geo.polys);
const scale = scale_of_zoom(ZOOM);

Object.keys(geo.arcs).forEach(k => {
  const arc = unrawOfArc(k, geo.arcs[k]);
  resimplify_arc(arcStore, arc);
  arcs[k] = arc;
});

function xform(pt: Point): Point {
  return {
    x: (pageWidth - targetWidth) / 2 + targetWidth * pt.x / worldWidth,
    y: (pageHeight + targetHeight) / 2 - targetHeight * pt.y / worldHeight,
  }
}

function draw(o: RawPoly, t: 'coastline' | 'mountain') {

  let first = true;
  let exist = false;

  function plot(pt: Point) {
    if (first) {
      if (DEBUG)
        console.log(`moveTo(${pt.x}, ${pt.y})`);
      doc.moveTo(pt.x, pt.y);
      first = false;
    }
    else {
      if (DEBUG)
        console.log(`lineTo(${pt.x}, ${pt.y})`);
      doc.lineTo(pt.x, pt.y);
    }
  }

  for (let k of o.arcs) {
    const arcPts = arcStore.getArc(k).points
      .filter(({ z }) => above_simp_thresh(z, scale))
      .map(({ point }) => xform(point));
    if (arcPts.length > 1) {
      arcPts.slice(0, arcPts.length - 1).forEach(plot);
      exist = true;
    }
  }
  if (exist) {
    doc.closePath();
    if (t == 'coastline')
      doc.stroke([0, 0, 0]);
    else if (t == 'mountain')
      doc.fill([230, 230, 200]);
  }
}
Object.values(geo.polys).forEach(o => {
  if (o.properties.t == 'natural'
    && (o.properties.natural == 'coastline' ||
      o.properties.natural == 'mountain'))
    draw(o, o.properties.natural);
});

// const pt1: Point = xform({ x: 0, y: 0 });
// const pt2: Point = xform({ x: worldWidth, y: worldHeight });
// doc.rect(pt1.x, pt2.y, pt2.x - pt1.x, pt1.y - pt2.y);
// doc.stroke([128, 255, 255]);

doc.flushPages();
doc.end();
