// data in a.json generated through
// potrace a.pbm -a 0 -b geojson
var t = Date.now();

function svg(tag) {
  return $(document.createElementNS('http://www.w3.org/2000/svg', tag));
}

function CompoundPath() {
  this.path = "";
}

CompoundPath.prototype.moveTo = function(x, y) {
  this.path += "M" + x + " " + y;
}

CompoundPath.prototype.lineTo = function(x, y) {
  this.path += "L" + x + " " + y;
}

CompoundPath.prototype.closePath = function() {
  this.path += "z";
}

CompoundPath.prototype.svg = function() {
  var path = svg('path');
  path.attr({d: this.path});
  return path;
}


var scale = 4;
var yoff = 550;


$.ajax('a.json',{success: function(json) {
  var data = JSON.parse(json);

  data.features.forEach(function(feature) {
    var path = new CompoundPath();

//    path.fillColor = 'black';

    feature.geometry.coordinates.forEach(function(pathc) {




      pathc.forEach(function(vert, ix) {
	if (ix == 0)
	  path.moveTo(vert[0] ,  - vert[1] );
	else
	  if (ix % 10 == 0)
	    path.lineTo(vert[0] ,  - vert[1] );

      });
      path.closePath(false);
    });

    var psvg = path.svg();
    psvg.attr({stroke: "#467", fill: "white"});
    psvg.appendTo($("#s"));

  });

  camera = {x: 180, y: 600, scale: 0.2};
  reset_camera();
  console.log(Date.now() - t);
}});

$svg = $("#svg");
$s = $("#s");

function reset_camera() {
  $s.attr('stroke-width', 1/camera.scale);
  $s.attr('transform', 'translate(' + camera.x + ', ' + camera.y +
	  ') scale(' + camera.scale + ')');
}

$svg.on('mousewheel', function(e) {
  var x = e.pageX;
  var y = e.pageY;
  var zoom = 2;
  if (e.originalEvent.wheelDelta < 0) {
    zoom = 1/zoom;
  }
  camera.x = zoom * (camera.x - x) + x;
  camera.y = zoom * (camera.y - y) + y;
  camera.scale *= zoom;
  reset_camera();
});
$svg.on('mousedown', function(e) {
  var th = $(this);
  var x = e.pageX;
  var y = e.pageY;
  var membasex = camera.x;
  var membasey = camera.y;
  $(document).on('mousemove.drag', function(e) {
    var t = Date.now();

    camera.x = membasex + e.pageX - x;
    camera.y = membasey + e.pageY - y;
    reset_camera();


  });
  $(document).on('mouseup.drag', function(e) {
    $(document).off('.drag');
  });
});
