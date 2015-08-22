var LabelLayer = require('./labels');
var CoastlineLayer = require('./coastline');
var ImageLayer = require('./images');
var RoadLayer = require('./roads');
var RiverLayer = require('./rivers');
var MountainLayer = require('./mountains');

var State = require('./state');
var key = require('./key');

var DEBUG = false;
var DEBUG_PROF = false;
var OFFSET = DEBUG ? 100 : 0;
var VERTEX_SENSITIVITY = 10;

// data in a.json generated through
// potrace a.pbm -a 0 -b geojson

g_render_extra = null;
g_mode = "Pan";
state = new State();

var assets;
var ld = new Loader();
ld.add(json_file('geo'));
ld.add(json_file('rivers'));
ld.add(json_file('mountains'));

// var init_img = 1184;
// ld.add(image(ImageLayer.image_url(1176), 'overlay'));

ld.done(function(data) {
  count = 0;
  assets = this;
  var geo = assets.src.geo;
  coastline_layer = new CoastlineLayer(geo.features, geo.arcs);
  label_layer = new LabelLayer(geo.labels);
  image_layer = new ImageLayer(dispatch, 0, geo.images, assets.img.overlay);
  road_layer = new RoadLayer(dispatch, geo.roads);
  river_layer = new RiverLayer(dispatch, assets.src.rivers);
  mountain_layer = new MountainLayer(dispatch, assets.src.mountains);
  g_layers = [coastline_layer, road_layer,
	      river_layer, mountain_layer,
	      label_layer, image_layer];

  c = $("#c")[0];
  d = c.getContext('2d');
  c.width = (w = innerWidth) * devicePixelRatio;
  c.height = (h = innerHeight) * devicePixelRatio;
  c.style.width = innerWidth + "px";
  c.style.height = innerHeight + "px";

  var t;
  if (DEBUG && DEBUG_PROF) {
    console.profile("rendering");
    console.time("whatev");
    var ITER = 1000;
    for (var i = 0; i < ITER; i++) {
      render();
    }
    // d.getImageData(0,0,1,1);
    console.timeEnd("whatev");
    console.profileEnd();
  }
  else {
    render();
  }
});

function inv_xform(camera, xpix, ypix) {
  return {x:(xpix-camera.x) / camera.scale(),
	  y:(ypix - camera.y) / -camera.scale()};
}

function xform(camera, xworld, yworld) {
  return {x: camera.x + xworld * camera.scale(), y : camera.y - yworld * camera.scale()};
}

lastTime = 0;
interval = null;
function maybe_render() {
  if (Date.now() - lastTime < 20) {
    if (interval != null) {
      clearInterval(interval);
      interval = null;
    }
    interval = setInterval(render, 40);
    return;
  }
  render();
}

window.render = render;
function dispatch() {
  render();
}

function render() {
  d.save();
  d.scale(devicePixelRatio, devicePixelRatio);
  lastTime = Date.now();
  if (interval != null) {
    clearInterval(interval);
    interval = null;
  }
  var camera = state.camera();
  var t = Date.now();
  d.fillStyle = "#bac7f8";
  d.fillRect(0,0,w,h);
  d.strokeStyle = "gray";

  if (DEBUG) {
    d.strokeRect(OFFSET + 0.5,OFFSET + 0.5,w-2*OFFSET,h-2*OFFSET);
  }

  var tl = inv_xform(camera, OFFSET,OFFSET);
  var br = inv_xform(camera,w-OFFSET,h-OFFSET);
  var world_bbox = [tl.x, br.y, br.x, tl.y];

  g_layers.forEach(function(layer) {
    layer.render(d, camera, state.state.get('locus'), world_bbox);
  });


  // vertex display
  if (camera.zoom >= 4 && g_lastz != null) {
    var pts = JSON.parse(g_lastz);
    if (pts.length != 0) {
      var rad = 3 / camera.scale();
      d.save();
      d.translate(camera.x, camera.y);
      d.scale(camera.scale(), -camera.scale());
      pts.forEach(function(bundle) {
	if (bundle[0] == "coastline") {
	  var pt = bundle[1].point;
	  d.fillStyle = "white";
	  d.fillRect(pt[0]-rad,pt[1]-rad,rad * 2,rad * 2);
	  d.lineWidth = 1 / camera.scale();
	  d.strokeStyle = "black";
	  d.strokeRect(pt[0]-rad,pt[1]-rad,rad * 2,rad * 2);
	}
	else if (bundle[0] == "label") {
	  var pt = bundle[1].p;
	  d.beginPath();
	  d.fillStyle = "white";
	  d.globalAlpha = 0.5;
	  d.arc(pt.x, pt.y, 20 / camera.scale(), 0, Math.PI * 2);
	  d.fill();
	}
      });
      d.restore();
    }
  }

  // scale
  render_scale(camera, d);

  // mode
  d.fillStyle = "black";
  d.strokeStyle = "white";
  d.font = "bold 12px sans-serif";
  d.lineWidth = 2;
  d.strokeText(g_mode, 20, h - 20);
  d.fillText(g_mode, 20, h - 20);


  // debugging


  d.fillStyle = "black";
  d.strokeStyle = "white";
  d.font = "bold 12px sans-serif";
  d.lineWidth = 2;
  var txt = "Zoom: " + camera.zoom + " (1px = " + 1/camera.scale() + "m) g_lastz: " + g_lastz + " img: " + image_layer.img_states[image_layer.cur_img_ix].name;
  d.strokeText(txt, 20, 20);
  d.fillText(txt, 20,  20);


  // used for ephemeral stuff on top, like point-dragging
  if (g_render_extra) {
    g_render_extra(camera, d);
  }

  d.restore();
}

