module.exports = function(dispatch, cur_img_ix, img_states, overlay) {
  var img_state_arr = _.pairs(img_states).map(function(pair) {
    return _.extend({name: pair[0]}, pair[1]);
  });
  this.dispatch = dispatch;
  this.img_states = img_state_arr;
  this.overlay = overlay;
  this.cur_img_ix = cur_img_ix;
  this.img_state = clone(img_state_arr[cur_img_ix]);
}

module.exports.prototype.render = function(d, camera, locus, world_bbox) {
  d.save();
  d.translate(camera.x, camera.y);
  d.scale(camera.scale(), camera.scale());
  d.globalAlpha = 0.25;
  var ovr = this.overlay;
  if (ovr != null) {
    d.drawImage(ovr, 0, 0, ovr.width,
  		ovr.height, this.img_state.x, -this.img_state.y + ovr.height  * this.img_state.scale,
  		ovr.width * this.img_state.scale,
  		-ovr.height * this.img_state.scale );
    d.globalAlpha = 0.5;
    d.beginPath();
    d.moveTo(0, -this.img_state.y);
    d.lineTo(3807232, -this.img_state.y );
    d.moveTo(this.img_state.x, 0);
    d.lineTo(this.img_state.x, -3226521 );

    d.strokeStyle = "blue";
    d.lineWidth = 1 / camera.scale();
    d.stroke();
    d.strokeRect(this.img_state.x, -this.img_state.y + ovr.height  * this.img_state.scale,
  		ovr.width * this.img_state.scale,
  	       -ovr.height * this.img_state.scale);
  }

  d.restore();
}

function image_url(img_name) {
  return '/img/' + img_name + '.png';
}
module.exports.image_url = image_url

module.exports.prototype.reload_img = function(img_ix) {
  var that = this;
  this.cur_img_ix = img_ix;
  if (this.overlay == undefined) {
    this.overlay = new Image();
  }
  this.overlay.src = image_url(this.img_states[img_ix].name);
  this.overlay.onload = function() {
    var new_state = that.img_states[img_ix];
    if (new_state != null) {
      that.img_state = clone(new_state);
    }
    that.dispatch();
  }
}

function mod(n, m) {
  if (n > 0)
    return n % m
  else
    return ((n % m) + m) % m
}

module.exports.prototype.prev = function() {
  this.cur_img_ix = mod(this.cur_img_ix - 1, this.img_states.length);
  this.reload_img(this.cur_img_ix);
}

module.exports.prototype.next = function() {
  this.cur_img_ix = mod(this.cur_img_ix + 1, this.img_states.length);
  this.reload_img(this.cur_img_ix);
}

module.exports.prototype.scale = function(by) {
  this.img_state.scale *= by;
}

module.exports.prototype.get_pos = function() {
  return {x:this.img_state.x, y:this.img_state.y};
}

module.exports.prototype.set_pos = function(p) {
  this.img_state.x = p.x;
  this.img_state.y = p.y;
}

module.exports.prototype.model = function() {
  return {images: _.object(this.img_states.map(function(obj) {
    return [obj.name, _.omit(obj, "name")];
  }))};
}
