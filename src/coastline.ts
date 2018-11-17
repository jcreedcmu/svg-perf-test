import { Mode, Point, Zpoint, ArPoint, ArRectangle, Dict, Ctx, Camera } from './types';
import { Label, Arc, RawArc, Target, Segment, LabelTarget, ArcVertexTarget } from './types';
import { Poly, RawPoly, PolyProps, Bbox, Layer } from './types';
import { adapt, cscale, rawOfArc, unrawOfArc, rawOfPoly, unrawOfPoly, vmap, vkmap, trivBbox } from './util';
import { clone, above_simp_thresh } from './util';
import { colors } from './colors';
import * as simplify from './simplify';
import * as rbush from 'rbush';
import { draw_label } from './labels';
import BBox = rbush.BBox;
import RBush = rbush.RBush;

import _ = require('underscore');

type Bush<T> = RBush<BBox & { payload: T }>;

function tsearch<T>(rt: Bush<T>, bbox: ArRectangle): T[] {
  return rt.search({
    minX: bbox[0],
    minY: bbox[1],
    maxX: bbox[2],
    maxY: bbox[3]
  }).map(x => x.payload);
}

function insertPt<T>(rt: Bush<T>, pt: Point, payload: T): void {
  rt.insert({
    minX: pt.x, maxX: pt.x,
    minY: pt.y, maxY: pt.y,
    payload
  });
}

function removePt<T>(rt: Bush<T>, pt: Point): void {
  rt.search({
    minX: pt.x, maxX: pt.x,
    minY: pt.y, maxY: pt.y,
  }).forEach(res => {
    rt.remove(res);
  });
}

var DEBUG_BBOX = false;

function dictOfNamedArray<T extends { name: string }>(ar: T[]): Dict<T> {
  const rv: Dict<T> = {};
  ar.forEach(t => {
    rv[t.name] = t;
  });
  return rv;
}

function realize_salient(d: Ctx, props: any, camera: Camera, pt: ArPoint) {
  if (camera.zoom < 2) return;
  // implied:
  //  d.translate(camera.x, camera.y);
  //  d.scale(scale, -scale);

  var q = {
    x: pt[0] * cscale(camera) + camera.x,
    y: pt[1] * -cscale(camera) + camera.y
  };

  var stroke = null;

  var shape = "rect";
  d.fillStyle = "#55a554";
  if (props.text.match(/^P/)) d.fillStyle = "#29a";
  if (props.text.match(/^Z/)) d.fillStyle = "#e73311";
  if (props.text.match(/R$/)) {
    d.fillStyle = "#338";
    shape = "trapezoid";
  }
  if (props.text.match(/^U/)) {
    d.fillStyle = "#fffff7";
    d.strokeStyle = "black";
  }

  var txt = props.text;
  var height = 10;
  d.font = "bold " + height + "px sans-serif";
  var width = d.measureText(txt).width;

  var box_height = 12;
  var box_width = width + 10;
  if (shape == "rect") {
    d.fillRect(q.x - box_width / 2, q.y - box_height / 2, box_width, box_height);
  }
  else if (shape == "trapezoid") {
    d.beginPath();
    d.moveTo(q.x - box_width / 2, q.y - box_height / 2);
    d.lineTo(q.x + box_width / 2, q.y - box_height / 2);
    d.lineTo(q.x + box_width / 2 - box_height / 4, q.y + box_height / 2);
    d.lineTo(q.x - box_width / 2 + box_height / 4, q.y + box_height / 2);
    d.closePath();
    d.fill();
  }
  d.fillStyle = "white";
  if (stroke != null) d.fillStyle = stroke;
  d.fillText(txt, q.x - width / 2, q.y + height / 2 - 1);

  if (stroke != null) {
    d.strokeStyle = stroke;
    d.lineWidth = 0.9;
    d.strokeRect(q.x - box_width / 2, q.y - box_height / 2, box_width, box_height);
  }
}

