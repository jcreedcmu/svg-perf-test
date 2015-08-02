var LabelLayer = require('./labels');
var CoastlineLayer = require('./coastline');
var ImageLayer = require('./images');
var RoadLayer = require('./roads');

var State = require('./state');
var DEBUG = false;
var DEBUG_PROF = false;
var OFFSET = DEBUG ? 100 : 0;

// data in a.json generated through
// potrace a.pbm -a 0 -b geojson

state = new State();

var assets;
var ld = new Loader();
ld.add(json_file('features'));
ld.add(json_file('arcs'));
ld.add(json_file('labels'));
ld.add(json_file('images'));
ld.add(json_file('roads'));

var init_img = 1176;
ld.add(image(ImageLayer.image_url(init_img), 'overlay'));

ld.done(function(data) {
  count = 0;
  assets = this;
  coastline_layer = new CoastlineLayer(assets.src.features, assets.src.arcs);
  label_layer = new LabelLayer(assets.src.labels);
  image_layer = new ImageLayer(dispatch, init_img, assets.src.images, assets.img.overlay);
  road_layer = new RoadLayer(dispatch, assets.src.roads);
  g_layers = [coastline_layer, label_layer, image_layer, road_layer];

  c = $("#c")[0];
  d = c.getContext('2d');
  w = c.width = innerWidth;
  h = c.height = innerHeight;

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
    var zoom = 1;
    if (e.originalEvent.wheelDelta < 0) {
      zoom = -1;
    }

    state.zoom(x, y, zoom);
    render();
  }
});

$(c).on('mousedown', function(e) {
  var camera = state.camera();
  var th = $(this);
  var x = e.pageX;
  var y = e.pageY;
  var worldp = inv_xform(camera,x, y);

  // check for interactions with onscreen elements
  // if (label_layer.handle_mouse(camera, worldp))
  //   return;

  // here we are dragging the map
  var dragged = false;

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
  else {
    $(document).on('mousemove.drag', function(e) {
      dragged = true;
      state.set_cam(camera.x + e.pageX - x, camera.y + e.pageY - y);
      maybe_render();
    });
    $(document).on('mouseup.drag', function(e) {
      $(document).off('.drag');
      if (!dragged) {
	console.log(worldp);
	road_layer.add(worldp);
	//state.set_locus(worldp);
      }
      render();
    });
  }
});
$(document).on('keypress', function(e) {
  if (e.charCode == 9 + 96) { // i
    label_layer.add_label(state, prompt("name"));
    render();
  }
  if (e.charCode == 44) { // <
    image_layer.prev();
  }
  if (e.charCode == 46) { // >
    image_layer.next();
  }
  //  console.log(e.charCode);
});

// function report() {
//   g_imageStates[g_curImgName] = clone(g_imageState);
//   localStorage.allStates = JSON.stringify(g_imageStates);
//   // {pos: [g_imageState.x, g_imageState.y], scale: g_imageState.scale};
//   console.log(JSON.stringify(g_imageStates));
// }
