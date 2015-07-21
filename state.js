function State() {
  this.state = Immutable.fromJS({
    camera: {x: -335.8125, y: 582.8125, zoom: 2},
  });
}

State.prototype.camera = function() {
  var c = this.state.get('camera').toJS();
  c.scale = function() { return 0.1 * Math.pow(2, this.zoom) };
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

State.prototype.cam_set = function(x, y) {
  this.state = this.state.mergeDeep({camera: {x:x,y:y}});
}

module.exports = State;
