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

  paper.setup(document.getElementById("c"));

  //console.log(JSON.stringify(data.features[0].geometry.coordinates));

  data.features.forEach(function(feature) {
    var path = new paper.CompoundPath();


    path.fillColor = 'black';

    feature.geometry.coordinates.forEach(function(pathc) {


      pathc.forEach(function(vert, ix) {
	if (ix == 0)
	  path.moveTo(vert[0] / scale, yoff - vert[1] / scale);
	else
	  path.lineTo(vert[0] / scale, yoff - vert[1] / scale);

      });
      path.closePath(false);
    });
  });
  paper.view.draw();
  console.log(Date.now() - t);

  data.features.forEach(function(feature) {
    var path = new CompoundPath();

//    path.fillColor = 'black';

    feature.geometry.coordinates.forEach(function(pathc) {




      pathc.forEach(function(vert, ix) {
	if (ix == 0)
	  path.moveTo(vert[0] / scale, yoff - vert[1] / scale);
	else
	  path.lineTo(vert[0] / scale, yoff - vert[1] / scale);

      });
      path.closePath(false);
    });

    var psvg = path.svg();
    psvg.attr({fill: "black"});
    psvg.appendTo($("#s"));

  });

  console.log(Date.now() - t);
}});

$svg = $("#s");

var basex = 0;
var basey = 0;
$svg.on('mousedown', function(e) {
  var th = $(this);
  var x = e.pageX;
  var y = e.pageY;
  var membasex = basex;
  var membasey = basey;
  $(document).on('mousemove.drag', function(e) {
    var t = Date.now();

    $svg.attr('transform', 'translate(' + (membasex + e.pageX - x) + ', ' +
     (membasey + e.pageY - y) + ')');

  });
  $(document).on('mouseup.drag', function(e) {
    basex += e.pageX - x;
    basey += e.pageY - y;
    $(document).off('.drag');
  });
});