function realize_path(d: Ctx, props: PolyProps, scale: number) {
  d.lineWidth = 1.1 / scale;

  if (props.t == "natural") {
    if (props.natural == "coastline") {
      d.strokeStyle = colors.water_border;
      d.stroke();
      d.fillStyle = colors.land;
      if (!DEBUG_BBOX)
        d.fill();
    }

    if (props.natural == "lake") {
      d.strokeStyle = colors.water_border;
      d.stroke();
      d.fillStyle = "#bac7f8";
      if (!DEBUG_BBOX)
        d.fill();
    }

    if (props.natural == "mountain") {
      d.fillStyle = "#b5ab9b";
      if (!DEBUG_BBOX)
        d.fill();
    }
  }

  if (props.t == "city") {
    d.fillStyle = "#dbdbab";
    d.fill();
  }

  if (props.t == "road") {
    if (props.road == "highway") {
      d.lineWidth = 1.5 / scale;
      d.strokeStyle = "#f70";
      d.stroke();
    }

    if (props.road == "street") {
      d.lineWidth = 5 / scale;
      d.lineCap = "round";
      d.strokeStyle = "#777";
      d.stroke();
    }

    if (props.road == "street2") {
      d.lineWidth = 4 / scale;
      d.lineCap = "round";
      d.strokeStyle = "#fff";
      d.stroke();
    }
  }
  if (DEBUG_BBOX) {
    if ("bbox" in props) {
      var feature_bbox = (<{ bbox: Bbox }>props).bbox;
      var lw = d.lineWidth = 3.0 / scale;
      d.strokeStyle = "#f0f";
      d.strokeRect(feature_bbox.minx - lw, feature_bbox.miny - lw,
        feature_bbox.maxx - feature_bbox.minx + lw * 2,
        feature_bbox.maxy - feature_bbox.miny + lw * 2);
    }
  }
}

function set_value(e: HTMLElement, v: string): void {
  (e as HTMLInputElement).value = v;
}

export class CoastlineLayer implements Layer {
  counter: number;
  features: Dict<Poly>;
  arcs: Dict<Arc>;
  labels: Dict<Label>;
  rt: Bush<Poly>;
  vertex_rt: Bush<ArcVertexTarget>;
  label_rt: Bush<LabelTarget>;
  arc_to_feature: Dict<string[]> = {};

  constructor(arcs: Dict<RawArc>, polys: Dict<RawPoly>, labels: Label[], counter: number) {
    this.counter = counter;
    this.features = vkmap(polys, unrawOfPoly);
    this.arcs = vkmap(arcs, unrawOfArc);
    this.labels = dictOfNamedArray(labels);
    this.rebuild();
  }

  rebuild() {
    this.rt = rbush(10);
    this.vertex_rt = rbush(10);
    this.label_rt = rbush(10);
    const { features, arc_to_feature, arcs, labels } = this;

    Object.entries(arcs).forEach(([an, arc]) => {
      arc.points.forEach(({ point }, pn) => {
        insertPt(this.vertex_rt, { x: point[0], y: point[1] }, { arc: an, point: point });
      });
      simplify.simplify_arc(arc);
    });

    Object.entries(labels).forEach(([k, p]) => {
      insertPt(this.label_rt, { x: p.pt[0], y: p.pt[1] }, p.name);
    });

    _.each(features, (object, key) => {
      simplify.compute_bbox(object, arcs);
      const bb = object.bbox;
      this.rt.insert({ minX: bb.minx, minY: bb.miny, maxX: bb.maxx, maxY: bb.maxy, payload: object });
    });

    _.each(features, (object, feature_ix) => {
      _.each(object.arcs, arc_ix => {
        if (!arc_to_feature[arc_ix])
          arc_to_feature[arc_ix] = [];
        arc_to_feature[arc_ix].push(feature_ix);
      });
    });
  }

  arc_targets(world_bbox: ArRectangle): Poly[] {
    return tsearch(this.rt, world_bbox);
  }

