var CoastlineLayer = require('./coastline');
var ImageLayer = require('./images');
var RiverLayer = require('./rivers');
var SketchLayer = require('./sketch');
var simplify = require('./simplify');
var State = require('./state');
var key = require('./key');
var geom = require('./geom');
var modal = require('./modal');

var DEBUG = false;
var DEBUG_PROF = false;
var OFFSET = DEBUG ? 100 : 0;
var VERTEX_SENSITIVITY = 10;
var FREEHAND_SIMPLIFICATION_FACTOR = 100;
var PANNING_MARGIN = 200;

// data in a.json generated through
// potrace a.pbm -a 0 -b geojson

g_mouse = {x:0, y:0};
g_selection = null;
g_panning = false;
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
  window.assets = assets;
  var geo = assets.src.geo;
  coastline_layer = new CoastlineLayer(geo.objects, geo.counter);
  image_layer = new ImageLayer(dispatch, 0, geo.images, assets.img.overlay);

  river_layer = new RiverLayer(dispatch, assets.src.rivers);
  sketch_layer = new SketchLayer(dispatch, geo.sketches);
  g_layers = [coastline_layer,
	      river_layer,
	      sketch_layer,
	      image_layer];

  c = $("#c")[0];
  d = c.getContext('2d');
  reset_canvas_size();
  render_origin();

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
window.inv_xform = inv_xform;
window.xform = xform;
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

function render_origin() {
  var or = state.get_origin();
  $("#c").css({top: or.y + "px",
	       left: or.x + "px",
	       position: "fixed",
	      });
}

function reset_canvas_size() {
  var c = $("#c")[0];
  var margin = g_panning ? PANNING_MARGIN : 0;
  // not 100% sure this is right on retina
  state.set_origin(-margin, -margin);
  c.width = (w = innerWidth + 2 * margin) * devicePixelRatio;
  c.height = (h = innerHeight + 2 * margin) * devicePixelRatio;
  c.style.width = (innerWidth + 2 * margin) + "px";
  c.style.height = (innerHeight + 2 * margin) + "px";
}

function get_world_bbox(camera) {
  var tl = inv_xform(camera, OFFSET,OFFSET);
  var br = inv_xform(camera,w-OFFSET,h-OFFSET);
  return [tl.x, br.y, br.x, tl.y];
}

function render() {
//  var t = Date.now();
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

  var world_bbox = get_world_bbox(camera);

  g_layers.forEach(function(layer) {
    layer.render(d, camera, state.state.get('locus'), world_bbox);
  });


  // vertex hover display
  if (camera.zoom >= 1 && g_lastz != null) {
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
	  d.strokeStyle = "#000";
	  d.strokeRect(pt[0]-rad,pt[1]-rad,rad * 2,rad * 2);
	}
	else if (bundle[0] == "label") {
	  var pt = coastline_layer.labels[bundle[1]].pt;
	  d.beginPath();
	  d.fillStyle = "white";
	  d.globalAlpha = 0.5;
	  d.arc(pt[0], pt[1], 20 / camera.scale(), 0, Math.PI * 2);
	  d.fill();
	}
      });
      d.restore();
    }
  }

  if (!g_panning) {
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
  }

  d.restore();
//  console.log(Date.now() - t);
}

