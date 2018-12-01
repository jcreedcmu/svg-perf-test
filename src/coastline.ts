import { ArcStore } from './arcstore';
import { LabelStore } from './labelstore';
import { Mode, Point, Zpoint, ArRectangle, Dict, Ctx, Camera, Bush } from './types';
import { Label, RawLabel, Arc, RawArc, Target, Segment, LabelTarget, ArcVertexTarget } from './types';
import { Poly, RawPoly, RoadProps, PolyProps, Bbox, Layer } from './types';
import { nope } from './util';
import { cscale, vmap, vkmap, trivBbox } from './util';
import { clone, above_simp_thresh, insertPt, removePt } from './util';
import { colors } from './colors';
import * as simplify from './simplify';
import * as rbush from 'rbush';
import { draw_label } from './labels';
import { UIState, RenderCtx } from './types';

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

function realize_path(d: Ctx, us: UIState, props: PolyProps, camera: Camera) {
  const scale = cscale(camera);
  d.lineWidth = 1.1 / scale;

  switch (props.t) {
    case "natural": {
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
      break;
    }

    case "city": {
      d.fillStyle = "#dbdbab";
      d.fill();
      break;
    }

    case "road": {
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
      break;
    }

    case "boundary": {
      d.lineWidth = 1 / scale;
      d.lineCap = "round";
      d.strokeStyle = "#000";
      d.stroke();
      break;
    }
    default:
      nope(props);
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
  labelStore: LabelStore;
  counter: number;

  constructor(arcStore: ArcStore, labelStore: LabelStore, counter: number) {
    this.arcStore = arcStore;
    this.labelStore = labelStore;
    this.counter = counter;
  }

  rebuild() {
    this.arcStore.rebuild();
    this.labelStore.rebuild();
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
    const targets = tsearch(this.labelStore.label_rt, world_bbox);
    if (targets.length < 2)
      return targets;
    else
      return [];
  }

  target_point(target: Target) {
    return target[0] == "coastline" ?
      target[1].point :
      this.labelStore.labels[target[1]].pt;
  }

  // invariant: targets.length >= 1
  targets_nabes(targets: Target[]): Point[] {
    // XXX what happens if targets is of mixed type ugh
    if (targets[0][0] == "coastline") {
      const neighbors: Point[] = [];

      targets.forEach(target => {
        if (target[0] == "coastline") {
          let ctarget = target[1];
          let ix = this.arcStore.get_index(ctarget);
          let arc_points = this.arcStore.getPoints(ctarget.arc);
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

  render(rc: RenderCtx) {
    const { d, camera, world_bbox, us, mode } = rc;
    function visible(x: Poly): boolean {
      if (x.properties.t == "road" && !us.road) return false;
      if (x.properties.t == "boundary" && !us.boundary) return false;
      return true;
    }

    const scale = cscale(camera);
    const arcs_to_draw_vertices_for: Zpoint[][] = [];
    const salients: { props: RoadProps, pt: Point }[] = [];
    const rawFeatures = tsearch(this.arcStore.rt, world_bbox).filter(visible);
    const baseFeatures = _.sortBy(rawFeatures, x => {
      let z = 0;
      const p: PolyProps = x.properties;
      if (p.t == "natural" && p.natural == "lake") z = 1;
      if (p.t == "natural" && p.natural == "mountain") z = 1;
      if (p.t == "city") z = 1;
      if (p.t == "road" && p.road == "highway") z = 2;
      if (p.t == "road" && p.road == "street") z = 3;
      if (p.t == "boundary") z = 4;
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
        realize_path(d, us, object.properties, camera);
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
    tsearch(this.labelStore.label_rt, world_bbox).forEach(x => {
      draw_label(d, camera, this.labelStore.labels[x]);
    });
  }

  // special case first and last of arc??
  replace_vert(targets: Target[], p: Point) {
    targets.forEach(target => {
      if (target[0] == "coastline") {
        this.arcStore.replace_vertex(target[1], p);
      }
      else if (target[0] == "label") {
        this.labelStore.replace_vertex(target[1], p);
      }
    });
  }

  model(): {
    counter: number,
    points: Dict<Point>,
    polys: Dict<RawPoly>,
    arcs: Dict<RawArc>,
    labels: Dict<RawLabel>,
  } {

    return {
      counter: this.counter,
      ...this.arcStore.model(),
      ...this.labelStore.model(),
    };
  }

  draw_selected_arc(d: Ctx, arc_id: string) {
    d.beginPath();
    this.arcStore.getPoints(arc_id).forEach((pt, n) => {
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

  new_point_feature(lab: Label) {
    const point_name = "p" + this.counter;
    this.counter++;
    lab.name = point_name;
    this.labelStore.add_point_feature(lab);
  }

  add_arc_feature(t: string, points: Point[], properties: PolyProps) {
    const feature_name = "f" + this.counter;
    const arc_name = "a" + this.counter;
    this.counter++;
    const arc: Arc = this.arcStore.addArc(arc_name, points);
    this.arcStore.addFeature(feature_name, [{ id: arc_name }], properties);
  }

  make_insert_feature_modal(pts: Point[], dispatch: () => void) {
    set_value($('#insert_feature input[name="text"]')[0], "");
    set_value($('#insert_feature input[name="key"]')[0], "road");
    set_value($('#insert_feature input[name="value"]')[0], "highway");
    set_value($('#insert_feature input[name="zoom"]')[0], "");

    const submit_f = (e: JQuery.Event<HTMLElement, null>) => {
      e.preventDefault();
      const obj: { text: string, key: string, value: string, zoom: string } =
        _.object($("#insert_feature form").serializeArray().map(pair =>
          [pair.name, pair.value]
        ));

      // if (obj.zoom == null || obj.zoom == "")
      //   delete obj.zoom;
      // const k = obj.key;
      // const v = obj.value;
      // delete obj.key;
      // delete obj.value;
      //      obj[k] = v;

      const props: PolyProps = { t: "boundary" };
      this.add_arc_feature("Polygon", pts, props);
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
