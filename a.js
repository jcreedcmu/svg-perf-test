var label_layer = require('./labels');
var State = require('./state');
var DEBUG = false;
var DEBUG_PROF = false;
var OFFSET = DEBUG ? 100 : 0;

// data in a.json generated through
// potrace a.pbm -a 0 -b geojson

state = new State();
var g_data = null;
var assets;
var ld = new Loader();
ld.add(json_file('features'));
ld.add(json_file('arcs'));
ld.add(json_file('labels'));
ld.add(json_file('images'));

function image_url() {
  return 'file:///home/jcreed/art/whatever/' + g_curImgName + '.png';
}
g_curImgName = 1201;
ld.add(image(image_url(), 'overlay'));

var g_highways = [{"x":490.15625,"y":1599.84375},
		  {"x": 298.90625, "y": 1457.96875}];

ld.done(function(data) {
  count = 0;
  assets = this;
  label_layer.init(assets.src.labels);
  g_imageStates = assets.src.images;
  g_imageState = clone(g_imageStates[g_curImgName]);
  g_data = assets.src.features;
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
    var arcs = assets.src.arcs;

    d.beginPath();
    arc_id_lists.forEach(function(arc_id_list) {
      var n = 0;
      arc_id_list.forEach(function(arc_id, arc_id_ix) {
	var this_arc = arcs[arc_id].points;
	var arc_bbox = arcs[arc_id].properties.bbox;
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
  if (ovr != null) {
    d.drawImage(ovr, 0, 0, ovr.width,
  		ovr.height, g_imageState.x, -g_imageState.y + ovr.height  * g_imageState.scale / 1024,
  		ovr.width * g_imageState.scale / 1024,
  		-ovr.height * g_imageState.scale / 1024);
  }
  d.restore();

  d.restore();


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
  g_imageStates[g_curImgName] = clone(g_imageState);
  localStorage.allStates = JSON.stringify(g_imageStates);
  // {pos: [g_imageState.x, g_imageState.y], scale: g_imageState.scale};
  console.log(JSON.stringify(g_imageStates));
}

function reload_img() {
  assets.img.overlay.src = image_url();
  assets.img.overlay.onload = function() {
    var new_state = g_imageStates[g_curImgName];
    if (new_state != null) {
      g_imageState = clone(new_state);
    }
    render();
  }
}
