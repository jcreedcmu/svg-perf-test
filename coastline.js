var simplify = require('./simplify');
var SIMPLIFICATION_FACTOR = 10; // higher = more simplification
var DEBUG_BBOX = false;
var colors = require('./colors');
var labels = require('./labels');

CoastlineLayer.prototype.rebuild = function() {
  this.rt = new RTree(10);
  this.vertex_rt = new RTree(10);
  this.label_rt = new RTree(10);
  var that = this;
  var arcs = this.arcs;
  var features = this.features;
  var labels = this.labels;

  _.each(arcs, function(arc, an) {
    _.each(arc.points, function(point, pn) {
      that.vertex_rt.insert({x:point[0],y:point[1],w:0,h:0}, {arc:an, point:point});
    });
    simplify.simplify_arc(arc);
  });

  _.each(this.labels, function(p) {
    that.label_rt.insert({x:p.pt[0],y:p.pt[1],w:0,h:0}, {label: p.name});
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

function collect(objects, type) {
  return _.object(objects.filter(function(x) { return x.type == type; })
		  .map(function(x) { return [x.name, x] }));
}

function CoastlineLayer(objects, counter) {
  this.counter = counter;
  this.features = collect(objects, "Polygon");
  this.arcs = collect(objects, "arc");
  this.labels = collect(objects, "point");
  this.rebuild();
}

module.exports = CoastlineLayer;

CoastlineLayer.prototype.arc_targets = function(world_bbox) {
  return this.rt.bbox.apply(this.rt, world_bbox);
}

CoastlineLayer.prototype.arc_vertex_targets = function(world_bbox) {
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

CoastlineLayer.prototype.label_targets = function(world_bbox) {
  var targets = this.label_rt.bbox.apply(this.label_rt, world_bbox);
  if (targets.length < 2)
    return targets;
  else
    return [];
}

CoastlineLayer.prototype.target_point = function(target) {
  var pt = target[0] == "coastline" ?
      target[1].point :
      this.labels[target[1].label].pt;
  return {x: pt[0], y: pt[1]};
}

// invariant: targets.length >= 1
CoastlineLayer.prototype.targets_nabes = function(targets) {
  var that = this;

  // XXX what happens if targets is of mixed type ugh
  if (targets[0][0] == "coastline") {
      var neighbors = [];

    targets.forEach(function(target) {
      var ctarget = target[1];
      var ix = that.get_index(ctarget);
      var arc_points = that.arcs[ctarget.arc].points;
      if (ix > 0) neighbors.push(arc_points[ix - 1]);
      if (ix < arc_points.length - 1) neighbors.push(arc_points[ix + 1]);
    });
    return neighbors;
  }
  else {
    return [];
  }
}

CoastlineLayer.prototype.targets = function(world_bbox) {
  return [].concat(
    this.arc_vertex_targets(world_bbox).map(function(x) { return ["coastline", x] }),
    this.label_targets(world_bbox).map(function(x) { return ["label", x] })
  );
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
  var scale = camera.scale();
  var that = this;
  d.save();

  d.translate(camera.x, camera.y);
  d.scale(scale, -scale);

  d.strokeStyle = "black";
  d.lineJoin = "round";

  var arcs_to_draw_vertices_for = [];
  var salients = [];

  var features = this.rt.bbox.apply(this.rt, world_bbox);
  features = _.sortBy(features, function(x) {
    var z = 0;
    if (x.properties.natural == "lake") z = 1;
    if (x.properties.natural == "mountain") z = 1;
    if (x.properties.road == "highway") z = 2;
    return z;
  });
  _.each(features, function(object) {
    var arc_id_list = object.arcs;
    var arcs = that.arcs;

    d.lineWidth = 0.9 / scale;
    d.beginPath();

    var first_point = arcs[arc_id_list[0]].points[0];
    d.moveTo(first_point[0], first_point[1]);

    var curpoint = first_point;
    var n = 0;

    arc_id_list.forEach(function(arc_id) {
      var this_arc = arcs[arc_id].points;
      var arc_bbox = arcs[arc_id].properties.bbox;
      if (DEBUG_BBOX) {
        d.lineWidth = 1.5 / scale;
        d.strokeStyle = colors.debug;
        d.strokeRect(arc_bbox.minx, arc_bbox.miny,
                     arc_bbox.maxx - arc_bbox.minx,
                     arc_bbox.maxy - arc_bbox.miny);
      }

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
	if (ix == 0) return;

	var p = {x: camera.x + (vert[0] * scale),
	    	 y: camera.y + (vert[1] * scale)};

	var draw = false;

	// draw somewhat simplified
	if (camera.zoom >= 6 || (vert[2] > SIMPLIFICATION_FACTOR / (scale * scale)))
	  draw = true;
	if (ix == this_arc.length - 1)
	  draw = true;
	if (draw) {
    	  d.lineTo(vert[0], vert[1]);
	  if (object.properties.road && n % 10 == 5) {
	    salients.push({props: object.properties,
			   pt: [(vert[0] + curpoint[0]) / 2, (vert[1] + curpoint[1]) / 2]});
	  }
	  curpoint = vert;
	  n++;
	}

      });
    });
    realize_path(object.properties, scale, salients);
  });

  // draw vertices
  if (g_mode != "Pan") {
    d.strokeStyle = "#333";
    d.fillStyle = "#ffd";
    var vert_size = 5 / scale;
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

  // doing this because it involves text, which won't want the negative y-transform
  salients.forEach(function(salient) {
    realize_salient(salient.props, camera, salient.pt);
  });

  // render labels
  if (camera.zoom < 1) return;
  d.lineJoin = "round";
  this.label_rt.bbox.apply(this.label_rt, world_bbox).forEach(function(x) {
    labels.draw_label(d, camera, that.labels[x.label]);
  });
}


function realize_salient(props, camera, pt) {
  if (camera.zoom < 2) return;
  // implied:
  //  d.translate(camera.x, camera.y);
  //  d.scale(scale, -scale);

  var q = {x: pt[0] * camera.scale() + camera.x,
	   y: pt[1] * -camera.scale() + camera.y };

  var stroke = null;
  d.fillStyle = "#55a554";
  if (props.text.match(/^P/)) d.fillStyle = "#29a";
  if (props.text.match(/^Z/)) d.fillStyle = "#e73311";
  if (props.text.match(/^U/)) {
    d.fillStyle = "#fffff7";
    stroke = "black";
  }

  var txt = props.text;
  var height = 10;
  d.font = "bold " + height + "px sans-serif";
  var width = d.measureText(txt).width;

  var box_height = 12;
  var box_width = width + 10;
  d.fillRect(q.x - box_width / 2, q.y - box_height / 2, box_width, box_height);

  d.fillStyle = "white";
  if (stroke != null) d.fillStyle = stroke;
  d.fillText(txt, q.x - width/2, q.y + height/2 - 1);

  if (stroke != null) {
    d.strokeStyle = stroke;
    d.lineWidth = 0.9;
    d.strokeRect(q.x - box_width / 2, q.y - box_height / 2, box_width, box_height);
  }
}

function realize_path(props, scale, salients) {
  d.lineWidth = 1.1 / scale;

  if (props.natural == "coastline") {
    d.strokeStyle = colors.water_border;
    d.stroke();
    d.fillStyle = colors.land;
    if (!DEBUG_BBOX)
      d.fill();
  }

  if (props.natural == "lake") {
    d.strokeStyle = colors.water_border;
    d.stroke();
    d.fillStyle = "#bac7f8";
    if (!DEBUG_BBOX)
      d.fill();
  }

  if (props.natural == "mountain") {
    d.fillStyle = "#a98";
    if (!DEBUG_BBOX)
      d.fill();
  }

  if (props.road == "highway") {
    d.lineWidth = 1.5 / scale;
    d.strokeStyle = "#f70";
    d.stroke();
  }

  if (DEBUG_BBOX) {
    var feature_bbox = props.bbox;
    var lw = d.lineWidth = 3.0 / scale;
    d.strokeStyle = "#f0f";
    d.strokeRect(feature_bbox.minx - lw, feature_bbox.miny - lw,
                 feature_bbox.maxx - feature_bbox.minx + lw * 2,
                 feature_bbox.maxy - feature_bbox.miny + lw * 2);
  }
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
CoastlineLayer.prototype.replace_vert = function(targets,  p) {
  var that = this;
  targets.forEach(function(target) {
    if (target[0] == "coastline") {
      var rt_entry = target[1];

      var arc_id = rt_entry.arc;

      var vert_ix = that.get_index(rt_entry);
      var arc = that.arcs[arc_id];
      var oldp = rt_entry.point;

      var new_pt = arc.points[vert_ix] = [p.x, p.y, 1000]; // I think this 1000 can be whatever
      simplify.simplify_arc(arc);
      var results = that.vertex_rt.remove({x:oldp[0],y:oldp[1],w:0,h:0}, rt_entry);
      that.vertex_rt.insert({x:p.x,y:p.y,w:0,h:0}, {arc: arc_id, point: new_pt});
      that.recompute_arc_feature_bbox(arc_id);
    }
    else if (target[0] == "label") {
      var lab = that.labels[target[1].label];
      that.label_rt.remove({x:lab.pt[0],y:lab.pt[1],w:0,h:0}, target[1]);
      lab.pt = [p.x, p.y];
      that.label_rt.insert({x:lab.pt[0],y:lab.pt[1],w:0,h:0}, target[1]);
    }
  });
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
  var features = _.map(this.features, function (object) {
    return _.extend({}, object,
		    { properties: _.omit(object.properties, "bbox") });
  });
  var arcs = _.map(this.arcs, function(arc) {
    return _.extend(
      {}, arc,
      { properties: _.omit(arc.properties, "bbox"),
	points: arc.points.map(function(p) {
	  return [p[0], p[1]];
	})})
  });
  return { counter: this.counter, objects: [].concat(
    features,
    arcs,
    _.map(this.labels, function(x) { return x })) };
}

CoastlineLayer.prototype.draw_selected_arc = function(d, arc_id) {
  d.beginPath();
  this.arcs[arc_id].points.forEach(function(pt, n) {
    if (n == 0)
      d.moveTo(pt[0], pt[1])
    else
      d.lineTo(pt[0], pt[1])
  });
  d.stroke();
}

CoastlineLayer.prototype.filter = function() {
  var that = this;
  _.each(this.features, function(obj) {
    if (obj.properties.natural == "mountain") {
      // strip out collinearish points
      var arc = that.arcs[obj.arcs[0]];
      arc.points =  arc.points.filter(function(p, n) {
	return n == 0 || n == arc.points.length - 1 || p[2] > 1000000;
      });
    }
  });
  this.rebuild();
}

CoastlineLayer.prototype.add_arc_feature = function(type, points, properties) {
  var that = this;
  var feature_name = "f" + this.counter;
  var arc_name = "a" + this.counter;
  this.counter++;
  var arc = this.arcs[arc_name] = {name: arc_name, points: points, type: "arc", properties: {}};
  var feature = this.features[feature_name] =
      {name: feature_name, arcs: [arc_name], type: type, properties: properties};
  simplify.simplify_arc(arc);
  simplify.compute_bbox(feature, this.arcs);

  _.each(arc.points, function(point, pn) {
    that.vertex_rt.insert({x:point[0],y:point[1],w:0,h:0}, {arc:arc_name, point:point});
  });


  var bb = feature.properties.bbox;
  that.rt.insert({x:bb.minx, y:bb.miny, w:bb.maxx - bb.minx, h:bb.maxy - bb.miny},
		 feature);

  var arc_to_feature = this.arc_to_feature;
  if (!arc_to_feature[arc_name])
    arc_to_feature[arc_name] = [];
  arc_to_feature[arc_name].push(feature_name);

}

CoastlineLayer.prototype.breakup = function() {
  var that = this;
  _.each(this.arcs, function(v, k) {
    if (v.points.length > 200) {
      var num_chunks = Math.ceil(v.points.length / 200);
      var cut_positions = [0];
      for (var i = 0; i < num_chunks - 1; i++) {
	cut_positions.push(Math.floor((i + 1) * (v.points.length / num_chunks)));
      }
      cut_positions.push(v.points.length - 1);
      var replacement_arcs = [];
      for (var j = 0; j < cut_positions.length - 1; j++) {
	var arc = {name: k + "-" + j, type: "arc", properties: {}, points: []};
	for (var jj = cut_positions[j]; jj <= cut_positions[j+1]; jj++) {
	  arc.points.push(clone(v.points[jj]));
	}
	that.arcs[arc.name] = arc;
	replacement_arcs.push(arc.name);
      }
      var feature_name = that.arc_to_feature[k];
      var feature_arcs = that.features[feature_name].arcs;
      var ix = _.indexOf(feature_arcs, k);
      if (ix == -1)
	throw ("couldn't find " + k + " in " + JSON.stringify(feature_arcs));
      feature_arcs.splice.apply(feature_arcs, [ix, 1].concat(replacement_arcs));

      delete that.arcs[k];
    }
  });
  this.rebuild();
}

CoastlineLayer.prototype.make_insert_feature_modal = function(pts, lab, dispatch) {
  var that = this;
  var process_f = null;

  $('#insert_feature input[name="text"]')[0].value = "";
  $('#insert_feature input[name="road"]')[0].value = "highway";
  $('#insert_feature input[name="zoom"]')[0].value = "";

  process_f = function (obj) {
    that.add_arc_feature("Polygon", pts, obj);
  }

  var submit_f = function(e) {
    e.preventDefault();
    var obj = _.object($("#insert_feature form").serializeArray().map(function(pair) {
      return [pair.name, pair.value];
    }));
    if (obj.zoom == null || obj.zoom == "")
      delete obj.zoom;
    process_f(obj);
    dispatch();
    $("#insert_feature").modal("hide");
  };
  $("#insert_feature form").off("submit");
  $("#insert_feature form").on("submit", submit_f);
  $("#insert_feature form button[type=submit]").off("click");
  $("#insert_feature form button[type=submit]").on("click", submit_f);

  $('#insert_feature').modal('show');
  setTimeout(function() { $('#insert_feature input[name="text"]').focus(); }, 500);
}