function meters_to_string(raw) {
   var str = "0";
    if (raw > 0) {
      str =  (raw > 1000) ? Math.floor(raw / 100) / 10 + "km" : Math.floor(raw) + "m";
    }
  return str;
}

function render_scale(camera, d) {
  d.save();
  d.fillStyle = "black";
  d.font = "10px sans-serif";

  d.translate(Math.floor(w / 2) + 0.5,0.5);
  function label(px_dist) {
    var str = meters_to_string(px_dist / camera.scale());
    d.textAlign = "center";
    d.fillText(str, px_dist, h - 12);
  }
  d.lineWidth = 1;
  d.strokeStyle = "rgba(0,0,0,0.1)";
  d.strokeRect(0,h-25-50,50,50);
  d.strokeRect(0,h-25-128,128,128);
  d.beginPath()
  d.strokeStyle = "black";
  d.moveTo(0, h - 30);
  d.lineTo(0, h - 25);
  d.lineTo(50, h - 25);
  d.lineTo(50, h - 30);
  d.moveTo(50, h - 25);
  d.lineTo(128, h - 25);
  d.lineTo(128, h - 30);
  d.stroke();
  label(0);
  label(50);
  label(128);

  d.restore();
}

$(c).on('mousewheel', function(e) {
  if (e.ctrlKey) {
    if (e.originalEvent.wheelDelta < 0) {
      image_layer.scale(1/2);
    }
    else {
      image_layer.scale(2);
    }
    render();
    e.preventDefault();
  }
  else {
    var x = e.pageX;
  var y = e.pageY;
    var zoom = e.originalEvent.wheelDelta / 120;
    e.preventDefault();
    state.zoom(x, y, zoom);
    render();
  }
});

function begin_pan(x, y, camera) {
  $(document).on('mousemove.drag', function(e) {
    state.set_cam(camera.x + e.pageX - x, camera.y + e.pageY - y);
    maybe_render();
  });
  $(document).on('mouseup.drag', function(e) {
    $(document).off('.drag');
    render();
  });
}

$(c).on('mousedown', function(e) {
  if (g_mode == "Pan") {
    var camera = state.camera();
    var th = $(this);
    var x = e.pageX;
    var y = e.pageY;
    var worldp = inv_xform(camera,x, y);

    if (e.ctrlKey) {
      var membase = image_layer.get_pos();
      $(document).on('mousemove.drag', function(e) {
        image_layer.set_pos({x: membase.x + (e.pageX - x) / camera.scale(),
        		     y: membase.y - (e.pageY - y) / camera.scale()});
        maybe_render();
      });
      $(document).on('mouseup.drag', function(e) {
        $(document).off('.drag');
        render();
      });

    }
    else
      begin_pan(x, y, camera);
  }
  else if (g_mode == "Label") {
    var camera = state.camera();
    var x = e.pageX;
    var y = e.pageY;
    var worldp = inv_xform(camera, x, y);
    if (g_lastz != "[]") {
      var z = JSON.parse(g_lastz);
      if (z.length == 1 && z[0][0] == "label") {
	label_layer.make_insert_label_modal(worldp, z[0][1], render);
      }
    }
    else {
      label_layer.make_insert_label_modal(worldp, null, render);
    }
  }
  else if (g_mode == "Move") {
    var camera = state.camera();
    var x = e.pageX;
    var y = e.pageY;
    var worldp = inv_xform(camera,x, y);

    var rad = VERTEX_SENSITIVITY / camera.scale();
    var bbox = [worldp.x - rad, worldp.y - rad, worldp.x + rad, worldp.y + rad];
    var targets = coastline_layer.targets(bbox);

    if (targets.length >= 1) {

      var neighbors = [];

      targets.forEach(function(target) {
	var ix = coastline_layer.get_index(target);
	var arc_points = coastline_layer.arcs[target.arc].points;
	if (ix > 0) neighbors.push(arc_points[ix - 1]);
	if (ix < arc_points.length - 1) neighbors.push(arc_points[ix + 1]);});

      start_drag(worldp, neighbors, function(dragp) {
	targets.forEach(function(target) {
	  coastline_layer.replace_vert_in_arc(target, dragp);
	})});
    }
    else {
      var candidate_features = coastline_layer.arc_targets(bbox);
      var hit_lines = find_hit_lines(worldp, candidate_features);
      if (hit_lines.length == 1) {
	var arc_id = hit_lines[0].arc;
	var ix = hit_lines[0].ix;
	var arc = coastline_layer.arcs[arc_id].points;
	start_drag(worldp, [arc[ix], arc[ix+1]], function(dragp) {
	  coastline_layer.break_segment(hit_lines[0], dragp);
	});
      }
      else
	begin_pan(x, y, camera);
    }
  }
});

