var LabelLayer = require('./labels');
var CoastlineLayer = require('./coastline');
var ImageLayer = require('./images');

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

var init_img = 1201;
ld.add(image(ImageLayer.image_url(init_img), 'overlay'));

var g_highways = [{"x":490.15625,"y":1599.84375},
		  {"x": 298.90625, "y": 1457.96875}];

ld.done(function(data) {
  count = 0;
  assets = this;
  coastline_layer = new CoastlineLayer(assets.src.features, assets.src.arcs);
  label_layer = new LabelLayer(assets.src.labels);
  g_imageStates = assets.src.images;
  image_layer = new ImageLayer(dispatch, init_img, g_imageStates, assets.img.overlay);

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


  coastline_layer.render(d, camera, state.state.get('locus'), world_bbox);
  image_layer.render(d, camera, state.state.get('locus'), world_bbox);

  // roads
  d.save();
  d.translate(camera.x, camera.y);
  d.scale(camera.scale(), -camera.scale());

  d.lineCap = "round";
  d.lineJoin = "round";
  d.beginPath();
  for (var i = 0; i < g_highways.length; i++) {
    var a = g_highways[i];
    if (i == 0)
      d.moveTo(a.x, a.y);
    else
      d.lineTo(a.x, a.y);
  }
  d.lineWidth = 4.5 / camera.scale();
  d.strokeStyle = "#d82";
  d.strokeStyle = "#999";
  d.stroke();


  d.beginPath();
  for (var i = 0; i < g_highways.length; i++) {
    var a = g_highways[i];
    if (i == 0)
      d.moveTo(a.x, a.y);
    else
      d.lineTo(a.x, a.y);
  }
  d.lineWidth = 3  / camera.scale();
  d.strokeStyle = "#ed4";
  d.strokeStyle = "white";
  d.stroke();
  d.restore();


  label_layer.render(d, camera, state.state.get('locus'), world_bbox);

}

$(c).on('mousewheel', function(e) {
  if (e.ctrlKey) {
    if (e.originalEvent.wheelDelta < 0) {
      g_imageState.scale /= 2;
    }
    else {
      g_imageState.scale *= 2;
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
    var membasex = g_imageState.x;
    var membasey = g_imageState.y;
    $(document).on('mousemove.drag', function(e) {
      g_imageState.x = membasex + (e.pageX - x) / camera.scale();
      g_imageState.y = membasey - (e.pageY - y) / camera.scale();
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
	g_highways.push(worldp);
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

function report() {
  g_imageStates[g_curImgName] = clone(g_imageState);
  localStorage.allStates = JSON.stringify(g_imageStates);
  // {pos: [g_imageState.x, g_imageState.y], scale: g_imageState.scale};
  console.log(JSON.stringify(g_imageStates));
}
