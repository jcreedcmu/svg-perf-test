import { ArcStore } from './arcstore';
import { CameraData, scale_of_camera, zoom_of_camera } from './camera-state';
import { colors } from './colors';
import { draw_label } from './labels';
import { LabelStore } from './labelstore';
import { ArRectangle, Arc, ArcVertexTarget, Bbox, Bush, Ctx, Dict, Label, LabelTarget, Layer, Point, Poly, PolyProps, RawArc, RawLabel, RawPoly, RenderCtx, RoadProps, Target, UiState, Zpoint } from './types';
import { above_simp_thresh, app_canvas_from_world, canvasIntoWorld, nope } from './util';

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

function realize_salient(d: Ctx, props: RoadProps, cameraData: CameraData, pt: Point) {
  const text = props.text.toUpperCase();
  if (zoom_of_camera(cameraData) < 2) return;
  // implied:
  //  d.translate(camera.x, camera.y);
  //  d.scale(scale, -scale);

  const q = app_canvas_from_world(cameraData, pt);

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

function realize_path(d: Ctx, us: UiState, props: PolyProps, cameraData: CameraData) {
  const scale = scale_of_camera(cameraData);
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
        d.fillStyle = colors.ocean;
        if (!DEBUG_BBOX)
          d.fill();
      }

      if (props.natural == "mountain") {
        d.fillStyle = colors.mountain;
        if (!DEBUG_BBOX)
          d.fill();
      }
      break;
    }

    case "city": {
      d.fillStyle = colors.city;
      d.fill();
      break;
    }

    case "road": {
      if (zoom_of_camera(cameraData) >= 2) {
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

function sortBy<T>(items: T[], score: (x: T) => number): T[] {
  return items.map(x => ({ item: x, score: score(x) }))
    .sort((a, b) => a.score - b.score)
    .map(x => x.item);
}

export function renderCoastline(rc: RenderCtx, arcStore: ArcStore, labelStore: LabelStore) {
  const { d, cameraData, bbox_in_world, us, mode } = rc;
  function visible(x: Poly): boolean {
    if (x.properties.t == "road" && !us.layers.road) return false;
    if (x.properties.t == "boundary" && !us.layers.boundary) return false;
    return true;
  }

  const scale = scale_of_camera(cameraData);
  const arcs_to_draw_vertices_for: Zpoint[][] = [];
  const salients: { props: RoadProps, pt: Point }[] = [];
  const rawFeatures = tsearch(arcStore.rt, bbox_in_world).filter(visible);
  const baseFeatures = sortBy(rawFeatures, x => {
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
  let extra = baseFeatures.map(x => {
    if (x.properties.t == "road" && x.properties.road == "street")
      return { ...x, properties: { ...x.properties, road: "street2" } }
  }).filter(x => x);

  // Not sure why this cast
  const features = baseFeatures.concat(extra as any);

  d.save();
  {
    canvasIntoWorld(d, cameraData);

    d.strokeStyle = "black";
    d.lineJoin = "round";
    features.forEach(ob => {
      const arc_spec_list = ob.arcs;

      d.lineWidth = 0.9 / scale;
      d.beginPath();

      const first_point = arcStore.getArc(arc_spec_list[0]).points[0].point;
      d.moveTo(first_point.x, first_point.y);

      let curpoint = first_point;
      let n = 0;

      arc_spec_list.forEach(spec => {
        const arc = arcStore.getArc(spec);
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

        const rect_intersect = bbox_in_world[0] < arc_bbox.maxX
          && bbox_in_world[2] > arc_bbox.minX
          && bbox_in_world[3] > arc_bbox.minY
          && bbox_in_world[1] < arc_bbox.maxY;

        if (!rect_intersect) {
          // The bounding box of this arc is entirely off-screen.
          // Draw as simplified as possible; just one line segment
          // from beginning to end.
          this_arc = [this_arc[0], this_arc[this_arc.length - 1]];
        }

        if (rect_intersect && zoom_of_camera(cameraData) >= 6) {
          // draw individual vertices if we're at least partially
          // on-screen, and also quite zoomed in.
          arcs_to_draw_vertices_for.push(this_arc);
        }

        this_arc.forEach(({ point: vert, z }, ix) => {
          if (ix == 0) return;

          let draw = false;

          // draw somewhat simplified
          if (zoom_of_camera(cameraData) >= 6 || above_simp_thresh(z, scale))
            draw = true;
          if (ix == this_arc.length - 1)
            draw = true;
          if (draw) {
            d.lineTo(vert.x, vert.y);
            if (ob.properties.t == "road" && ob.properties.road == "highway" && n % 10 == 5) {
              salients.push({
                props: ob.properties,
                pt: { x: (vert.x + curpoint.x) / 2, y: (vert.y + curpoint.y) / 2 }
              });
            }
            curpoint = vert;
            n++;
          }

        });
      });
      realize_path(d, us, ob.properties, cameraData);
    });

    // draw vertices
    d.lineWidth = 1.5 / scale;
    if (mode != "Pan") {
      d.strokeStyle = "#333";
      d.fillStyle = "#ffd";
      let vert_size = 5 / scale;
      arcs_to_draw_vertices_for.forEach(arc => {
        arc.forEach(({ point: vert, z }: Zpoint, n: number) => {
          if (z > 1000000 || zoom_of_camera(cameraData) > 10) {
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
    realize_salient(d, salient.props, cameraData, salient.pt);
  });

  // render labels
  if (zoom_of_camera(cameraData) < 1) return;
  d.lineJoin = "round";
  tsearch(labelStore.label_rt, bbox_in_world).forEach(x => {
    draw_label(d, cameraData, labelStore.labels[x]);
  });
}

export function getAvtPoint(arcStore: ArcStore, avt: ArcVertexTarget): Point {
  return arcStore.avtPoint(avt);
}

function get_arc_vertex_targets(arcStore: ArcStore, world_bbox: ArRectangle): ArcVertexTarget[] {
  const ptargets = tsearch(arcStore.point_rt, world_bbox);
  const targets: ArcVertexTarget[] = ptargets.map(ptId => ({ ptId }));

  if (targets.length < 2) return targets;

  const orig = getAvtPoint(arcStore, targets[0]);
  for (let i = 1; i < targets.length; i++) {
    let here = getAvtPoint(arcStore, targets[i]);
    // If we're getting a set of points not literally on the same
    // point, pretend there's no match
    if (orig.x != here.x) return [];
    if (orig.y != here.y) return [];
  }
  // Otherwise return the whole set
  return targets;
}

function get_label_targets(labelStore: LabelStore, world_bbox: ArRectangle): LabelTarget[] {
  const targets = tsearch(labelStore.label_rt, world_bbox);
  if (targets.length < 2)
    return targets;
  else
    return [];
}

export function getTargets(world_bbox: ArRectangle, arcStore: ArcStore, labelStore: LabelStore): Target[] {
  const arcts = get_arc_vertex_targets(arcStore, world_bbox).map(x => ["coastline", x] as ["coastline", ArcVertexTarget]);
  const labts = get_label_targets(labelStore, world_bbox).map(x => ["label", x] as ["label", LabelTarget]);
  return ([] as Target[]).concat(arcts, labts);
}
