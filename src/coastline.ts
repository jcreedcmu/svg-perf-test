import { ArcStore } from './arcstore';
import { Mode, Point, Zpoint, ArRectangle, Dict, Ctx, Camera, Bush } from './types';
import { Label, RawLabel, Arc, RawArc, Target, Segment, LabelTarget, ArcVertexTarget } from './types';
import { Poly, RawPoly, RoadProps, PolyProps, Bbox, Layer } from './types';
import { rawOfArc, unrawOfArc, rawOfPoly, unrawOfPoly, rawOfLabel, unrawOfLabel } from './util';
import { adapt, cscale, vmap, vkmap, trivBbox } from './util';
import { clone, above_simp_thresh, getArc, insertPt, removePt } from './util';
import { colors } from './colors';
import * as simplify from './simplify';
import * as rbush from 'rbush';
import { draw_label } from './labels';

import _ = require('underscore');

function tsearch<T>(rt: Bush<T>, bbox: ArRectangle): T[] {
  return rt.search({
    minX: bbox[0],
    minY: bbox[1],
    maxX: bbox[2],
    maxY: bbox[3]
  }).map(x => x.payload);
}

let DEBUG_BBOX = false;

function dictOfNamedArray<T extends { name: string }>(ar: T[]): Dict<T> {
  const rv: Dict<T> = {};
  ar.forEach(t => {
    rv[t.name] = t;
  });
  return rv;
}

function realize_salient(d: Ctx, props: RoadProps, camera: Camera, pt: Point) {
  const text = props.text.toUpperCase();
  if (camera.zoom < 2) return;
  // implied:
  //  d.translate(camera.x, camera.y);
  //  d.scale(scale, -scale);

  const q = {
    x: pt.x * cscale(camera) + camera.x,
    y: pt.y * -cscale(camera) + camera.y
  };

  let stroke = null;

  let shape: "rect" | "trapezoid" = "rect";
  d.fillStyle = "#55a554";
  if (text.match(/^P/)) d.fillStyle = "#29a";
  if (text.match(/^Z/)) d.fillStyle = "#e73311";
  if (text.match(/R$/)) {
    d.fillStyle = "#338";
    shape = "trapezoid";
  }
  if (text.match(/^U/)) {
    d.fillStyle = "#fffff7";
    stroke = "black";
  }

  const height = 10;
  d.font = "bold " + height + "px sans-serif";
  const width = d.measureText(text).width;

  const box_height = 12;
  const box_width = width + 10;
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
  d.fillText(text, q.x - width / 2, q.y + height / 2 - 1);

  if (stroke != null) {
    d.strokeStyle = stroke;
    d.lineWidth = 0.9;
    d.strokeRect(q.x - box_width / 2, q.y - box_height / 2, box_width, box_height);
  }
}

function realize_path(d: Ctx, props: PolyProps, camera: Camera) {
  const scale = cscale(camera);
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
    if (camera.zoom >= 2) {
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
  }
  if (DEBUG_BBOX) {
    if ("bbox" in props) {
      const feature_bbox = (<{ bbox: Bbox }>props).bbox;
      const lw = d.lineWidth = 3.0 / scale;
      d.strokeStyle = "#f0f";
      d.strokeRect(feature_bbox.minX - lw, feature_bbox.minY - lw,
        feature_bbox.maxX - feature_bbox.minX + lw * 2,
        feature_bbox.maxY - feature_bbox.minY + lw * 2);
    }
  }
}

function set_value(e: HTMLElement, v: string): void {
  (e as HTMLInputElement).value = v;
}

export class CoastlineLayer implements Layer {
  arcStore: ArcStore;
  counter: number;
  labels: Dict<Label>;
  label_rt: Bush<LabelTarget>;

  constructor(arcStore: ArcStore, labels: Dict<RawLabel>, counter: number) {
    this.arcStore = arcStore;
    this.counter = counter;
    this.labels = vkmap(labels, unrawOfLabel);
    this.rebuild();
  }

  rebuild() {
    this.arcStore.rebuild();
    this.label_rt = rbush(10);
    Object.entries(this.labels).forEach(([k, p]) => {
      insertPt(this.label_rt, p.pt, p.name);
    });
  }

  arc_targets(world_bbox: ArRectangle): Poly[] {
    return tsearch(this.arcStore.rt, world_bbox);
  }

  arc_vertex_targets(world_bbox: ArRectangle): ArcVertexTarget[] {
    const targets = tsearch(this.arcStore.vertex_rt, world_bbox);

    if (targets.length < 2) return targets;

    const orig = targets[0].point;
    for (let i = 1; i < targets.length; i++) {
      let here = targets[i].point;
      // If we're getting a set of points not literally on the same
      // point, pretend there's no match
      if (orig.x != here.x) return [];
      if (orig.y != here.y) return [];
    }
    // Otherwise return the whole set
    return targets;
  }

