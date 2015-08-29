function State() {
  this.state = Immutable.fromJS({
    camera: {x: -432.125, y: 3321.875, zoom: 4},
    locus: null,
  });
}

State.prototype.camera = function() {
  var c = this.state.get('camera').toJS();
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
}

State.prototype.set_cam = function(x, y) {
  this.state = this.state.mergeDeep({camera: {x:x,y:y}});
}

State.prototype.set_locus = function(p) {
  this.state = this.state.mergeDeep({locus: p});
}

State.prototype.get_locus = function() {
  return this.state.get("locus").toJS();
}

module.exports = State;
