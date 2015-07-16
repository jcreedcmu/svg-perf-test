// node break.js > b.json

var fs = require("fs");
var g_data = JSON.parse(fs.readFileSync("a.json"));
CHUNK_SIZE = 100;


var features = [];
var out = {type: "FeatureCollection", features: features};
g_data.features.forEach(function(feature) {
  feature.geometry.coordinates.forEach(function(pathc) {
    var chunks = Math.ceil(pathc.length / CHUNK_SIZE);
    for (var i = 0; i < chunks; i++) {
      var feature = {type: "Feature", geometry: {type: "LineString", coordinates: []}};
      features.push(feature);
      for (var j = 0; j < CHUNK_SIZE + 1; j++) {
	var n = i * CHUNK_SIZE + j;
	if (n < pathc.length) {
	  feature.geometry.coordinates.push(pathc[n]);
	}
      }
    }
  });
});

console.log(JSON.stringify(out, null, 2));
