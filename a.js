// data in a.json generated through
// potrace a.pbm -a 0 -b geojson


g_data = null;
$.ajax('b.json',{success: function(json) {
  count = 0;
  g_data = JSON.parse(json);
  rt = new RTree(10);
  rt.geoJSON(JSON.parse(json));

  camera = {x: 180, y: 600, scale: 0.2};

  c = $("#c")[0];
  d = c.getContext('2d');
  w = c.width = innerWidth;
  h = c.height = innerHeight;

  render();
}});

function inv_xform(xpix, ypix) {
  return {x:(xpix-camera.x) / camera.scale, y:(ypix - camera.y) / -camera.scale};
}

function render() {
  var t = Date.now();
  d.clearRect(0,0,w,h);
  d.strokeStyle = "red";
  var OFFSET = 50;

  d.strokeRect(OFFSET + 0.5,OFFSET + 0.5,w-2*OFFSET,h-2*OFFSET);
  d.strokeStyle = "black";

  var ip1 = inv_xform(OFFSET, OFFSET);
  var ip2 = inv_xform(w-OFFSET, h-OFFSET);
  var items = rt.bbox(ip1.x, ip2.y, ip2.x, ip1.y);

    // var items = rt.bbox((OFFSET-camera.x) / camera.scale, ((h-OFFSET) - camera.y) / -camera.scale,
    // 		      ((w-OFFSET) - camera.x) / camera.scale, (OFFSET-camera.y) / -camera.scale  );
//  console.log("items ", items.length);

  d.save();
  d.translate(camera.x, camera.y);
  d.scale(camera.scale, camera.scale);


  items.forEach(function(feature) {
    d.beginPath();
     feature.geometry.coordinates.forEach(function(vert, ix) {
      if (ix == 0)
    	d.moveTo(vert[0] ,  - vert[1] );
      else
    	d.lineTo(vert[0] ,  - vert[1] );
    });

    // d.fillStyle = "rgba(0,0,0,0.1)";
    // d.fill();
    d.lineWidth = 0.5 / camera.scale;
    d.stroke();
  });

  d.beginPath();

  var origin = {x:-camera.x/camera.scale,y:-camera.y/camera.scale};
  items.forEach(function(feature) {
    var cs = feature.geometry.coordinates;

    cs.forEach(function(vert, ix) {
      if (ix == 0)
	d.moveTo(origin.x, origin.y);

      d.lineTo(vert[0] ,  - vert[1] );

      if (ix == cs.length-1)
	d.lineTo(origin.x, origin.y);
    });


  });
     d.fillStyle = "rgba(255,128,64,0.35)";
     d.fill();


  d.restore();


  // $s.attr('transform', 'translate(' + camera.x + ', ' + camera.y +
  // 	  ') scale(' + camera.scale + ')');

//  console.log(Date.now() - t);
}

$(c).on('mousewheel', function(e) {
  var x = e.pageX;
  var y = e.pageY;
  var zoom = 2;
  if (e.originalEvent.wheelDelta < 0) {
    zoom = 1/zoom;
  }
  camera.x = zoom * (camera.x - x) + x;
  camera.y = zoom * (camera.y - y) + y;
  camera.scale *= zoom;
  render();
});
$(c).on('mousedown', function(e) {
  var th = $(this);
  var x = e.pageX;
  var y = e.pageY;
  var membasex = camera.x;
  var membasey = camera.y;
  $(document).on('mousemove.drag', function(e) {
    var t = Date.now();

    camera.x = membasex + e.pageX - x;
    camera.y = membasey + e.pageY - y;
    render();


  });
  $(document).on('mouseup.drag', function(e) {
    $(document).off('.drag');
  });
});