  arc_vertex_targets(world_bbox: ArRectangle): ArcVertexTarget[] {
    var targets = tsearch(this.vertex_rt, world_bbox);

    if (targets.length < 2) return targets;

    var orig = targets[0].point;
    for (var i = 1; i < targets.length; i++) {
      var here = targets[i].point;
      // If we're getting a set of points not literally on the same
      // point, pretend there's no match
      if (orig[0] != here[0]) return [];
      if (orig[1] != here[1]) return [];
    }
    // Otherwise return the whole set
    return targets;
  }

  label_targets(world_bbox: ArRectangle): LabelTarget[] {
    var targets = tsearch(this.label_rt, world_bbox);
    if (targets.length < 2)
      return targets;
    else
      return [];
  }

  target_point(target: Target) {
    var pt = target[0] == "coastline" ?
      target[1].point :
      this.labels[target[1]].pt;
    return { x: pt[0], y: pt[1] };
  }

  // invariant: targets.length >= 1
  targets_nabes(targets: Target[]): Zpoint[] {
    var that = this;

    // XXX what happens if targets is of mixed type ugh
    if (targets[0][0] == "coastline") {
      const neighbors: Zpoint[] = [];

      targets.forEach(target => {
        if (target[0] == "coastline") {
          var ctarget = target[1];
          var ix = that.get_index(ctarget);
          var arc_points = that.arcs[ctarget.arc].points;
          if (ix > 0) neighbors.push(arc_points[ix - 1]);
          if (ix < arc_points.length - 1) neighbors.push(arc_points[ix + 1]);
        }
        else {
          console.log(`mixed type, dunno what to do, ignoring target ${target}`);
        }
      });
      return neighbors;
    }
    else {
      return [];
    }
  }

  targets(world_bbox: ArRectangle): Target[] {
    const arcts = this.arc_vertex_targets(world_bbox).map(x => ["coastline", x] as ["coastline", ArcVertexTarget]);
    const labts = this.label_targets(world_bbox).map(x => ["label", x] as ["label", LabelTarget]);
    return ([] as Target[]).concat(arcts, labts);
  }

  get_index(target: ArcVertexTarget) {
    var arc = this.arcs[target.arc].points;
    for (var i = 0; i < arc.length; i++) {
      if (arc[i].point == target.point)
        return i;
    }
    throw ("Can't find " + JSON.stringify(target.point) + " in " + JSON.stringify(arc))
  }

