module.exports = function(dispatch, cur_img_name, img_states, overlay) {
  this.dispatch = dispatch;
  this.img_states = img_states;
  this.overlay = overlay;
  this.cur_img_name = cur_img_name;
  this.img_state = clone(g_imageStates[cur_img_name]);
}

module.exports.prototype.render = function(d, camera, locus, world_bbox) {
  d.save();
  d.translate(camera.x, camera.y);
  d.scale(camera.scale(), camera.scale());
  d.globalAlpha = 0.5;
  var ovr = this.overlay;
  if (ovr != null) {
    d.drawImage(ovr, 0, 0, ovr.width,
  		ovr.height, this.img_state.x, -this.img_state.y + ovr.height  * this.img_state.scale / 1024,
  		ovr.width * this.img_state.scale / 1024,
  		-ovr.height * this.img_state.scale / 1024);
  }

  d.restore();
}

function image_url(img_name) {
  return 'file:///home/jcreed/art/whatever/' + img_name + '.png';
}
module.exports.image_url = image_url

module.exports.prototype.reload_img = function(img_name) {
  var that = this;
  this.cur_img_name = img_name;
  this.overlay.src = image_url(img_name);
  this.overlay.onload = function() {
    var new_state = g_imageStates[img_name];
    if (new_state != null) {
      that.img_state = clone(new_state);
    }
    that.dispatch();
  }
}

module.exports.prototype.prev = function() {
  this.reload_img(--this.cur_img_name);
}

module.exports.prototype.next = function() {
  this.reload_img(++this.cur_img_name);
}