function start_drag(startp, neighbors, k) {
  var camera = state.camera();
  var dragp = clone(startp);
  g_render_extra = function(camera, d) {
    d.save();
    d.translate(camera.x, camera.y);
    d.scale(camera.scale(), -camera.scale());
    d.beginPath();
    neighbors.forEach(function(nabe) {
      d.moveTo(nabe[0], nabe[1]);
      d.lineTo(dragp.x, dragp.y);
    });
    d.lineWidth = 1 / camera.scale();
    d.strokeStyle = "#07f";
    d.stroke();
    d.restore();
  }
  $(document).on('mousemove.drag', function(e) {
    var x = e.pageX;
    var y = e.pageY;
    var worldp = inv_xform(camera,x, y);
    dragp.x = worldp.x;
    dragp.y = worldp.y;
    maybe_render();
  });
  $(document).on('mouseup.drag', function(e) {
    g_render_extra = null;
    $(document).off('.drag');
    k(dragp);
    render();
  });
}
g_lastz = null;

$(c).on('mousemove', function(e) {
  var camera = state.camera();
  if (camera.zoom >= 4) {
    var x = e.pageX;
    var y = e.pageY;
    var worldp = inv_xform(camera,x, y);
    var rad = VERTEX_SENSITIVITY / camera.scale();
    var bbox = [worldp.x - rad, worldp.y - rad, worldp.x + rad, worldp.y + rad];
    var targets = [];
    targets = targets.concat(coastline_layer.targets(bbox).map(function(x) { return ["coastline", x] }));
    targets = targets.concat(label_layer.targets(bbox).map(function(x) { return ["label", x] }));
    var z = JSON.stringify(targets);
    if (z != g_lastz) {
      g_lastz = z;
      render();
    }
  }
});

$(document).on('keydown', function(e) {
  if (_.any($(".modal"), function(x) { return $(x).css("display") == "block"; }))
    return;

  var k = key(e);
  // if (k == "i") {
  //   label_layer.add_label(state, prompt("name"));
  //   render();
  // }
  if (k == ",") {
    image_layer.prev();
  }
  if (k == ".") {
    image_layer.next();
  }
  if (k == "m") {
    g_mode = "Move";
    render();
  }
  if (k == "p") {
    g_mode = "Pan";
    render();
  }
  if (k == "l") {
    g_mode = "Label";
    render();
  }
  // if (k == "i") {
  //   g_mode = "Insert";
  //   render();
  // }
  if (k == "e") {
    save();
  }
  if (k == "f") {
    coastline_layer.filter();
    render();
  }

  //  console.log(e.charCode);
});

function save() {
  var geo = {};
  g_layers.forEach(function(layer, n) {
    _.extend(geo, layer.model());
  });
  $.ajax("/export", {method: "POST",  data: JSON.stringify(geo), contentType: "text/plain",  success: function() {
    console.log("success");
  }});
}

// function report() {
//   g_imageStates[g_curImgName] = clone(g_imageState);
//   localStorage.allStates = JSON.stringify(g_imageStates);
//   // {pos: [g_imageState.x, g_imageState.y], scale: g_imageState.scale};
//   console.log(JSON.stringify(g_imageStates));
// }

function find_hit_lines(p, candidate_features) {
  var camera = state.camera();
  var slack = VERTEX_SENSITIVITY / camera.scale();
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
      for (var jj = 0; jj < farcs[j].length; jj++) {
	var arc = coastline_layer.arcs[farcs[j][jj]];
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
	      segment_targets.push({arc:farcs[j][jj], ix: k});
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
  }
  //  d.restore();
  return segment_targets;
}

function bbox_test_with_slack(p, bbox, slack) {
  return (p.x + slack > bbox.minx && p.y + slack > bbox.miny &&
	  p.x - slack < bbox.maxx && p.y - slack < bbox.maxy);
}
