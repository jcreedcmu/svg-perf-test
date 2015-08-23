module.exports = function(dispatch, sketches) {
  this.dispatch = dispatch;
  this.sketches = sketches || [];
}

//  d.strokeStyle = "#999";
//  d.strokeStyle = "white";

module.exports.prototype.render = function(d, camera, locus, world_bbox) {
  var ms = this.sketches;

  d.save();
  d.translate(camera.x, camera.y);
  d.scale(camera.scale(), -camera.scale());
  d.lineCap = "round";
  d.lineJoin = "round";
  ms.forEach(function(feature) {
    d.beginPath();
    feature.forEach(function(pt, n) {
      if (n == 0)
	d.moveTo(pt[0], pt[1]);
      else
	d.lineTo(pt[0], pt[1]);
    });

    d.lineWidth = 1.1 / camera.scale();
    d.strokeStyle = "black";
    d.stroke();
    d.fillStyle = "black";

  });
  d.restore();
}

module.exports.prototype.add = function(path) {
  this.sketches.push(path);
}

module.exports.prototype.model = function() {
  return {sketches: this.sketches.map(function(sketch) {
    return sketch.map(function(pt) { return [pt[0], pt[1]]; });
  })};
}
