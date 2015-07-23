var label_layer = require('./labels');
var State = require('./state');
var DEBUG = false;
var OFFSET = DEBUG ? 100 : 0;

// data in a.json generated through
// potrace a.pbm -a 0 -b geojson

state = new State();
var g_data = null;
var assets;
var ld = new Loader();
ld.add(json_file('b'));
g_curImgName = 1184;
function image_url() {
  return 'file:///home/jcreed/art/whatever/' + g_curImgName + '.png';
}
ld.add(image(image_url(), 'overlay'));
ld.done(function(data) {
  count = 0;
  assets = this;
  g_data = assets.src.b;
  g_coast_rt = new RTree(10);

  _.each(g_data.objects, function(object, k) {
    var bb = object.properties.bbox;
    g_coast_rt.insert({x:bb.minx, y:bb.miny, w:bb.maxx - bb.minx, h:bb.maxy - bb.miny},
		      object);
  });
//  g_coast_rt.insert

  c = $("#c")[0];
  d = c.getContext('2d');
  w = c.width = innerWidth;
  h = c.height = innerHeight;

  var t;
  if (DEBUG) {
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

g_allStates = (localStorage.allStates != null) ? JSON.parse(localStorage.allStates) :
  {"1119":{"scale":4096,"x":-0.546875,"y":3216.171875},
   "1120":{"scale":8192,"x":-0.546875,"y":3216.171875},
   "1121":{"scale":2048,"x":1951.015625,"y":1262.421875},
   "1122":{"scale":4096,"x":1986.015625,"y":1242.421875},
   "1123":{"scale":1024,"x":2721.953125,"y":482.109375},
   "1124":{"scale":64,"x":2829.296875,"y":372.734375},
   "1128":{"scale":4096,"x":-0.390625,"y":3217.734375},
   "1151":{"scale":1024,"x":2495.625,"y":855.625},
   "1154":{"scale":2048,"x":0,"y":3215},
   "1155":{"scale":2048,"x":0,"y":3215},
   "1156":{"scale":2048,"x":0,"y":3215},
   "1160":{"scale":2048,"x":2453.75,"y":798.75},
   "1161":{"scale":2048,"x":2453.75,"y":798.75},
   "1163":{"scale":1024,"x":2495,"y":806.25},
   "1164":{"scale":512,"x":2495,"y":806.25},
   "1166":{"scale":1024,"x":2495,"y":806.25},
   "1167":{"scale":1024,"x":2495,"y":806.25},
   "1170":{"scale":2048,"x":-0.9375,"y":3216.25},
   "1171":{"scale":8192,"x":-0.9375,"y":3216.25},
   "1173":{"scale":2048,"x":-0.9375,"y":3216.25},
   "1174":{"scale":2048,"x":-0.9375,"y":3216.25},
   "1176":{"scale":2048,"x":87.8125,"y":2663.75},
   "1177":{"scale":2048,"x":-1.25,"y":3215.9375},
   "1179":{"scale":1024,"x":756.25,"y":653.4375},
   "1180":{"scale":2048,"x":-0.3125,"y":3216.40625},
   "1181":{"scale":64,"x":742.03125,"y":2393.984375},
   "1182":{"scale":8,"x":827.67578125,"y":2382.91015625},
   "1184":{"scale":16,"x":1721.640625,"y":391.796875},
   "1194":{"scale":1024,"x":587.36328125,"y":3182.91015625},
   "1195":{"scale":128,"x":1166.66015625,"y":3071.11328125},
   "1196":{"scale":512,"x":3301.97265625,"y":1350.64453125},
   "1197":{"scale":1024,"x":51.34765625,"y":1963.76953125},
   "1198":{"scale":1024,"x":380.17578125,"y":2540.09765625},
   "1199":{"scale":1024,"x":2044.55078125,"y":3215.72265625},
   "1200":{"scale":1024,"x":0.25390625,"y":3215.80078125},
   "1201":{"scale":1024,"x":0.25390625,"y":3215.80078125},
   "1202":{"scale":1024,"x":-153.33984375,"y":3237.98828125},
   "1203":{"scale":512,"x":3377.28515625,"y":437.98828125},
   "1204":{"scale":512,"x":376.03515625,"y":1594.08203125},
   "1205":{"scale":128,"x":909.31640625,"y":1391.26953125},
   "1207":{"scale":4096,"x":-0.68359375,"y":3216.26953125}};
g_imageState = clone(g_allStates[g_curImgName]);


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

  d.strokeStyle = "black";
  d.lineJoin = "round";

  var tl = inv_xform(camera, OFFSET,OFFSET);
  var br = inv_xform(camera,w-OFFSET,h-OFFSET);
  var world_bbox = [tl.x, br.y, br.x, tl.y];

  d.save();
  d.translate(camera.x, camera.y);
  d.scale(camera.scale(), -camera.scale());
  _.each(g_coast_rt.bbox(tl.x, br.y, br.x, tl.y), function(object, k) {
    var arc_id_lists = object.arcs;
    var arcs = g_data.arcs;

    d.beginPath();
    arc_id_lists.forEach(function(arc_id_list) {
      var n = 0;
      arc_id_list.forEach(function(arc_id, arc_id_ix) {
	var this_arc = arcs[arc_id];
	var arc_bbox = g_data.arc_bboxes[arc_id];
	d.lineWidth = 0.9 / camera.scale();
	rect_intersect = tl.x < arc_bbox.maxx && br.x > arc_bbox.minx && tl.y > arc_bbox.miny && br.y < arc_bbox.maxy;

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

  d.save();
  d.translate(camera.x, camera.y);
  d.scale(camera.scale(), camera.scale());


  d.save();
  d.globalAlpha = 0.5;
  var ovr = assets.img.overlay;
  d.drawImage(ovr, 0, 0, ovr.width,
	      ovr.height, g_imageState.x, -g_imageState.y + ovr.height  * g_imageState.scale / 1024,
	      ovr.width * g_imageState.scale / 1024,
	      -ovr.height * g_imageState.scale / 1024);
  d.restore();
  d.restore();

  label_layer.render(d, camera, state.state.get('locus'), world_bbox);


  // $s.attr('transform', 'translate(' + camera.x + ', ' + camera.y +
  // 	  ') scale(' + camera.scale + ')');

  //  console.log(Date.now() - t);
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
	state.set_locus(worldp);
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
  if (e.charCode == 18 + 96) { // r
    report();
  }
  if (e.charCode == 44) { // <
    g_curImgName--;
    reload_img();
  }
  if (e.charCode == 46) { // >
    g_curImgName++;
    reload_img();
  }
  //  console.log(e.charCode);
});

function report() {
  g_allStates[g_curImgName] = clone(g_imageState);
  localStorage.allStates = JSON.stringify(g_allStates);
  // {pos: [g_imageState.x, g_imageState.y], scale: g_imageState.scale};
  console.log(JSON.stringify(g_allStates));
}

function reload_img() {
  assets.img.overlay.src = image_url();
  assets.img.overlay.onload = function() {
    var new_state = g_allStates[g_curImgName];
    if (new_state != null) {
      g_imageState = clone(new_state);
    }
    render();
  }
}