  render(d: Ctx, camera: Camera, mode: Mode, world_bbox: ArRectangle) {
    var scale = cscale(camera);
    d.save();

    d.translate(camera.x, camera.y);
    d.scale(scale, -scale);

    d.strokeStyle = "black";
    d.lineJoin = "round";

    var arcs_to_draw_vertices_for: any[] = []; // XXX revisit this guess
    var salients: any = []; // XXX revisit this guess

    var features: Poly[] = tsearch(this.rt, world_bbox);
    features = _.sortBy(features, x => {
      var z = 0;
      const p: PolyProps = x.properties;
      if (p.t == "natural" && p.natural == "lake") z = 1;
      if (p.t == "natural" && p.natural == "mountain") z = 1;
      if (p.t == "city") z = 1;
      if (p.t == "road" && p.road == "highway") z = 2;
      if (p.t == "road" && p.road == "street") z = 3;
      return z;
    });

    // Not sure what this is for
    var extra = _.filter(_.map(features, x => {
      if (x.properties.t == "road" && x.properties.road == "street")
        return _.extend(clone(x), { properties: _.extend(clone(x.properties), { road: "street2" }) });
    }), x => x);

    features = features.concat(extra);

    _.each(features, object => {
      var arc_id_list = object.arcs;
      var arcs = this.arcs;

      d.lineWidth = 0.9 / scale;
      d.beginPath();

      var first_point = arcs[arc_id_list[0]].points[0].point;
      d.moveTo(first_point[0], first_point[1]);

      var curpoint = first_point;
      var n = 0;

      arc_id_list.forEach(arc_id => { // XXX we shouldn't have to ascribe this type
        var this_arc = arcs[arc_id].points;
        var arc_bbox = arcs[arc_id].bbox;
        if (DEBUG_BBOX) {
          d.lineWidth = 1.5 / scale;
          d.strokeStyle = colors.debug;
          d.strokeRect(arc_bbox.minx, arc_bbox.miny,
            arc_bbox.maxx - arc_bbox.minx,
            arc_bbox.maxy - arc_bbox.miny);
        }

        const rect_intersect = world_bbox[0] < arc_bbox.maxx && world_bbox[2] > arc_bbox.minx && world_bbox[3] > arc_bbox.miny && world_bbox[1] < arc_bbox.maxy;

        if (this_arc.length < 2) {
          throw "arc " + arc_id + " must have at least two points";
        }
        if (!rect_intersect) {
          // draw super simplified
          this_arc = [this_arc[0], this_arc[this_arc.length - 1]];
        }
        else if (camera.zoom >= 6) {
          arcs_to_draw_vertices_for.push(this_arc);
        }

        this_arc.forEach(({ point: vert, z }, ix) => {
          if (ix == 0) return;

          var p = {
            x: camera.x + (vert[0] * scale),
            y: camera.y + (vert[1] * scale)
          };

          var draw = false;

          // draw somewhat simplified
          if (camera.zoom >= 6 || above_simp_thresh(z, scale))
            draw = true;
          if (ix == this_arc.length - 1)
            draw = true;
          if (draw) {
            d.lineTo(vert[0], vert[1]);
            if (object.properties.t == "road" && object.properties.road == "highway" && n % 10 == 5) {
              salients.push({
                props: object.properties,
                pt: [(vert[0] + curpoint[0]) / 2, (vert[1] + curpoint[1]) / 2]
              });
            }
            curpoint = vert;
            n++;
          }

        });
      });
      realize_path(d, object.properties, scale);
    });

    // draw vertices
    d.lineWidth = 1.5 / scale;
    if (mode != "Pan") {
      d.strokeStyle = "#333";
      d.fillStyle = "#ffd";
      var vert_size = 5 / scale;
      arcs_to_draw_vertices_for.forEach(arc => {
        arc.forEach(({ point: vert, z }: Zpoint, n: number) => {
          if (z > 1000000 || camera.zoom > 10) {
            d.fillStyle = z > 1000000 ? "#ffd" : "#f00";
            d.strokeRect(vert[0] - vert_size / 2, vert[1] - vert_size / 2, vert_size, vert_size);
            d.fillRect(vert[0] - vert_size / 2, vert[1] - vert_size / 2, vert_size, vert_size);
          }
        });
      });
    }
    d.restore();

    // doing this because it involves text, which won't want the negative y-transform
    salients.forEach((salient: any) => {
      realize_salient(d, salient.props, camera, salient.pt);
    });

    // render labels
    if (camera.zoom < 1) return;
    d.lineJoin = "round";
    tsearch(this.label_rt, world_bbox).forEach(x => {
      draw_label(d, camera, this.labels[x]);
    });
  }

  recompute_arc_feature_bbox(arc_id: string) {

    this.arc_to_feature[arc_id].forEach((feature_ix: string) => {
      var object = this.features[feature_ix];
      var bb = object.bbox;
      this.rt.remove(
        { minX: bb.minx, minY: bb.miny, maxX: bb.maxx, maxY: bb.maxy, payload: object },
        (a, b) => a.payload == b.payload
      );
      simplify.compute_bbox(object, this.arcs);
      this.rt.insert({ minX: bb.minx, minY: bb.miny, maxX: bb.maxx, maxY: bb.maxy, payload: object });
    });
  }

