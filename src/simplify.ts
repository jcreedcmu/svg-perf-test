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

export function simplify_arc(arc: Arc) {
  simplify(arc.points);
  var bbox = trivBbox();
  arc.bbox = bbox;
  arc.points.forEach(pt => { accumulate_bbox(pt.point, bbox); });
}

type Tri = [Zpoint, Zpoint, Zpoint] & { previous?: Tri, next?: Tri };

export function simplify(polygon: Zpoint[]) {
  var heap = minHeap();
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

function minHeap() {
  const array: any[] = [];

  function up(i: any) {
    var object = array[i];
    while (i > 0) {
      var up = ((i + 1) >> 1) - 1,
        parent = array[up];
      if (compare(object, parent) >= 0) break;
      array[parent.index = i] = parent;
      array[object.index = i = up] = object;
    }
  }

  function down(i: any) {
    var object = array[i];
    while (true) {
      var right = (i + 1) << 1,
        left = right - 1,
        down = i,
        child = array[down];
      if (left < array.length && compare(array[left], child) < 0) child = array[down = left];
      if (right < array.length && compare(array[right], child) < 0) child = array[down = right];
      if (down === i) break;
      array[child.index = i] = child;
      array[object.index = i = down] = object;
    }
  }

  return {
    push: (arg: any) => {
      up(arg.index = array.push(arg) - 1);
      return array.length;
    },
    pop: () => {
      var removed = array[0],
        object = array.pop();
      if (array.length) {
        array[object.index = 0] = object;
        down(0);
      }
      return removed;
    },
    remove: (removed: any) => {
      var i = removed.index,
        object = array.pop();
      if (i !== array.length) {
        array[object.index = i] = object;
        (compare(object, removed) < 0 ? up : down)(i);
      }
      return i;
    }
  };
}

export function compute_bbox(object: Poly, arcs: ArcStore) {
  const bbox = object.bbox = trivBbox();
  _.each(object.arcs, spec => {
    let arc_bbox = arcs.getArc(spec).bbox;
    accumulate_bbox({ x: arc_bbox.minX, y: arc_bbox.minY }, bbox);
    accumulate_bbox({ x: arc_bbox.maxX, y: arc_bbox.maxY }, bbox);
  });
}
