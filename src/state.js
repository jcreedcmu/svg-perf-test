 function State() {
  this.origin = {x:0, y:0};
  var camera = {x: -432.125, y: 3321.875, zoom: 4};
  if (localStorage.camera != null) {
    camera = JSON.parse(localStorage.camera);
  }
  this.state = Immutable.fromJS({
    camera: camera,
    locus: null,
  });
}

State.prototype.camera = function() {
  var c = this.state.get('camera').toJS();
  c.x -= this.origin.x;
  c.y -= this.origin.y;
  c.scale = function() { return (1/8) * (1/1024) * Math.pow(2, this.zoom) };
  return c;
}

State.prototype.zoom = function(x, y, zoom) {
  var zoom2 = Math.pow(2, zoom);
  this.state = this.state
    .updateIn(['camera', 'x'], function(cx) {
      return zoom2 * (cx - x) + x;
    })
    .updateIn(['camera', 'y'], function(cy) {
      return zoom2 * (cy - y) + y;
    })
    .updateIn(['camera', 'zoom'], function(z) {
      return z + zoom;
    });
  this.store_cam();
}

State.prototype.store_cam = function() {
  localStorage.camera = JSON.stringify(this.state.get("camera").toJS());
}

State.prototype.set_cam = function(x, y) {
  this.state = this.state.mergeDeep({camera: {x:x,y:y}});
  this.store_cam();
}

State.prototype.inc_cam = function(dx, dy) {
  var x, y;
  x = this.state.get('camera').get('x');
  y = this.state.get('camera').get('y');
  this.state = this.state.mergeDeep({camera: {x:x+dx,y:y+dy}});
  this.store_cam();
}

State.prototype.set_locus = function(p) {
  this.state = this.state.mergeDeep({locus: p});
}

State.prototype.get_locus = function() {
  return this.state.get("locus").toJS();
}

State.prototype.set_origin = function(x, y) {
  this.origin.x = x;
  this.origin.y = y;
}

State.prototype.get_origin = function() {
  return this.origin;
}

State.prototype.inc_origin = function(dx, dy) {
  this.origin.x += dx;
  this.origin.y += dy;

}


module.exports = State;
