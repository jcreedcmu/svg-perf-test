function LabelLayer(labels) {
  var that = this;
  this.labels = labels;
  var rt = this.rt = new RTree(10);
  _.each(labels, function(lab, id) {
    that.add_label_to_rt(_.extend(lab, {id:id}));
  });
  this.last_label = _.max(_.keys(labels).map(function(x){return parseInt(x);})) + 1;
}
module.exports = LabelLayer;

// function debug_all() {
//   var items = rt.bbox(0,0,10000,10000);
//   return '[\n' + _.sortBy(items, 'id')
//     .map(function(x){return JSON.stringify(x)})
//     .join(',\n') + '\n]';
// }
// window.debug_all = debug_all;

LabelLayer.prototype.add_label_to_rt = function(lab) {
  this.rt.insert({x: lab.p.x, y:lab.p.y, w:0, h:0}, lab);
}

LabelLayer.prototype.rm_label_from_rt = function(lab) {
  this.rt.remove({x: lab.p.x, y:lab.p.y, w:0, h:0}, lab);
}

LabelLayer.prototype.new_label = function(bundle) {
  var id = this.last_label++;
  var lab = {id:id, p: {x:bundle.p.x, y:bundle.p.y}, text: bundle.text, type: bundle.type};
  if (bundle.zoom != "" && bundle.zoom != null)
    _.extend(lab, {zoom:bundle.zoom});
  this.add_label_to_rt(lab);
  this.labels[id] = lab;
}

LabelLayer.prototype.replace_label = function(new_lab) {
  var old_lab = this.labels[new_lab.id];
  this.rm_label_from_rt(old_lab);
  this.add_label_to_rt(new_lab);
  this.labels[new_lab.id] = new_lab;
}

function titleCase(str) {
  return str.replace(/\w\S*/g, function(txt){return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();});
}

module.exports.draw_label = function(d, camera, lab) {
  var p = lab.pt, txt = lab.properties.text, typ = lab.properties.label, min_zoom = lab.properties.zoom;
  var q = {x: camera.x + camera.scale() * p[0],
	   y: camera.y - camera.scale() * p[1]};

  txt = titleCase(txt);
  var stroke = true;
  var height;
  if (min_zoom == null) {
    if (typ == "city") min_zoom = 3;
    if (typ == "minorsea") min_zoom = 2;
  }
  if (camera.zoom < min_zoom) return;

  if (typ == "city") {
    d.fillStyle = "white";
    d.strokeStyle = "#333";
    d.lineWidth = 1.5;
    d.beginPath();

    d.arc(q.x, q.y, 3.2, 0, Math.PI * 2);
    d.stroke();
    d.fill();

    q.y -= 12;

    d.fillStyle = "#333";
    d.strokeStyle = "white";
    d.lineWidth = 2;
    height = 10;
    d.font = "bold " + height + "px sans-serif";
  }
  else if (typ == "region") {
    d.fillStyle = "#333";
    d.strokeStyle = "white";
    d.lineWidth = 2;
    height = 10;
    d.font = "italic " + height + "px sans-serif";
  }
  else if (typ == "river") {
    d.fillStyle = "#007";
    d.strokeStyle = "white";
    d.lineWidth = 2;
    height = 10;
    d.font = height + "px sans-serif";
  }
  else if (typ == "park") {
    d.fillStyle = "#070";
    d.strokeStyle = "white";
    d.lineWidth = 2;
    height = 10;
    d.font = height + "px sans-serif";
  }
  else if (typ == "sea") {
    d.fillStyle = "#444";
    stroke = false;
    height = 10;
    d.font = "bold " + height + "px sans-serif";
  }
  else if (typ == "minorsea") {
    d.fillStyle = "#44a";
    d.strokeStyle = "white";
    d.lineWidth = 2;
    height = 10;
    d.font = "bold " + height + "px sans-serif";
  }
  var width = d.measureText(txt).width;
  if (stroke)
    d.strokeText(txt, q.x - width/2, q.y + height/2);
  d.fillText(txt, q.x - width/2, q.y + height/2);
}

LabelLayer.prototype.model = function() {
  return {labels: _.object(_.map(this.labels, function(val, key) {
    return [key, _.omit(val, "id")];
  }))};
}

exports.handle_mouse = function(camera, worldp) {
  var s = camera.scale();
  var bbox = [worldp.x - 30 / s, worldp.y - 30 / s,
	      worldp.x + 30 / s, worldp.y + 30 / s];
  var results = rt.bbox.apply(rt, bbox);
  var rv = results.length == 1;
  if (rv) {
    rt.remove({x: worldp.x - 30 / s, y: worldp.y - 30 / s, w: 60/s, h:60/s}, results[0])
    window.render();
  }
  return rv;
}

LabelLayer.prototype.targets = function(world_bbox) {
  var targets = this.rt.bbox.apply(this.rt, world_bbox);

  if (targets.length < 2)
    return targets;
  else
    return [];
}

LabelLayer.prototype.make_insert_label_modal = function(worldp, lab, k) {
  var that = this;
  var process_f = null;
  if (lab) {
    $('#insert_label input[name="text"]')[0].value = lab.text;
    $('#insert_label input[name="type"]')[0].value = lab.type;
    if (lab.zoom == null) lab.zoom = "";
    $('#insert_label input[name="zoom"]')[0].value = lab.zoom;

    process_f = function (obj) {
      _.extend(obj, {p: lab.p, id:lab.id});
      k(obj);
    }
  }
  else {
    $('#insert_label input[name="text"]')[0].value = "";
    $('#insert_label input[name="type"]')[0].value = "region";
    $('#insert_label input[name="zoom"]')[0].value = "";

    process_f = function (obj) {
      _.extend(obj, {p: worldp});
      k(obj);
    }
  }
  var submit_f = function(e) {
    e.preventDefault();
    var obj = _.object($("#insert_label form").serializeArray().map(function(pair) {
      return [pair.name, pair.value];
    }));
    if (obj.zoom == null || obj.zoom == "")
      delete obj.zoom;
    process_f(obj);

    $("#insert_label").modal("hide");
  };
  $("#insert_label form").off("submit");
  $("#insert_label form").on("submit", submit_f);
  $("#insert_label form button[type=submit]").off("click");
  $("#insert_label form button[type=submit]").on("click", submit_f);



  $('#insert_label').modal('show');
  setTimeout(function() { $('#insert_label input[name="text"]').focus(); }, 500);
}