  // special case first and last of arc??
  replace_vert(targets: Target[], p: Point) {
    targets.forEach(target => {
      if (target[0] == "coastline") {
        var rt_entry = target[1];

        var arc_id = rt_entry.arc;

        var vert_ix = this.get_index(rt_entry);
        var arc = this.arcs[arc_id];
        var oldp = rt_entry.point;

        // I think this 1000 can be whatever
        var new_pt = arc.points[vert_ix] = { point: [p.x, p.y], z: 1000 };

        simplify.simplify_arc(arc);
        var results = removePt(this.vertex_rt, { x: oldp[0], y: oldp[1] });

        // I can't call adapt here because get_index above relies on the
        // by-reference equality of this inserted point?
        insertPt(this.vertex_rt, p, { arc: arc_id, point: (new_pt as any) as ArPoint });
        this.recompute_arc_feature_bbox(arc_id);
      }
      else if (target[0] == "label") {
        var lab = this.labels[target[1]];
        removePt(this.label_rt, { x: lab.pt[0], y: lab.pt[1] });
        lab.pt = [p.x, p.y];
        insertPt(this.label_rt, { x: lab.pt[0], y: lab.pt[1] }, target[1]);
      }
    });
  }

  add_vert_to_arc(arc_id: string, p: Point) {
    var arc = this.arcs[arc_id];
    var len = arc.points.length;
    var oldp = arc.points[len - 1];
    const op = oldp.point;
    const opp = { x: op[0], y: op[1] };
    arc.points[len - 1] = { point: [p.x, p.y], z: 1000 };
    arc.points[len] = oldp;
    simplify.simplify_arc(arc);

    const results = removePt(this.vertex_rt, opp);

    // XXX these are all wrong now
    insertPt(this.vertex_rt, p, [arc_id, len - 1] as any);
    insertPt(this.vertex_rt, opp, [arc_id, len] as any);
    insertPt(this.vertex_rt, opp, [arc_id, 0] as any);

    this.recompute_arc_feature_bbox(arc_id);
  };

  break_segment(segment: Segment, p: Point) {
    var arc_id = segment.arc;
    var arc = this.arcs[arc_id];

    var newp: Zpoint = { point: [p.x, p.y], z: 1000 };
    arc.points.splice(segment.ix + 1, 0, newp);
    simplify.simplify_arc(arc);

    insertPt(this.vertex_rt, p, { arc: arc_id, point: newp.point });
    this.recompute_arc_feature_bbox(arc_id);
  };

  model(): {
    counter: number,
    polys: Dict<RawPoly>,
    arcs: Dict<RawArc>,
    labels: Label[],
  } {
    const polys: Dict<RawPoly> = vmap(this.features, rawOfPoly);
    const arcs: Dict<RawArc> = vmap(this.arcs, rawOfArc);

    const labels: Label[] = _.map(this.labels, function(x: any) { return x });
    return {
      counter: this.counter,
      polys,
      arcs,
      labels,
    };
  }

  draw_selected_arc(d: Ctx, arc_id: string) {
    d.beginPath();
    this.arcs[arc_id].points.forEach(({ point: pt }, n) => {
      if (n == 0)
        d.moveTo(pt[0], pt[1])
      else
        d.lineTo(pt[0], pt[1])
    });
    d.stroke();
  }

  filter() {
    var that = this;
    _.each(this.features, function(obj: any) {
      if (obj.properties.natural == "mountain") {
        // strip out collinearish points
        var arc = that.arcs[obj.arcs[0]];
        arc.points = arc.points.filter(({ point: p, z }, n) => {
          return n == 0 || n == arc.points.length - 1 || z > 1000000;
        });
      }
    });
    this.rebuild();
  }

  add_point_feature(lab: Label) {
    this.labels[lab.name] = lab;
    console.log("adding pt " + JSON.stringify(lab), lab.name, { x: lab.pt[0], y: lab.pt[1], w: 0, h: 0 });
    insertPt(this.label_rt, { x: lab.pt[0], y: lab.pt[1] }, lab.name);
  }

  new_point_feature(lab: Label) {
    var point_name = "p" + this.counter;
    this.counter++;
    lab.name = point_name;
    this.add_point_feature(lab);
  }

  replace_point_feature(lab: Label) {
    console.log(lab);
    this.labels[lab.name] = lab;
  }

  newArc(name: string, points: Zpoint[]): Arc {
    // maybe compute bbox here?
    const bbox: Bbox = { minx: 1e9, miny: 1e9, maxx: -1e9, maxy: -1e9 };
    return { name, points, bbox };
  }

