function LabelLayer(labels) {
  var that = this;
  this.labels = labels;
  var rt = this.rt = new RTree(10);
  labels.forEach(function(lab) {
    that.add_label_to_rt(lab);
  });
  this.last_label = _.max(labels, 'id').id + 1;
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

LabelLayer.prototype.new_label = function(bundle) {
  var id = this.last_label++;
  var lab = {id:id, p: {x:bundle.p.x, y:bundle.p.y}, txt: bundle.text, type: bundle.type};
  this.add_label_to_rt(lab);
  this.labels.push(lab);
}

function titleCase(str) {
  return str.replace(/\w\S*/g, function(txt){return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();});
}

LabelLayer.prototype.render = function(d, camera, locus, world_bbox) {
  if (camera.zoom < 1) return;
  d.lineJoin = "round";
  function draw_label(p, txt, typ) {
    var q = {x: camera.x + camera.scale() * p.x,
	      y: camera.y - camera.scale() * p.y};

    txt = titleCase(txt);
    var stroke = true;
    var height;
    if (typ == "city") {
      if (camera.zoom < 3) return;
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
    else if (typ == "sea") {
      d.fillStyle = "#444";
      stroke = false;
      height = 10;
      d.font = "bold " + height + "px sans-serif";
    }
    else if (typ == "minorsea") {
      if (camera.zoom < 3) return;
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

  this.rt.bbox.apply(this.rt, world_bbox).forEach(function(lab) {
    draw_label(lab.p, lab.txt, lab.type);
  });

  if (locus != null) {
    var loc = locus.toJS();
    d.save();
    d.translate(camera.x, camera.y);
    d.scale(camera.scale(), -camera.scale());
    d.strokeStyle = "black";
    d.lineWidth = 1 / camera.scale();

    d.strokeRect(loc.x - 20, loc.y - 20, 40, 40);
    d.strokeRect(loc.x - 5, loc.y - 5, 10, 10);
    d.strokeRect(loc.x - 1, loc.y - 1, 2, 2);
    d.restore();
  }
}

LabelLayer.prototype.model = function() {
  return {labels: this.labels};
}

exports.handle_mouse = function(camera, worldp) {
  console.log(worldp);
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
