import _ = require('underscore');
import { ArcStore } from './arcstore';
import { Arc, Dict, Poly, Zpoint, Bbox, Point } from './types';
import { trivBbox } from './util';

function accumulate_bbox(pt: Point, bbox: Bbox) {
  bbox.minX = Math.min(pt.x, bbox.minX);
  bbox.maxX = Math.max(pt.x, bbox.maxX);
  bbox.minY = Math.min(pt.y, bbox.minY);
  bbox.maxY = Math.max(pt.y, bbox.maxY);
}

// adapted from http://bost.ocks.org/mike/simplify/simplify.js

// What simplify really does is take a polygon geojson feature and
// adds z-coordinates to every point that measure a penalty for
// removing that point. A penalty of 0 means it is collinear with
// neighboring points, higher penalities indicate the area of error
// resulting from removing that point (after first removing all
// lower-penalty points)

export function bbox_of_points(pts: Point[]): Bbox {
  const bb = trivBbox();
  pts.forEach(pt => { accumulate_bbox(pt, bb) });
  return bb;
}

// XXX deprecate?
export function resimplify_arc(ars: ArcStore, arc: Arc) {
  const pts = ars.arcPoints(arc);
  resimplify(pts);
  arc.bbox = bbox_of_points(pts.map(pt => pt.point));
}

type Gtri<T> = [T, T, T] & { previous?: Gtri<T>, next?: Gtri<T> };
type Tri = Gtri<Zpoint>;

export function simplify(pts: Point[]): Zpoint[] {
  return resimplify(pts.map(point => ({ point, z: 0 })));
}

export function resimplify(polygon: Zpoint[]): Zpoint[] {
  var heap = new minHeap();
  let maxArea = 0;
  let triangle: Tri;

  let triangles: Tri[] = [];

  for (var i = 1, n = polygon.length - 1; i < n; ++i) {
    triangle = <Tri>polygon.slice(i - 1, i + 2);
    if (triangle[1].z = area(triangle)) {
      triangles.push(triangle);
      heap.push(triangle);
    }
  }

  for (var i = 0, n = triangles.length; i < n; ++i) {
    triangle = triangles[i];
    triangle.previous = triangles[i - 1];
    triangle.next = triangles[i + 1];
  }

  while (triangle = heap.pop()) {
    // If the area of the current point is less than that of the previous point
    // to be eliminated, use the latter's area instead. This ensures that the
    // current point cannot be eliminated without eliminating previously-
    // eliminated points.
    if (triangle[1].z < maxArea) triangle[1].z = maxArea;
    else maxArea = triangle[1].z;

    if (triangle.previous) {
      triangle.previous.next = triangle.next;
      triangle.previous[2] = triangle[2];
      update(triangle.previous);
    } else {
      triangle[0].z = triangle[1].z;
    }

    if (triangle.next) {
      triangle.next.previous = triangle.previous;
      triangle.next[0] = triangle[0];
      update(triangle.next);
    } else {
      triangle[2].z = triangle[1].z;
    }
  }

  function update(triangle: Tri) {
    heap.remove(triangle);
    triangle[1].z = area(triangle);
    heap.push(triangle);
  }

  return polygon;
}

function compare(a: Tri, b: Tri) {
  return a[1].z - b[1].z;
}

function area(t: Tri) {
  return Math.abs((t[0].point.x - t[2].point.x) * (t[1].point.y - t[0].point.y) - (t[0].point.x - t[1].point.x) * (t[2].point.y - t[0].point.y));
}

class minHeap {
  array: any[] = [];

  up(i: any) {
    var object = this.array[i];
    while (i > 0) {
      var up = ((i + 1) >> 1) - 1,
        parent = this.array[up];
      if (compare(object, parent) >= 0) break;
      this.array[parent.index = i] = parent;
      this.array[object.index = i = up] = object;
    }
  }

  down(i: any) {
    var object = this.array[i];
    while (true) {
      var right = (i + 1) << 1,
        left = right - 1,
        down = i,
        child = this.array[down];
      if (left < this.array.length && compare(this.array[left], child) < 0) child = this.array[down = left];
      if (right < this.array.length && compare(this.array[right], child) < 0) child = this.array[down = right];
      if (down === i) break;
      this.array[child.index = i] = child;
      this.array[object.index = i = down] = object;
    }
  }

  push(arg: any) {
    this.up(arg.index = this.array.push(arg) - 1);
    return this.array.length;
  }

  pop() {
    var removed = this.array[0],
      object = this.array.pop();
    if (this.array.length) {
      this.array[object.index = 0] = object;
      this.down(0);
    }
    return removed;
  }

  remove(removed: any) {
    var i = removed.index,
      object = this.array.pop();
    if (i !== this.array.length) {
      this.array[object.index = i] = object;
      if (compare(object, removed) < 0)
        this.up(i);
      else
        this.down(i);
    }
    return i;
  }

}

export function compute_bbox(object: Poly, arcs: ArcStore) {
  const bbox = object.bbox = trivBbox();
  _.each(object.arcs, spec => {
    let arc_bbox = arcs.getArc(spec).bbox;
    accumulate_bbox({ x: arc_bbox.minX, y: arc_bbox.minY }, bbox);
    accumulate_bbox({ x: arc_bbox.maxX, y: arc_bbox.maxY }, bbox);
  });
}
