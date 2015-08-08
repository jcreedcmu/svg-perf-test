var simplify = require('./simplify');
var SIMPLIFICATION_FACTOR = 5; // higher = more simplification

function CoastlineLayer(features, arcs) {
  this.arcs = arcs;
  this.rt = new RTree(10);
  this.vertex_rt = new RTree(10);
  var that = this;

  _.each(arcs, function(arc, an) {
    _.each(arc.points, function(point, pn) {
      if (pn != arc.points.length - 1)
	that.vertex_rt.insert({x:point[0],y:point[1],w:0,h:0},[an,pn])
    });
    simplify.simplify_feature(arc);
  });

  _.each(features.objects, function(object) {
    simplify.compute_bbox(object, arcs);
    var bb = object.properties.bbox;
    that.rt.insert({x:bb.minx, y:bb.miny, w:bb.maxx - bb.minx, h:bb.maxy - bb.miny},
		   object);
  });
}

module.exports = CoastlineLayer;

CoastlineLayer.prototype.targets = function(world_bbox) {
  var targets = this.vertex_rt.bbox.apply(this.vertex_rt, world_bbox);
  return targets.length == 0 ? [] : [targets[0]];
}

CoastlineLayer.prototype.render = function(d, camera, locus, world_bbox) {
  var that = this;
  d.save();

  d.translate(camera.x, camera.y);
  d.scale(camera.scale(), -camera.scale());

  d.strokeStyle = "black";
  d.lineJoin = "round";

  var arcs_to_draw_vertices_for = [];

  _.each(this.rt.bbox.apply(this.rt, world_bbox), function(object, k) {
    var arc_id_lists = object.arcs;
    var arcs = that.arcs;


    d.beginPath();
    arc_id_lists.forEach(function(arc_id_list) {
      var n = 0;
      arc_id_list.forEach(function(arc_id, arc_id_ix) {
	var this_arc = arcs[arc_id].points;
	var arc_bbox = arcs[arc_id].properties.bbox;
	d.lineWidth = 0.9 / camera.scale();
	rect_intersect = world_bbox[0] < arc_bbox.maxx && world_bbox[2] > arc_bbox.minx && world_bbox[3] > arc_bbox.miny && world_bbox[1] < arc_bbox.maxy;

	//// Debugging bboxes
	// d.strokeStyle = rect_intersect ?  "black" : "red";
	// d.strokeRect(arc_bbox.minx, -arc_bbox.maxy, arc_bbox.maxx-arc_bbox.minx, arc_bbox.maxy - arc_bbox.miny);

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
    });

    d.lineWidth = 1.1 / camera.scale();
    d.strokeStyle = "#44a";
    d.stroke();
    d.fillStyle = "#e7eada"; // k == "feature0" ? "#fed" : "white";
    d.fill();
  });

  d.strokeStyle = "#333";
  d.fillStyle = "#ffd";
  var vert_size = 5 / camera.scale();
  arcs_to_draw_vertices_for.forEach(function(arc) {
    arc.forEach(function(vert, n) {
      d.strokeRect(vert[0] - vert_size/2, vert[1] - vert_size / 2,  vert_size,  vert_size);
      d.fillRect(vert[0] - vert_size/2, vert[1] - vert_size / 2,  vert_size,  vert_size);
    });
  });

  d.restore();
}

// special case first and last of arc??
CoastlineLayer.prototype.replace_vert_in_arc = function(entry,  p) {
  var arc_id = entry[0];
  var vert_ix = entry[1];
  var oldp = coastline_layer.arcs[arc_id].points[vert_ix];
  coastline_layer.arcs[arc_id].points[vert_ix] = [p.x, p.y, 1000];
  var results = this.vertex_rt.remove({x:oldp[0],y:oldp[1],w:0,h:0}, entry);
  console.log(results);
  this.vertex_rt.insert({x:p.x,y:p.y,w:0,h:0}, entry);
}
