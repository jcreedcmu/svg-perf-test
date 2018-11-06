import { Geo, Arc, Point, Poly } from '../src/types';
import { simplify_arc } from '../src/simplify';
import { readFileSync, createWriteStream } from 'fs';
import { scale_of_zoom, above_simp_thresh } from '../src/util';
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

const data: Geo = JSON.parse(readFileSync('../data/geo.json', 'utf8'));

const arcs: { [k: string]: Arc } = {};

const scale = scale_of_zoom(ZOOM);

data.objects.forEach(o => {
  if (o.type == 'arc') {
    simplify_arc(o);
    arcs[o.name] = o;
  }
});

function xform(pt: Point): Point {
  return {
    x: (pageWidth - targetWidth) / 2 + targetWidth * pt.x / worldWidth,
    y: (pageHeight + targetHeight) / 2 - targetHeight * pt.y / worldHeight,
  }
}

function draw(o: Poly, t: 'coastline' | 'mountain') {

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
    const arcPts = arcs[k].points
      .filter(pt => above_simp_thresh((pt[2] || 0), scale))
      .map(pt => ({ x: pt[0], y: pt[1] }))
      .map(xform);
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
data.objects.forEach(o => {

  if (o.type == 'Polygon' && o.properties.t == 'natural'
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
