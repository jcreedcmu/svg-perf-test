module.exports = function(dispatch, rivers) {
  this.dispatch = dispatch;
  this.rivers = rivers;
}

//  d.strokeStyle = "#999";
//  d.strokeStyle = "white";

module.exports.prototype.render = function(d, camera, locus, world_bbox) {
  var rs = this.rivers;

  d.save();
  d.translate(camera.x, camera.y);
  d.scale(camera.scale(), -camera.scale());
  d.lineCap = "round";
  d.lineJoin = "round";
  rs.features.forEach(function(feature) {
    d.beginPath();
    feature.geometry.coordinates.forEach(function(obj) {
      obj.forEach(function(pt, n) {
	if (n == 0)
	  d.moveTo(pt[0], pt[1]);
	else
	  d.lineTo(pt[0], pt[1]);
      });
    });
    d.fillStyle = "#bac7f8";
    d.globalAlpha = 0.2;
    d.fillStyle = "blue";
    d.fill();
  });
  d.restore();
}

module.exports.prototype.model = function() {
  return {};
}
