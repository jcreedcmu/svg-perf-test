module.exports = function(dispatch, roads) {
  this.dispatch = dispatch;
  this.roads = roads;
}

//  d.strokeStyle = "#999";
//  d.strokeStyle = "white";

module.exports.prototype.render = function(d, camera, locus, world_bbox) {
  var rds = this.roads;
  function draw_all_roads(width, color) {
    d.beginPath();
    for (var i = 0; i < rds.length; i++) {
      var a = rds[i];
      if (i == 0)
	d.moveTo(a.x, a.y);
      else
	d.lineTo(a.x, a.y);
    }
    d.lineWidth = width / camera.scale();
    d.strokeStyle = color;
    d.stroke();
  }

  d.save();
  d.translate(camera.x, camera.y);
  d.scale(camera.scale(), -camera.scale());
  d.lineCap = "round";
  d.lineJoin = "round";
  if (camera.zoom > 3) {
    draw_all_roads(4.5, "#d82");
    draw_all_roads(3, "#ed4");
  }
  else {
    draw_all_roads(1.5, "#e93");
  }
  d.restore();
}

module.exports.prototype.add = function(p) {
  this.roads.push(p);
}
