import { Segment, Point, Dict, Arc, Poly, RawArc, RawPoly, Zpoint, ArcSpec, Bbox, PolyProps } from './types';
import { ArcVertexTarget, Bush } from './types';
import { rawOfPoly, rawOfArc, unrawOfPoly, unrawOfArc } from './util';
import { vkmap, vmap, trivBbox, insertPt, removePt } from './util';
import * as simplify from './simplify';
import * as rbush from 'rbush';

export class ArcStore {
  features: Dict<Poly>;
  arcs: Dict<Arc>;
  rt: Bush<Poly>;
  vertex_rt: Bush<ArcVertexTarget>;
  arc_to_feature: Dict<string[]> = {};

  constructor(arcs: Dict<RawArc>, polys: Dict<RawPoly>) {
    this.features = vkmap(polys, unrawOfPoly);
    this.arcs = vkmap(arcs, unrawOfArc);
    this.rt = rbush(10);
    this.vertex_rt = rbush(10);
  }

  forArcs(f: (an: string, arc: Arc) => void) {
    Object.entries(this.arcs).forEach(([an, arc]) => f(an, arc));
  }

  forFeatures(f: (k: string, obj: Poly) => void) {
    Object.entries(this.features).forEach(([k, obj]) => f(k, obj));
  }

  getPoints(arcName: string): Point[] {
    return this.arcs[arcName].points.map(x => x.point);
  }

  getArc(spec: ArcSpec) {
    const arc = this.arcs[spec.id];
    if (spec.rev)
      return { bbox: arc.bbox, points: [...arc.points].reverse() };
    else
      return { bbox: arc.bbox, points: arc.points };
  }

  getFeature(name: string) {
    return this.features[name];
  }

  // MUTATES
  addArc(name: string, points: Point[]): Arc {
    const a: Arc = {
      name,
      points: simplify.simplify(points),
      bbox: simplify.bbox_of_points(points),
    };
    Object.entries(points).forEach(([pn, point]) => {
      insertPt(this.vertex_rt, point, { arc: name, point });
    });
    this.arcs[name] = a;
    return a;
  }

  // MUTATES derived
  rebuild() {
    this.forArcs((an, arc) => {
      arc.points.forEach(({ point }, pn) => {
        insertPt(this.vertex_rt, point, { arc: an, point });
      });
      simplify.resimplify_arc(arc);
    });

    this.forFeatures((key, object) => {
      simplify.compute_bbox(object, this);
      const bb = object.bbox;
      this.rt.insert({ ...bb, payload: object });
    });

    this.forFeatures((feature_ix, object) => {
      const { arc_to_feature } = this;
      object.arcs.forEach(arc_spec => {
        const id = arc_spec.id;
        if (!arc_to_feature[id])
          arc_to_feature[id] = [];
        arc_to_feature[id].push(feature_ix);
      });
    });

  }

  // MUTATES
  addFeature(feature_name: string, arcs: { id: string }[], properties: PolyProps) {
    const feature: Poly = this.features[feature_name] =
      {
        name: feature_name,
        arcs: arcs,
        properties: properties,
        bbox: trivBbox(),
      };

    simplify.compute_bbox(feature, this);

    const bb = feature.bbox;
    this.rt.insert({ ...bb, payload: feature });
    const { arc_to_feature } = this;
    arcs.forEach(arc => {
      const name = arc.id;
      if (!arc_to_feature[name])
        arc_to_feature[name] = [];
      arc_to_feature[name].push(feature_name);
    });
  }

  // MUTATES derived
  recompute_arc_feature_bbox(arc_id: string) {
    this.arc_to_feature[arc_id].forEach((feature_ix: string) => {
      let object = this.getFeature(feature_ix);
      let bb = object.bbox;
      this.rt.remove(
        { ...bb, payload: object },
        (a, b) => a.payload == b.payload
      );
      simplify.compute_bbox(object, this);
      this.rt.insert({ ...bb, payload: object });
    });
  }

  // MUTATES
  break_segment(segment: Segment, p: Point) {
    const arc_id = segment.arc_id;
    const arc = this.arcs[arc_id];

    const newp: Zpoint = { point: p, z: 1000 };
    arc.points.splice(segment.ix + 1, 0, newp);
    simplify.resimplify_arc(arc);

    insertPt(this.vertex_rt, p, { arc: arc_id, point: newp.point });
    this.recompute_arc_feature_bbox(arc_id);
  }

  get_index(target: ArcVertexTarget) {
    const arc = this.getPoints(target.arc);
    for (let i = 0; i < arc.length; i++) {
      if (arc[i] == target.point) // this by-reference comparison is fundamentally kind of fragile
        return i;
    }
    throw ("Can't find " + JSON.stringify(target.point) + " in " + JSON.stringify(arc))
  }

  // MUTATES
  replace_vertex(rt_entry: ArcVertexTarget, p: Point) {
    const arc_id = rt_entry.arc;

    const vert_ix = this.get_index(rt_entry);
    const arc = this.arcs[arc_id];
    const oldp = rt_entry.point;

    // I think this 1000 can be whatever
    const new_pt = arc.points[vert_ix] = { point: p, z: 1000 };

    simplify.resimplify_arc(arc);
    const results = removePt(this.vertex_rt, oldp);

    insertPt(this.vertex_rt, p, { arc: arc_id, point: new_pt.point });
    this.recompute_arc_feature_bbox(arc_id);

  }

  model(): {
    polys: Dict<RawPoly>,
    arcs: Dict<RawArc>,
  } {
    const polys: Dict<RawPoly> = vmap(this.features, rawOfPoly);
    const arcs: Dict<RawArc> = vmap(this.arcs, rawOfArc);
    return { polys, arcs };
  }
}
