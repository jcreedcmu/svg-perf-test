var simplify = require('./simplify');
var SIMPLIFICATION_FACTOR = 5; // higher = more simplification
var DEBUG_BBOX = false;

CoastlineLayer.prototype.rebuild = function() {
  this.rt = new RTree(10);
  this.vertex_rt = new RTree(10);
  var that = this;
  var arcs = this.arcs;
  var features = this.features;

  _.each(arcs, function(arc, an) {
    _.each(arc.points, function(point, pn) {
      that.vertex_rt.insert({x:point[0],y:point[1],w:0,h:0}, {arc:an, point:point});
    });
    simplify.simplify_arc(arc);
  });

  _.each(features, function(object, key) {
    simplify.compute_bbox(object, arcs);
    var bb = object.properties.bbox;
    that.rt.insert({x:bb.minx, y:bb.miny, w:bb.maxx - bb.minx, h:bb.maxy - bb.miny},
		   object);
  });

  var arc_to_feature = this.arc_to_feature = {};
  _.each(features, function(object, feature_ix) {
    _.each(object.arcs, function(arc_ix) {
      if (!arc_to_feature[arc_ix])
        arc_to_feature[arc_ix] = [];
      arc_to_feature[arc_ix].push(feature_ix);
    });
  });
}

function CoastlineLayer(features, arcs) {
  this.features = features;
  this.arcs = arcs;
  this.rebuild();
}

module.exports = CoastlineLayer;

CoastlineLayer.prototype.arc_targets = function(world_bbox) {
  return this.rt.bbox.apply(this.rt, world_bbox);
}

CoastlineLayer.prototype.targets = function(world_bbox) {
  var targets = this.vertex_rt.bbox.apply(this.vertex_rt, world_bbox);

  if (targets.length < 2) return targets;

  var orig = targets[0].point;
  for (var i = 1; i < targets.length; i++) {
    var here = targets[i].point;
    // If we're getting a set of points not literally on the same
    // point, pretend there's no match
    if (orig[0] != here[0]) return [];
    if (orig[1] != here[1]) return [];
  }
  // Otherwise return the whole set
  return targets;
}

CoastlineLayer.prototype.get_index = function(target) {
  var arc = this.arcs[target.arc].points;
  for (var i = 0; i < arc.length; i++) {
    if (arc[i] == target.point)
      return i;
  }
  throw ("Can't find " + JSON.stringify(target.point) + " in " + JSON.stringify(arc))
}


CoastlineLayer.prototype.render = function(d, camera, locus, world_bbox) {
  var that = this;
  d.save();

  d.translate(camera.x, camera.y);
  d.scale(camera.scale(), -camera.scale());

  d.strokeStyle = "black";
  d.lineJoin = "round";

  var arcs_to_draw_vertices_for = [];

  _.each(this.rt.bbox.apply(this.rt, world_bbox), function(object) {
    var arc_id_list = object.arcs;
    var arcs = that.arcs;

    d.beginPath();

    var n = 0;
    arc_id_list.forEach(function(arc_id) {
      var this_arc = arcs[arc_id].points;
      var arc_bbox = arcs[arc_id].properties.bbox;

      if (DEBUG_BBOX) {
        d.lineWidth = 1.5 / camera.scale();
        d.strokeStyle = "#0ff";
        d.strokeRect(arc_bbox.minx, arc_bbox.miny,
                     arc_bbox.maxx - arc_bbox.minx,
                     arc_bbox.maxy - arc_bbox.miny);
      }

      d.lineWidth = 0.9 / camera.scale();
      rect_intersect = world_bbox[0] < arc_bbox.maxx && world_bbox[2] > arc_bbox.minx && world_bbox[3] > arc_bbox.miny && world_bbox[1] < arc_bbox.maxy;


      if (this_arc.length < 2) {
	throw "arc " + arc_id + " must have at least two points";
      }
      if (!rect_intersect) {
	// draw super simplified
	this_arc = [this_arc[0],this_arc[this_arc.length - 1]];
      }
      else if (camera.zoom >= 6) {
	arcs_to_draw_vertices_for.push(this_arc);
      }

      this_arc.forEach(function(vert, ix) {
	if (n++ == 0)
    	  d.moveTo(vert[0] ,  vert[1] );
	else {
	  var p = {x: camera.x + (vert[0] * camera.scale()),
	    	   y: camera.y + (vert[1] * camera.scale())};

	  var draw = false;

	  // draw somewhat simplified
	  if (camera.zoom >= 6 || (vert[2] > SIMPLIFICATION_FACTOR / (camera.scale() * camera.scale())))
	    draw = true;

	  // if (p.x < OFFSET || p.x > w - OFFSET || p.y < OFFSET || p.y > h - OFFSET)
	  // // if (p.x < 0 || p.x > w - 0 || p.y < 0 || p.y > h - 0)
	  //   draw =  vert[2] > 5000;

	  if (ix == this_arc.length - 1)
	    draw = false;

	  if (ix == 0)
	    draw = true;

	  if (draw) {
    	    d.lineTo(vert[0], vert[1]);
	  }
	}
      });
    });
    d.closePath();


    d.lineWidth = 1.1 / camera.scale();
    d.strokeStyle = "#44a";
    d.stroke();
    d.fillStyle = "#e7eada";
    if (object.properties.natural == "lake")
      d.fillStyle = "#bac7f8";

    // if (object.name == "feature20") {
    //   d.strokeStyle = "#f0f";
    //   var feature_bbox = object.properties.bbox;
    //   var lw = 3.0 / camera.scale();
    //   d.lineWidth = lw;
    //   d.strokeRect(feature_bbox.minx - lw * 10, feature_bbox.miny - lw * 10,
    //                feature_bbox.maxx - feature_bbox.minx + lw * 20,
    //                feature_bbox.maxy - feature_bbox.miny + lw * 20);
    //   d.fillStyle = "#ff0";
    // }
    if (!DEBUG_BBOX)
      d.fill();
    else {
      var feature_bbox = object.properties.bbox;
      var lw = d.lineWidth = 3.0 / camera.scale();
      d.strokeStyle = "#f0f";
      d.strokeRect(feature_bbox.minx - lw, feature_bbox.miny - lw,
                   feature_bbox.maxx - feature_bbox.minx + lw * 2,
                   feature_bbox.maxy - feature_bbox.miny + lw * 2);
    }

  });

  if (g_mode != "Pan") {
    d.strokeStyle = "#333";
    d.fillStyle = "#ffd";
    var vert_size = 5 / camera.scale();
    arcs_to_draw_vertices_for.forEach(function(arc) {
      arc.forEach(function(vert, n) {
	if (d.fillStyle = vert[2] > 1000000 || camera.zoom > 10) {
	  d.fillStyle = vert[2] > 1000000 ? "#ffd" : "#f00";
	  d.strokeRect(vert[0] - vert_size/2, vert[1] - vert_size / 2,  vert_size,  vert_size);
	  d.fillRect(vert[0] - vert_size/2, vert[1] - vert_size / 2,  vert_size,  vert_size);
	}
      });
    });
  }
  d.restore();
}

