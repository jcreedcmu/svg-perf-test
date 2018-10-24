// node break.js > b.json

var fs = require("fs");
var g_data = JSON.parse(fs.readFileSync("a.json"));

// vertex = float * float
// g_data.features[0].geometry.coordinates[0][0] : vertex
// g_data.features[0].geometry.coordinates[0] : vertex list = poly
// g_data.features[0].geometry.coordinates : vertex list list = multipoly
// g_data.features : { geometry: {coordinates : vertex list list}} list

CHUNK_SIZE = 200;

function accumulate_bbox(pt, bbox) {
  bbox.minx = Math.min(pt[0], bbox.minx);
  bbox.maxx = Math.max(pt[0], bbox.maxx);
  bbox.miny = Math.min(pt[1], bbox.miny);
  bbox.maxy = Math.max(pt[1], bbox.maxy);
}

function new_bbox() {
  return {minx: Number.MAX_VALUE, miny: Number.MAX_VALUE,
	  maxx: Number.MIN_VALUE, maxy: Number.MIN_VALUE};
}

var objects = {};
var all_arcs = [];
var all_arcs_bboxes = [];
var out = {type: "Topology",
	   transform: {
	     scale: [1,1],
	     translate: [0,0],
	   },
	   objects: objects,
	   arcs: all_arcs,
	   arc_bboxes: all_arcs_bboxes};

g_data.features.forEach(function(old_feature, ix) {
  var name = "feature" + ix;
  var arc_lists = [];
  var feature_bbox = new_bbox();
  objects[name] = {type: "Polygon", // but really multipolygon?
 		   arcs: arc_lists,
		   properties: {bbox: feature_bbox}};

  old_feature.geometry.coordinates.forEach(function(poly, ix) {
    simplify(poly);
    var arcs = [];
    arc_lists.push(arcs);
    var chunks = Math.ceil(poly.length / CHUNK_SIZE);
    for (var i = 0; i < chunks; i++) {
      var arc = [];
      var arc_bbox = new_bbox();
      for (var j = 0; j < CHUNK_SIZE + 1; j++) {
 	var n = i * CHUNK_SIZE + j;
 	if (n < poly.length) {
 	  arc.push(poly[n]);
	  accumulate_bbox(poly[n], arc_bbox);
	  accumulate_bbox(poly[n], feature_bbox);
 	}
      }
      arc = arc.filter(function(x, i) {
      	return i == 0 || i == arc.length - 1 || x[2] > 0;
      });
      all_arcs.push(arc);
      all_arcs_bboxes.push(arc_bbox);
      arcs.push(all_arcs.length - 1);
    }
  });
});

console.log(JSON.stringify(out, null, 2));

// adapted from http://bost.ocks.org/mike/simplify/simplify.js

// What simplify really does is take a polygon geojson feature and
// adds z-coordinates (i.e. [2]-coordinates) to every point that
// measure a penalty for removing that point. A penalty of 0 means it
// is collinear with neighboring points, higher penalities indicate
// the area of error resulting from removing that point (after first
// removing all lower-penalty points)

function simplify(polygon) {
  var heap = minHeap(),
      maxArea = 0,
      triangle;


  var triangles = [];

  for (var i = 1, n = polygon.length - 1; i < n; ++i) {
    triangle = polygon.slice(i - 1, i + 2);
    if (triangle[1][2] = area(triangle)) {
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
    if (triangle[1][2] < maxArea) triangle[1][2] = maxArea;
    else maxArea = triangle[1][2];

    if (triangle.previous) {
      triangle.previous.next = triangle.next;
      triangle.previous[2] = triangle[2];
      update(triangle.previous);
    } else {
      triangle[0][2] = triangle[1][2];
    }

    if (triangle.next) {
      triangle.next.previous = triangle.previous;
      triangle.next[0] = triangle[0];
      update(triangle.next);
    } else {
      triangle[2][2] = triangle[1][2];
    }
  }

  function update(triangle) {
    heap.remove(triangle);
    triangle[1][2] = area(triangle);
    heap.push(triangle);
  }

  return polygon;
}

function compare(a, b) {
  return a[1][2] - b[1][2];
}

function area(t) {
  return Math.abs((t[0][0] - t[2][0]) * (t[1][1] - t[0][1]) - (t[0][0] - t[1][0]) * (t[2][1] - t[0][1]));
}

function minHeap() {
  var heap = {},
      array = [];

  heap.push = function() {
    for (var i = 0, n = arguments.length; i < n; ++i) {
      var object = arguments[i];
      up(object.index = array.push(object) - 1);
    }
    return array.length;
  };

  heap.pop = function() {
    var removed = array[0],
        object = array.pop();
    if (array.length) {
      array[object.index = 0] = object;
      down(0);
    }
    return removed;
  };

  heap.remove = function(removed) {
    var i = removed.index,
        object = array.pop();
    if (i !== array.length) {
      array[object.index = i] = object;
      (compare(object, removed) < 0 ? up : down)(i);
    }
    return i;
  };

  function up(i) {
    var object = array[i];
    while (i > 0) {
      var up = ((i + 1) >> 1) - 1,
          parent = array[up];
      if (compare(object, parent) >= 0) break;
      array[parent.index = i] = parent;
      array[object.index = i = up] = object;
    }
  }

  function down(i) {
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

  return heap;
}
