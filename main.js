var LabelLayer = require('./labels');
var CoastlineLayer = require('./coastline');
var ImageLayer = require('./images');
var RoadLayer = require('./roads');

var State = require('./state');
var key = require('./key');

var DEBUG = false;
var DEBUG_PROF = false;
var OFFSET = DEBUG ? 100 : 0;
var VERTEX_SENSITIVITY = 5;

// data in a.json generated through
// potrace a.pbm -a 0 -b geojson

g_render_extra = null;
g_mode = "Pan";
state = new State();

var assets;
var ld = new Loader();
ld.add(json_file('geo'));

var init_img = 1176;
// ld.add(image(ImageLayer.image_url(init_img), 'overlay'));

ld.done(function(data) {
  count = 0;
  assets = this;
  var geo = assets.src.geo;
  coastline_layer = new CoastlineLayer(geo.features, geo.arcs);
  label_layer = new LabelLayer(geo.labels);
//  image_layer = new ImageLayer(dispatch, init_img, geo.images, assets.img.overlay);
  road_layer = new RoadLayer(dispatch, geo.roads);
  g_layers = [coastline_layer, road_layer, label_layer];

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
      pts.forEach(function(index) {
	var pt = coastline_layer.arcs[index[0]].points[index[1]];
	d.fillStyle = "white";
	d.fillRect(pt[0]-rad,pt[1]-rad,rad * 2,rad * 2);
	d.lineWidth = 1 / camera.scale();
	d.strokeStyle = "black";
	d.strokeRect(pt[0]-rad,pt[1]-rad,rad * 2,rad * 2);
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
  var txt = g_lastz;
  d.strokeText(txt, 20, 20);
  d.fillText(txt, 20,  20);


  // used for ephemeral stuff on top, like point-dragging
  if (g_render_extra) {
    g_render_extra(camera, d);
  }


  d.restore();

}

function render_scale(camera, d) {
  d.save();
  d.fillStyle = "black";
  d.font = "10px sans-serif";

  d.translate(Math.floor(w / 2) + 0.5,0.5);
  function label(px_dist) {
    var raw = (px_dist / camera.scale());
    var str = "0";
    if (raw > 0) {
      str =  (raw > 1000) ? Math.floor(raw / 100) / 10 + "km" : Math.floor(raw) + "m";
    }
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
  // if (e.ctrlKey) {
  //   if (e.originalEvent.wheelDelta < 0) {
  //     image_layer.scale(1/2);
  //   }
  //   else {
  //     image_layer.scale(2);
  //   }
  //   render();
  //   e.preventDefault();
  // }
  // else {
  var x = e.pageX;
  var y = e.pageY;
  var zoom = e.originalEvent.wheelDelta / 120;
  e.preventDefault();
  state.zoom(x, y, zoom);
  render();
 // }
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

    // if (e.ctrlKey) {
    //   var membase = image_layer.get_pos();
    //   $(document).on('mousemove.drag', function(e) {
    //     image_layer.set_pos({x: membase.x + (e.pageX - x) / camera.scale(),
    //     		     y: membase.y - (e.pageY - y) / camera.scale()});
    //     maybe_render();
    //   });
    //   $(document).on('mouseup.drag', function(e) {
    //     $(document).off('.drag');
    //     render();
    //   });

    // }
    //    else
    begin_pan(x, y, camera);
  }
  else if (g_mode == "Move") {
    var camera = state.camera();
    var x = e.pageX;
    var y = e.pageY;
    var worldp = inv_xform(camera,x, y);
    var dragp = clone(worldp);
    var rad = VERTEX_SENSITIVITY / camera.scale();
    var bbox = [worldp.x - rad, worldp.y - rad, worldp.x + rad, worldp.y + rad];
    var targets = coastline_layer.targets(bbox);

    if (targets.length >= 1) {

      var neighbors = [];

      targets.forEach(function(target) {
	var arc_points = coastline_layer.arcs[target[0]].points;
	if (target[1] > 0) neighbors.push(arc_points[target[1] - 1]);
	if (target[1] < arc_points.length - 1) neighbors.push(arc_points[target[1] + 1]);});

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
	targets.forEach(function(target) {
	  coastline_layer.replace_vert_in_arc(target, dragp);
	});
	render();
      });
    }
    else
      begin_pan(x, y, camera);
  }
});

g_lastz = null;

$(c).on('mousemove', function(e) {
  var camera = state.camera();
  if (camera.zoom >= 4) {
    var x = e.pageX;
    var y = e.pageY;
    var worldp = inv_xform(camera,x, y);
    var rad = VERTEX_SENSITIVITY / camera.scale();
    var bbox = [worldp.x - rad, worldp.y - rad, worldp.x + rad, worldp.y + rad];
    var z = JSON.stringify(coastline_layer.targets(bbox));
    if (z != g_lastz) {
      g_lastz = z;
      render();
    }
  }
});

$(document).on('keydown', function(e) {
  var k = key(e);
  if (k == "i") {
    label_layer.add_label(state, prompt("name"));
    render();
  }
  // if (k == ",") {
  //   image_layer.prev();
  // }
  // if (k == ".") {
  //   image_layer.next();
  // }
  if (k == "m") {
    g_mode = "Move";
    render();
  }
  if (k == "p") {
    g_mode = "Pan";
    render();
  }

  //  console.log(e.charCode);
});

// function report() {
//   g_imageStates[g_curImgName] = clone(g_imageState);
//   localStorage.allStates = JSON.stringify(g_imageStates);
//   // {pos: [g_imageState.x, g_imageState.y], scale: g_imageState.scale};
//   console.log(JSON.stringify(g_imageStates));
// }