CoastlineLayer.prototype.recompute_arc_feature_bbox = function(arc_id) {
  var that = this;
  this.arc_to_feature[arc_id].forEach(function(feature_ix) {
    var object = that.features[feature_ix];
    var bb = object.properties.bbox;
    that.rt.remove({x:bb.minx, y:bb.miny, w:bb.maxx - bb.minx, h:bb.maxy - bb.miny},
		   object);
    simplify.compute_bbox(object, that.arcs);
    that.rt.insert({x:bb.minx, y:bb.miny, w:bb.maxx - bb.minx, h:bb.maxy - bb.miny},
		   object);
  });
}

// special case first and last of arc??
CoastlineLayer.prototype.replace_vert_in_arc = function(rt_entry,  p) {
  var arc_id = rt_entry.arc;


  var vert_ix = this.get_index(rt_entry);
  var arc = this.arcs[arc_id];
  var oldp = rt_entry.point;

  var new_pt = arc.points[vert_ix] = [p.x, p.y, 1000]; // I think this 1000 can be whatever
  simplify.simplify_arc(arc);
  var results = this.vertex_rt.remove({x:oldp[0],y:oldp[1],w:0,h:0}, rt_entry);
  this.vertex_rt.insert({x:p.x,y:p.y,w:0,h:0}, {arc: arc_id, point: new_pt});
  this.recompute_arc_feature_bbox(arc_id);
}

CoastlineLayer.prototype.add_vert_to_arc = function(arc_id,  p) {
  var arc = this.arcs[arc_id];
  var len = arc.points.length;
  var oldp = arc.points[len - 1];
  arc.points[len - 1] = [p.x, p.y, 1000];
  arc.points[len] = oldp;
  simplify.simplify_arc(arc);

  var results = this.vertex_rt.remove({x:oldp[0],y:oldp[1],w:0,h:0});

  // XXX these are all wrong now
  this.vertex_rt.insert({x:p.x,y:p.y,w:0,h:0}, [arc_id, len-1]);
  this.vertex_rt.insert({x:oldp[0],y:oldp[1],w:0,h:0}, [arc_id, len]);
  this.vertex_rt.insert({x:oldp[0],y:oldp[1],w:0,h:0}, [arc_id, 0]);

  this.recompute_arc_feature_bbox(arc_id);
};

CoastlineLayer.prototype.break_segment = function(segment, p) {
  var arc_id = segment.arc;
  var arc = this.arcs[arc_id];

  var newp = [p.x, p.y, 1000];
  arc.points.splice(segment.ix + 1, 0, newp);
  simplify.simplify_arc(arc);

  this.vertex_rt.insert({x:p.x,y:p.y,w:0,h:0}, {arc:arc_id, point:newp});
  this.recompute_arc_feature_bbox(arc_id);
};

CoastlineLayer.prototype.model = function() {
  return {
    features: this.features.map(function (object) {
      return _.extend(
      {}, object,
	{ properties: _.omit(object.properties, "bbox") });
    }),
    // strip out deviation measurements and bboxes
    arcs: this.arcs.map(function(arc) {
      return _.extend(
	{}, arc,
	{ properties: _.omit(arc.properties, "bbox"),
	  points: arc.points.map(function(p) {
	    return [p[0], p[1]];
	  })})
    })};
}

CoastlineLayer.prototype.filter = function() {
  this.arcs =
    // strip out collinearish points
    this.arcs.map(function(arc) {
      return _.extend({}, arc, {points: arc.points.filter(function(p, n) {
	return n == 0 || n == arc.points.length - 1 || p[2] > 1000000;
      })})
    });
  this.rebuild();
}
