exports.init = function(features, arcs) {
  g_arcs = arcs;
  g_coast_rt = new RTree(10);
   _.each(features.objects, function(object, k) {
    var bb = object.properties.bbox;
    g_coast_rt.insert({x:bb.minx, y:bb.miny, w:bb.maxx - bb.minx, h:bb.maxy - bb.miny},
		      object);
  });
}


exports.render = function(d, camera, locus, world_bbox) {
  d.save();

  d.translate(camera.x, camera.y);
  d.scale(camera.scale(), -camera.scale());

  d.strokeStyle = "black";
  d.lineJoin = "round";

  _.each(g_coast_rt.bbox.apply(g_coast_rt, world_bbox), function(object, k) {
    var arc_id_lists = object.arcs;
    var arcs = g_arcs;

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

	this_arc.forEach(function(vert, ix) {
	  if (n++ == 0)
    	    d.moveTo(vert[0] ,  vert[1] );
	  else {
	    var p = {x: camera.x + (vert[0] * camera.scale()),
	    	     y: camera.y + (vert[1] * camera.scale())};

	    var draw = false;

	    if (vert[2] > 5 / (camera.scale() * camera.scale()))
	      draw = true;

	    // if (p.x < OFFSET || p.x > w - OFFSET || p.y < OFFSET || p.y > h - OFFSET)
	    // // if (p.x < 0 || p.x > w - 0 || p.y < 0 || p.y > h - 0)
	    //   draw =  vert[2] > 5000;

	    if (ix == this_arc.length - 1)
	      draw = false;

	    if (ix == 0)
	      draw = true;

	    if (draw) {
    	      d.lineTo(vert[0] ,   vert[1] );
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


  d.restore();
}