function meters_to_string(raw) {
   var str = "0";
    if (raw > 0) {
      str =  (raw > 1000) ? Math.floor(raw / 10) / 100 + "km" : Math.floor(raw) + "m";
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

function start_pan(x, y, camera) {
  var stop_at = start_pan_and_stop(x, y, camera);
  $(document).on('mouseup.drag', function(e) {
    stop_at(e.pageX, e.pageY);
  });
}

// returns stopping function
function start_pan_and_stop(x, y, camera) {
  $("#c").css({cursor: 'move'});
  g_panning = true;
//  state.set_cam(camera.x + PANNING_MARGIN, camera.y + PANNING_MARGIN);
  reset_canvas_size();
  render_origin();
  render();
  var last = {x:x, y:y};
  $(document).on('mousemove.drag', function(e) {
    var org = state.get_origin();
    state.inc_origin(e.pageX - last.x,
		     e.pageY - last.y);

    state.inc_cam(e.pageX - last.x,
		  e.pageY - last.y);

    last.x = e.pageX;
    last.y = e.pageY;

    var stale = false;
    if (org.x > 0) { state.inc_origin(-PANNING_MARGIN, 0); stale = true; }
    if (org.y > 0) { state.inc_origin(0, -PANNING_MARGIN); stale = true; }
    if (org.x < -2*PANNING_MARGIN) { state.inc_origin(PANNING_MARGIN, 0); stale = true; }
    if (org.y < -2*PANNING_MARGIN) { state.inc_origin(0, PANNING_MARGIN); stale = true; }

    // if (g_origin.y > 0) { g_origin.y -= PANNING_MARGIN; stale = true;
    // 			  state.inc_cam(0, PANNING_MARGIN); }

    if (stale) {
      render();
    }
    render_origin();

    //maybe_render();
  });

  return function(offx, offy) {
    $("#c").css({cursor: ''});
    $(document).off('.drag');
    state.set_cam(camera.x + offx - x, camera.y + offy - y);
    g_panning = false;
    reset_canvas_size();
    render_origin();
    render();
  };
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
      start_pan(x, y, camera);
  }
  else if (g_mode == "Measure") {
    start_measure(worldp);
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
      console.log(g_lastz);
      if (z.length == 1 && z[0][0] == "label") {
	modal.make_insert_label_modal(worldp, coastline_layer.labels[z[0][1]], function(obj) {
	  coastline_layer.replace_point_feature(obj);
	  render();
	});
      }
    }
    else {
      modal.make_insert_label_modal(worldp, null, function(obj) {
	coastline_layer.new_point_feature(obj);
	render();
      });
    }
  }
  else if (g_mode == "Move") {
    var targets = coastline_layer.targets(bbox);

    if (targets.length >= 1) {
      var neighbors = coastline_layer.targets_nabes(targets);

      start_drag(worldp, neighbors, function(dragp) {
	coastline_layer.replace_vert(targets, dragp);
      });
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
	start_pan(x, y, camera);
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

function vdist(p1, p2) {
  function sqr(x) { return x * x };
  return Math.sqrt(sqr(p1.x - p2.x) + sqr(p1.y - p2.y));
}

function start_measure(startp) {
  var camera = state.camera();
  var dragp = clone(startp);
  var scale = camera.scale();
  g_render_extra = function(camera, d) {
    d.save();
    d.translate(camera.x, camera.y);
    d.scale(scale, -scale);
    d.beginPath();

    d.moveTo(startp.x, startp.y);
    d.lineTo(dragp.x, dragp.y);

    d.lineWidth = 1 / scale;
    d.strokeStyle = "#07f";
    d.stroke();
    d.restore();

    d.font = "14px sans-serif";
    d.fillStyle = "#07f";
    var dist = meters_to_string(vdist(dragp, startp));
    var width = d.measureText(dist).width;
    d.save();
    d.translate((startp.x + dragp.x)/2 * scale + camera.x,
		(startp.y + dragp.y)/2 * -scale + camera.y);
    d.rotate(-Math.atan2(dragp.y - startp.y, dragp.x - startp.x));

    d.strokeStyle = "#fff";
    d.lineWidth = 2;
    d.strokeText(dist, -width/2, -3);
    d.fillText(dist, -width/2, -3);

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
    render();
  });

}

function start_drag(startp, neighbors, k) {
  var camera = state.camera();
  var dragp = clone(startp);
  var scale = camera.scale();
  g_render_extra = function(camera, d) {
    d.save();
    d.translate(camera.x, camera.y);
    d.scale(scale, -scale);
    d.beginPath();
    if (neighbors.length == 0) {
      d.moveTo(dragp.x, dragp.y - 10/scale);
      d.lineTo(dragp.x, dragp.y + 10/scale);
      d.moveTo(dragp.x - 10/scale, dragp.y);
      d.lineTo(dragp.x + 10/scale, dragp.y);
      d.arc(dragp.x, dragp.y, 10/scale, 0, 2*Math.PI);
    }
    else {
      neighbors.forEach(function(nabe) {
	d.moveTo(nabe[0], nabe[1]);
	d.lineTo(dragp.x, dragp.y);
      });
    }
    d.lineWidth = 1 / scale;
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
    var snaps = JSON.parse(g_lastz);
    if (snaps.length >= 1) {
      dragp = coastline_layer.target_point(snaps[0]);
    }
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
  g_mouse = {x:e.pageX, y:e.pageY};

  if (g_panning)
    return;
  var camera = state.camera();
  if (camera.zoom >= 1) {
    var x = e.pageX;
    var y = e.pageY;
    var worldp = inv_xform(camera,x, y);
    var rad = VERTEX_SENSITIVITY / camera.scale();
    var bbox = [worldp.x - rad, worldp.y - rad, worldp.x + rad, worldp.y + rad];
    var targets = [];
    targets = coastline_layer.targets(bbox);
    var z = JSON.stringify(targets);
    if (z != g_lastz) {
      g_lastz = z;
      render();
    }
  }
});

function main_key_handler(e) {
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
  if (k == "<space>") {
//    var old_mode = g_mode;
//    g_mode = "Pan";
    $(document).off('keydown');
    var stop_at = start_pan_and_stop(g_mouse.x, g_mouse.y, state.camera());
    $(document).on('keyup.holdspace', function(e) {
      if (key(e) == "<space>") {
	stop_at(g_mouse.x, g_mouse.y);
	$(document).off('.holdspace');
	$(document).on('keydown', main_key_handler);
      }
    });

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
  if (k == "e") {
    g_mode = "Measure";
    render();
  }

  // if (k == "i") {
  //   g_mode = "Insert";
  //   render();
  // }
  if (k == "v") {
    save();
  }
  if (k == "q") {
    coastline_layer.make_insert_feature_modal(sketch_layer.pop(), null, dispatch);
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
}

$(document).on('keydown', main_key_handler);

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
