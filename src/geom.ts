import { Point, Poly, Dict, Arc, Bbox, ArcSpec, Segment } from './types';
import { getArc } from './util';

function bbox_test_with_slack(p: Point, bbox: Bbox, slack: number): boolean {
  return (p.x + slack > bbox.minX && p.y + slack > bbox.minY &&
    p.x - slack < bbox.maxX && p.y - slack < bbox.maxY);
}

export function find_hit_lines(
  p: Point,
  candidate_features: Poly[],
  arcs: Dict<Arc>,
  slack: number
): Segment[] {
  // d.save();
  // d.translate(camera.x, camera.y);
  // d.scale(camera.scale(), -camera.scale());
  // d.fillStyle = "black";
  // d.fillRect(p.x, p.y, 10 / camera.scale(), 10 / camera.scale());
  const segment_targets = [];
  for (let i = 0; i < candidate_features.length; i++) {
    const feat = candidate_features[i];
    const farcs = feat.arcs;
    for (let j = 0; j < farcs.length; j++) {
      const arc = arcs[farcs[j].id];
      const bbox = arc.bbox;
      if (!bbox_test_with_slack(p, bbox, slack))
        continue;
      const apts = arc.points;
      for (let k = 0; k < apts.length - 1; k++) {
        // d.beginPath();
        const r = apts[k].point;
        const s = apts[k + 1].point;
        // project p onto r --- s;

        // z = r * (1-t) + s * t;
        // minimize (z - p)^2 = (zx - px)^2 + (zy - py)^2
        // 2 (rx (1-t) + sx t - px) (sx - rx) +
        // 2 (ry (1-t) + sy t - py) (sy - ry) +
        // = 0
        // t = (p - r) * (s - r) / (s - r)^2
        const t = ((p.x - r.x) * (s.x - r.x) + (p.y - r.y) * (s.y - r.y)) /
          ((s.x - r.x) * (s.x - r.x) + (s.y - r.y) * (s.y - r.y));
        if (0 < t && t < 1) {
          // projected point
          const pp = {
            x: r.x * (1 - t) + s.x * t,
            y: r.y * (1 - t) + s.y * t
          };
          const proj_distance = Math.sqrt((pp.x - p.x) * (pp.x - p.x) + (pp.y - p.y) * (pp.y - p.y));
          if (proj_distance > slack) {
            // d.moveTo(p.x, p.y);
            // d.lineTo(pp.x, pp.y);
            // d.strokeStyle = "red";
            // d.lineWidth = 1 / camera.scale();
            // d.stroke();
          }
          else {
            segment_targets.push({ arc_id: farcs[j].id, ix: k });
            // d.moveTo(r.x, r.y);
            // d.lineTo(s.x, s.y);
            // d.strokeStyle = "blue";
            // d.lineWidth = 5 / camera.scale();
            // d.stroke();
          }
        }
      }
    }
  }
  //  d.restore();
  return segment_targets;
}
