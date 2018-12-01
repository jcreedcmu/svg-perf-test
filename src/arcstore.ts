import { Segment, Point, Dict, Arc, Poly, RawArc, RawPoly, Zpoint, ArcSpec, Bbox, PolyProps } from './types';
import { ArcVertexTarget, Bush } from './types';
import { rawOfPoly, unrawOfPoly } from './util';
import { vkmap, vmap, trivBbox, insertPt, removePt } from './util';
import * as simplify from './simplify';
import * as rbush from 'rbush';
import { Gpoint, Gzpoint } from './types';

function rawOfArc(arc: Arc): RawArc {
  return {
    points: arc._points.map(({ point: p }) => {
      if ('id' in p) {
        return p;
      }
      else {
        const z: [number, number] = [p.x, p.y];
        return z;
      }
    })
  };
}

function unrawOfArc(name: string, arc: RawArc): Arc {
  const { points } = arc;
  return {
    name,
    bbox: { minX: 1e9, minY: 1e9, maxX: -1e9, maxY: -1e9 },
    _points: points.map(p => {
      if ('id' in p) {
        return { point: p, z: 1e9 };
      }
      else {
        return { point: { x: p[0], y: p[1] }, z: 1e9 };
      }
    })
  };
}

export class ArcStore {
  features: Dict<Poly>;
  arcs: Dict<Arc>;
  rt: Bush<Poly>;
  vertex_rt: Bush<ArcVertexTarget>;
  arc_to_feature: Dict<string[]> = {};

  constructor(arcs: Dict<RawArc>, polys: Dict<RawPoly>) {
    this.features = vkmap(polys, unrawOfPoly);
    this.arcs = vkmap(arcs, unrawOfArc);
    this.rebuild();
  }

  forArcs(f: (an: string, arc: Arc) => void) {
    Object.entries(this.arcs).forEach(([an, arc]) => f(an, arc));
  }

  forFeatures(f: (k: string, obj: Poly) => void) {
    Object.entries(this.features).forEach(([k, obj]) => f(k, obj));
  }

  // A generalized point could be a literal point, or a reference.
  // Return its actual value one way or the other.
  bounce(gp: Gpoint): Point {
    if ('id' in gp) {
      // should look this up in pointstore or whatever
      throw "unimplemented";
    }
    else {
      return gp;
    }
  }

  zbounce(gp: Gzpoint): Zpoint {
    return { point: this.bounce(gp.point), z: gp.z };
  }

  arcPoints(arc: Arc): Zpoint[] {
    return arc._points.map(x => this.zbounce(x));
  }

  getPoints(arcName: string): Point[] {
    return this.arcPoints(this.arcs[arcName]).map(x => x.point);
  }

  getArc(spec: ArcSpec) {
    const arc = this.arcs[spec.id];
    const pts = this.arcPoints(arc);
    const pts2 = spec.rev ? [...pts].reverse() : pts;
    return { bbox: arc.bbox, points: pts2 };
  }

  getFeature(name: string) {
    return this.features[name];
  }

  // MUTATES
  addArc(name: string, points: Point[]): Arc {
    const a: Arc = {
      name,
      _points: simplify.simplify(points),
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
    this.rt = rbush(10);
    this.vertex_rt = rbush(10);

    // compute arc z-coords and bboxes
    this.forArcs((an, arc) => {
      this.arcPoints(arc).forEach(({ point }, pn) => {
        insertPt(this.vertex_rt, point, { arc: an, point });
      });
      simplify.resimplify_arc(this, arc);
    });

    // compute feature bboxes
    this.forFeatures((key, object) => {
      simplify.compute_bbox(object, this);
      const bb = object.bbox;
      this.rt.insert({ ...bb, payload: object });
    });

    // compute reverse mapping from arcs to features
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
    arc._points.splice(segment.ix + 1, 0, newp);
    simplify.resimplify_arc(this, arc);

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
    const new_pt = arc._points[vert_ix] = { point: p, z: 1000 };

    simplify.resimplify_arc(this, arc);
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