  label_targets(world_bbox: ArRectangle): LabelTarget[] {
    const targets = tsearch(this.label_rt, world_bbox);
    if (targets.length < 2)
      return targets;
    else
      return [];
  }

  target_point(target: Target) {
    return target[0] == "coastline" ?
      target[1].point :
      this.labels[target[1]].pt;
  }

  // invariant: targets.length >= 1
  targets_nabes(targets: Target[]): Point[] {
    // XXX what happens if targets is of mixed type ugh
    if (targets[0][0] == "coastline") {
      const neighbors: Point[] = []; // XXX could this be just Point instead?

      targets.forEach(target => {
        if (target[0] == "coastline") {
          let ctarget = target[1];
          let ix = this.arcStore.get_index(ctarget);
          let arc_points = this.arcStore.getJustPoints(ctarget.arc);
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

  render(d: Ctx, camera: Camera, mode: Mode, world_bbox: ArRectangle) {
    const scale = cscale(camera);
    const arcs_to_draw_vertices_for: Zpoint[][] = [];
    const salients: { props: RoadProps, pt: Point }[] = [];

    const baseFeatures = _.sortBy(tsearch(this.arcStore.rt, world_bbox), x => {
      let z = 0;
      const p: PolyProps = x.properties;
      if (p.t == "natural" && p.natural == "lake") z = 1;
      if (p.t == "natural" && p.natural == "mountain") z = 1;
      if (p.t == "city") z = 1;
      if (p.t == "road" && p.road == "highway") z = 2;
      if (p.t == "road" && p.road == "street") z = 3;
      return z;
    });

    // Not sure what this is for
    let extra = _.filter(_.map(baseFeatures, x => {
      if (x.properties.t == "road" && x.properties.road == "street")
        return _.extend(clone(x), { properties: _.extend(clone(x.properties), { road: "street2" }) });
    }), x => x);

    const features = baseFeatures.concat(extra);

    d.save();
    {
      d.translate(camera.x, camera.y);
      d.scale(scale, -scale);

      d.strokeStyle = "black";
      d.lineJoin = "round";
      _.each(features, object => {
        const arc_spec_list = object.arcs;

        d.lineWidth = 0.9 / scale;
        d.beginPath();

        const first_point = this.arcStore.getArc(arc_spec_list[0]).points[0].point;
        d.moveTo(first_point.x, first_point.y);

        let curpoint = first_point;
        let n = 0;

        arc_spec_list.forEach(spec => {
          const arc = this.arcStore.getArc(spec);
          let this_arc = arc.points;
          let arc_bbox = arc.bbox;
          if (DEBUG_BBOX) {
            d.lineWidth = 1.5 / scale;
            d.strokeStyle = colors.debug;
            d.strokeRect(arc_bbox.minX, arc_bbox.minY,
              arc_bbox.maxX - arc_bbox.minX,
              arc_bbox.maxY - arc_bbox.minY);
          }

          if (this_arc.length < 2) {
            throw "arc " + spec + " must have at least two points";
          }

          const rect_intersect = world_bbox[0] < arc_bbox.maxX
            && world_bbox[2] > arc_bbox.minX
            && world_bbox[3] > arc_bbox.minY
            && world_bbox[1] < arc_bbox.maxY;

          if (!rect_intersect) {
            // The bounding box of this arc is entirely off-screen.
            // Draw as simplified as possible; just one line segment
            // from beginning to end.
            this_arc = [this_arc[0], this_arc[this_arc.length - 1]];
          }

          if (rect_intersect && camera.zoom >= 6) {
            // draw individual vertices if we're at least partially
            // on-screen, and also quite zoomed in.
            arcs_to_draw_vertices_for.push(this_arc);
          }

          this_arc.forEach(({ point: vert, z }, ix) => {
            if (ix == 0) return;

            let p = {
              x: camera.x + (vert.x * scale),
              y: camera.y + (vert.y * scale)
            };

            let draw = false;

            // draw somewhat simplified
            if (camera.zoom >= 6 || above_simp_thresh(z, scale))
              draw = true;
            if (ix == this_arc.length - 1)
              draw = true;
            if (draw) {
              d.lineTo(vert.x, vert.y);
              if (object.properties.t == "road" && object.properties.road == "highway" && n % 10 == 5) {
                salients.push({
                  props: object.properties,
                  pt: { x: (vert.x + curpoint.x) / 2, y: (vert.y + curpoint.y) / 2 }
                });
              }
              curpoint = vert;
              n++;
            }

          });
        });
        realize_path(d, object.properties, camera);
      });

      // draw vertices
      d.lineWidth = 1.5 / scale;
      if (mode != "Pan") {
        d.strokeStyle = "#333";
        d.fillStyle = "#ffd";
        let vert_size = 5 / scale;
        arcs_to_draw_vertices_for.forEach(arc => {
          arc.forEach(({ point: vert, z }: Zpoint, n: number) => {
            if (z > 1000000 || camera.zoom > 10) {
              d.fillStyle = z > 1000000 ? "#ffd" : "#f00";
              d.strokeRect(vert.x - vert_size / 2, vert.y - vert_size / 2, vert_size, vert_size);
              d.fillRect(vert.x - vert_size / 2, vert.y - vert_size / 2, vert_size, vert_size);
            }
          });
        });
      }
    }
    d.restore();

    // doing this outside the d.save/d.restore because it involves
    // text, which won't want the negative y-transform
    salients.forEach(salient => {
      realize_salient(d, salient.props, camera, salient.pt);
    });

    // render labels
    if (camera.zoom < 1) return;
    d.lineJoin = "round";
    tsearch(this.label_rt, world_bbox).forEach(x => {
      draw_label(d, camera, this.labels[x]);
    });
  }

  // special case first and last of arc??
  replace_vert(targets: Target[], p: Point) {
    targets.forEach(target => {
      if (target[0] == "coastline") {
        this.arcStore.replace_vertex(target[1], p);
      }
      else if (target[0] == "label") {
        const lab = this.labels[target[1]];
        removePt(this.label_rt, lab.pt);
        lab.pt = p;
        insertPt(this.label_rt, lab.pt, target[1]);
      }
    });
  }

  model(): {
    counter: number,
    polys: Dict<RawPoly>,
    arcs: Dict<RawArc>,
    labels: Dict<RawLabel>,
  } {

    const labels: Dict<RawLabel> = vmap(this.labels, rawOfLabel);
    return {
      counter: this.counter,
      ...this.arcStore.model(),
      labels,
    };
  }

  draw_selected_arc(d: Ctx, arc_id: string) {
    d.beginPath();
    this.arcStore.getPoints(arc_id).forEach(({ point: pt }, n) => {
      if (n == 0)
        d.moveTo(pt.x, pt.y)
      else
        d.lineTo(pt.x, pt.y)
    });
    d.stroke();
  }

  filter() {
    this.arcStore.forFeatures((k, obj) => {
      if (obj.properties.t == "natural" && obj.properties.natural == "mountain") {
        // strip out collinearish points
        const arc = this.arcStore.getArc(obj.arcs[0]);
        // XXX shouldn't mutate directly like this
        arc.points = arc.points.filter(({ point: p, z }, n) => {
          return n == 0 || n == arc.points.length - 1 || z > 1000000;
        });
      }
    });
    this.rebuild();
  }

  add_point_feature(lab: Label) {
    this.labels[lab.name] = lab;
    console.log("adding pt " + JSON.stringify(lab), lab.name, { x: lab.pt.x, y: lab.pt.y, w: 0, h: 0 });
    insertPt(this.label_rt, lab.pt, lab.name);
  }

  new_point_feature(lab: Label) {
    const point_name = "p" + this.counter;
    this.counter++;
    lab.name = point_name;
    this.add_point_feature(lab);
  }

  replace_point_feature(lab: Label) {
    console.log(lab);
    this.labels[lab.name] = lab;
  }

  add_arc_feature(t: string, points: Zpoint[], properties: PolyProps) {
    const feature_name = "f" + this.counter;
    const arc_name = "a" + this.counter;
    this.counter++;
    const arc: Arc = this.arcStore.addArc(arc_name, points);
    this.arcStore.addFeature(feature_name, [{ id: arc_name }], properties);
  }

  breakup() {
    this.arcStore.forArcs((name, arc) => {
      if (arc.points.length > 200) {
        const num_chunks = Math.ceil(arc.points.length / 200);
        const cut_positions = [0];
        for (let i = 0; i < num_chunks - 1; i++) {
          cut_positions.push(Math.floor((i + 1) * (arc.points.length / num_chunks)));
        }
        cut_positions.push(arc.points.length - 1);
        const replacement_arcs: any[] = [];
        for (let j = 0; j < cut_positions.length - 1; j++) {
          const points: Zpoint[] = [];
          for (let jj = cut_positions[j]; jj <= cut_positions[j + 1]; jj++) {
            points.push(clone(arc.points[jj]));
          }
          const newArc = this.arcStore.addArc(name + "-" + j, points);
          replacement_arcs.push(newArc.name);
        }
        // Not really sure this still works. this.arc_to_feature[k] is
        // a list of feature names, so I'm arbitrarily picking out the first one
        // by saying [0].

        // Don't know how to do this anymore???
        // const feature_name = this.arc_to_feature[name][0];
        // const feature_arcs = this.features[feature_name].arcs;
        // const ix = _.indexOf(feature_arcs.map(x => x.id), name);
        // if (ix == -1)
        //   throw ("couldn't find " + name + " in " + JSON.stringify(feature_arcs));
        // feature_arcs.splice.apply(feature_arcs, [ix, 1].concat(replacement_arcs));

        // delete this.arcs[name];
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
      const obj: any = _.object($("#insert_feature form").serializeArray().map(pair =>
        [pair.name, pair.value]
      ));
      if (obj.zoom == null || obj.zoom == "")
        delete obj.zoom;
      const k = obj.key;
      const v = obj.value;
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
