function bbox_test_with_slack(p, bbox, slack) {
  return (p.x + slack > bbox.minx && p.y + slack > bbox.miny &&
	  p.x - slack < bbox.maxx && p.y - slack < bbox.maxy);
}

function find_hit_lines(p, candidate_features, arcs, slack) {
  // d.save();
  // d.translate(camera.x, camera.y);
  // d.scale(camera.scale(), -camera.scale());
  // d.fillStyle = "black";
  // d.fillRect(p.x, p.y, 10 / camera.scale(), 10 / camera.scale());
  var segment_targets = [];
  for (var i = 0; i < candidate_features.length; i++) {
    var feat = candidate_features[i];
    var farcs = feat.arcs;
    for (var j = 0; j < farcs.length; j++) {
      var arc = arcs[farcs[j]];
      var bbox = arc.properties.bbox;
      if (!bbox_test_with_slack(p, bbox, slack))
	continue;
      var apts = arc.points;
      for (var k = 0; k < apts.length - 1; k++) {
	// d.beginPath();
	var r = apts[k];
	var s = apts[k+1];
	// project p onto r --- s;

	// z = r * (1-t) + s * t;
	// minimize (z - p)^2 = (zx - px)^2 + (zy - py)^2
	// 2 (rx (1-t) + sx t - px) (sx - rx) +
	// 2 (ry (1-t) + sy t - py) (sy - ry) +
	// = 0
	// t = (p - r) * (s - r) / (s - r)^2
	var t = ((p.x - r[0]) * (s[0] - r[0]) + (p.y - r[1]) * (s[1] - r[1])) /
	    ((s[0] - r[0]) * (s[0] - r[0]) + (s[1] - r[1]) * (s[1] - r[1]));
	if (0 < t && t < 1) {
	  // projected point
	  var pp = {x: r[0] * (1-t) + s[0] * t,
		    y: r[1] * (1-t) + s[1] * t};
	  var proj_distance = Math.sqrt((pp.x - p.x) * (pp.x - p.x) + (pp.y - p.y) * (pp.y - p.y));
	  if (proj_distance > slack) {
	    // d.moveTo(p.x, p.y);
	    // d.lineTo(pp.x, pp.y);
	    // d.strokeStyle = "red";
	    // d.lineWidth = 1 / camera.scale();
	    // d.stroke();
	  }
	  else {
	    segment_targets.push({arc:farcs[j], ix: k});
	    // d.moveTo(r[0], r[1]);
	    // d.lineTo(s[0], s[1]);
	    // d.strokeStyle = "blue";
	    // d.lineWidth = 5 / camera.scale();
	    // d.stroke();
	  }
	}
      }
    }
  }
  //  d.restore();
  return segment_targets;
}

module.exports.find_hit_lines = find_hit_lines;