  add_arc_feature(t: string, points: Zpoint[], properties: PolyProps) {

    var feature_name = "f" + this.counter;
    var arc_name = "a" + this.counter;
    this.counter++;
    const arc: Arc = this.arcs[arc_name] = this.newArc(arc_name, points);
    const feature: Poly = this.features[feature_name] =
      {
        name: feature_name,
        arcs: [arc_name],
        properties: properties,
        bbox: trivBbox(),
      };
    simplify.simplify_arc(arc);
    simplify.compute_bbox(feature, this.arcs);

    _.each(arc.points, ({ point }, pn) => {
      insertPt(this.vertex_rt, { x: point[0], y: point[1] }, { arc: arc_name, point: point });
    });

    // ugh... the calls to simplify.compute_bbox statefully creates this
    const bb = feature.bbox;
    this.rt.insert({
      minX: bb.minx, minY: bb.miny, maxX: bb.maxx, maxY: bb.maxy,
      payload: feature
    });

    var arc_to_feature = this.arc_to_feature;
    if (!arc_to_feature[arc_name])
      arc_to_feature[arc_name] = [];
    arc_to_feature[arc_name].push(feature_name);
  }

  breakup() {
    _.each(this.arcs, (v: any, k) => {
      if (v.points.length > 200) {
        var num_chunks = Math.ceil(v.points.length / 200);
        var cut_positions = [0];
        for (var i = 0; i < num_chunks - 1; i++) {
          cut_positions.push(Math.floor((i + 1) * (v.points.length / num_chunks)));
        }
        cut_positions.push(v.points.length - 1);
        var replacement_arcs: any[] = [];
        for (var j = 0; j < cut_positions.length - 1; j++) {
          const arc: Arc = this.newArc(k + "-" + j, []);
          for (var jj = cut_positions[j]; jj <= cut_positions[j + 1]; jj++) {
            arc.points.push(clone(v.points[jj]));
          }
          this.arcs[arc.name] = arc;
          replacement_arcs.push(arc.name);
        }
        // Not really sure this still works. this.arc_to_feature[k] is
        // a list of feature names, so I'm arbitrarily picking out the first one
        // by saying [0].
        var feature_name = this.arc_to_feature[k][0];
        var feature_arcs = this.features[feature_name].arcs;
        var ix = _.indexOf(feature_arcs, k);
        if (ix == -1)
          throw ("couldn't find " + k + " in " + JSON.stringify(feature_arcs));
        feature_arcs.splice.apply(feature_arcs, [ix, 1].concat(replacement_arcs));

        delete this.arcs[k];
      }
    });
    this.rebuild();
  }

  make_insert_feature_modal(pts: Zpoint[], dispatch: () => void) {
    set_value($('#insert_feature input[name="text"]')[0], "");
    set_value($('#insert_feature input[name="key"]')[0], "road");
    set_value($('#insert_feature input[name="value"]')[0], "highway");
    set_value($('#insert_feature input[name="zoom"]')[0], "");

    const process_f: (obj: PolyProps) => void = obj => {
      this.add_arc_feature("Polygon", pts, obj);
    };

    function submit_f(e: JQuery.Event<HTMLElement, null>) {
      e.preventDefault();
      var obj: any = _.object($("#insert_feature form").serializeArray().map(function(pair) {
        return [pair.name, pair.value];
      }));
      if (obj.zoom == null || obj.zoom == "")
        delete obj.zoom;
      var k = obj.key;
      var v = obj.value;
      delete obj.key;
      delete obj.value;
      obj[k] = v;
      process_f(obj);
      dispatch();
      ($("#insert_feature") as any).modal("hide");
    };
    $("#insert_feature form").off("submit");
    $("#insert_feature form").on("submit", submit_f);
    $("#insert_feature form button[type=submit]").off("click");
    $("#insert_feature form button[type=submit]").on("click", submit_f);

    ($('#insert_feature') as any).modal('show');
    setTimeout(function() { $('#insert_feature input[name="text"]').focus(); }, 500);
  }


}
