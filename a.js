// data in a.json generated through
// potrace a.pbm -a 0 -b geojson


g_data = null;
$.ajax('b.json',{success: function(json) {
  count = 0;
  g_data = JSON.parse(json);

  camera = {x: 180, y: 600, scale: 0.2};

  c = $("#c")[0];
  d = c.getContext('2d');
  w = c.width = innerWidth;
  h = c.height = innerHeight;

  render();
}});

$svg = $("#svg");
$s = $("#s");

function render() {

  d.clearRect(0,0,w,h);

  d.save();
  d.translate(camera.x, camera.y);
  d.scale(camera.scale, camera.scale);
  g_data.forEach(function(feature) {
    d.beginPath();
    feature.coords.forEach(function(vert, ix) {
      if (ix == 0)
	d.moveTo(vert[0] ,  - vert[1] );
      else
	d.lineTo(vert[0] ,  - vert[1] );
    });

    d.fillStyle = "rgba(0,0,0,0.1)";
    d.fill();
    d.lineWidth = 0.5 / camera.scale;
    d.stroke();
  });
  d.restore();
  // $s.attr('transform', 'translate(' + camera.x + ', ' + camera.y +
  // 	  ') scale(' + camera.scale + ')');


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
