var LabelLayer = require('./labels');
var CoastlineLayer = require('./coastline');
var ImageLayer = require('./images');
var RoadLayer = require('./roads');
var RiverLayer = require('./rivers');
var SketchLayer = require('./sketch');
var simplify = require('./simplify');
var State = require('./state');
var key = require('./key');
var geom = require('./geom');

var DEBUG = false;
var DEBUG_PROF = false;
var OFFSET = DEBUG ? 100 : 0;
var VERTEX_SENSITIVITY = 10;
var FREEHAND_SIMPLIFICATION_FACTOR = 100;

// data in a.json generated through
// potrace a.pbm -a 0 -b geojson

g_selection = null;
g_render_extra = null;
g_mode = "Pan";
state = new State();

var assets;
var ld = new Loader();
ld.add(json_file('geo'));
ld.add(json_file('rivers'));

// var init_img = 1184;
// ld.add(image(ImageLayer.image_url(1176), 'overlay'));

ld.done(function(data) {
  count = 0;
  assets = this;
  var geo = assets.src.geo;
  coastline_layer = new CoastlineLayer(geo.objects);
  label_layer = new LabelLayer(geo.labels);
  image_layer = new ImageLayer(dispatch, 0, geo.images, assets.img.overlay);
  road_layer = new RoadLayer(dispatch, geo.roads);
  river_layer = new RiverLayer(dispatch, assets.src.rivers);
  sketch_layer = new SketchLayer(dispatch, geo.sketches);
  g_layers = [coastline_layer, road_layer,
//	       river_layer,
	      sketch_layer,
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

  if (g_selection) {
    d.save();
    d.translate(camera.x, camera.y);
    d.scale(camera.scale(), -camera.scale());
    if (g_selection.arc) {
      d.lineWidth = 2 / camera.scale();
      d.strokeStyle = "#0ff";
      coastline_layer.draw_selected_arc(d, g_selection.arc);
    }
    d.restore();
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
  var camera = state.camera();
  var x = e.pageX;
  var y = e.pageY;
  var worldp = inv_xform(camera, x, y);
  var slack = VERTEX_SENSITIVITY / camera.scale();
  var bbox = [worldp.x - slack, worldp.y - slack, worldp.x + slack, worldp.y + slack];

  var th = $(this);
  if (g_mode == "Pan") {
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
  else if (g_mode == "Select") {
    var candidate_features = coastline_layer.arc_targets(bbox);
    var hit_lines = geom.find_hit_lines(
      worldp, candidate_features, coastline_layer.arcs, slack
    );
    if (hit_lines.length == 1) {
      g_selection = hit_lines[0];
    }
    else {
      g_selection = null;
    }
    render();
  }
  else if (g_mode == "Label") {
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
      var hit_lines = geom.find_hit_lines(
	worldp, candidate_features, coastline_layer.arcs, slack
      );
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
  else if (g_mode == "Freehand") {
    var startp = [worldp.x, worldp.y];

    var spoint = get_snap();
    if (spoint != null)
      startp = spoint;

    start_freehand(startp, function(path) { sketch_layer.add(path); });
  }
});

function get_snap() {
  var last = JSON.parse(g_lastz);
  // .targets is already making sure that multiple targets returned at
  // this stage are on the same exact point
  if (last.length >= 1 &&
       last[0][0] == "coastline")
    return clone(last[0][1].point);
  else
    return null;
}

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

function start_freehand(startp, k) {
  var camera = state.camera();
  var path = [startp];
  var thresh = FREEHAND_SIMPLIFICATION_FACTOR
      / (camera.scale() * camera.scale());
  g_render_extra = function(camera, d) {
    d.save();
    d.translate(camera.x, camera.y);
    d.scale(camera.scale(), -camera.scale());
    d.beginPath();
    var count = 0;
    path.forEach(function(pt, n) {
      if (n == 0)
	d.moveTo(pt[0], pt[1]);
      else {
	if (n == path.length - 1 ||
	    pt[2] > 1) {
	  count++;
	  d.lineTo(pt[0], pt[1]);
	}
      }
    });
    d.lineWidth = 2 / camera.scale();
    d.strokeStyle = "#07f";
    d.stroke();
    d.restore();
  }
  $(document).on('mousemove.drag', function(e) {
    var x = e.pageX;
    var y = e.pageY;
    var worldp = inv_xform(camera,x, y);
    path.push([worldp.x, worldp.y]);
    simplify.simplify(path);
    maybe_render();
  });
  $(document).on('mouseup.drag', function(e) {

    var spoint = get_snap();
    if (spoint != null) {
      path[path.length-1] = spoint;
      startp = spoint;
    }

    g_render_extra = null;
    $(document).off('.drag');
    k(_.filter(path, function(pt, n) {
      return pt[2] > thresh || n == 0 || n == path.length - 1;
    }));
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
  if (k == "f") {
    g_mode = "Freehand";
    render();
  }
  if (k == "m") {
    g_mode = "Move";
    render();
  }
  if (k == "p") {
    g_mode = "Pan";
    render();
  }
  if (k == "s") {
    g_mode = "Select";
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
  if (k == "S-b") {
    coastline_layer.breakup();
    render();
  }
  if (k == "S-f") {
    coastline_layer.filter();
    render();
  }

//  console.log(e.charCode, k);
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
