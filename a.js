// data in a.json generated through
// potrace a.pbm -a 0 -b geojson
var t = Date.now();
$.ajax('a.json',{success: function(json) {
  var data = JSON.parse(json);



  data.features.forEach(function(feature) {
    feature.geometry.coordinates[0];
  });

  paper.setup(document.getElementById("c"));

  //console.log(JSON.stringify(data.features[0].geometry.coordinates));

  data.features.forEach(function(feature) {
    var path = new paper.CompoundPath();


    path.fillColor = 'black';

    feature.geometry.coordinates.forEach(function(pathc) {

      var scale = 2;
      var yoff = 1150;



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
}});
