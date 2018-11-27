import { Point, Dict, RawLabel, Label, LabelTarget, Bush } from './types';
import { vmap, vkmap, rawOfLabel, unrawOfLabel, insertPt, removePt } from './util';
import * as rbush from 'rbush';

export class LabelStore {
  labels: Dict<Label>;
  label_rt: Bush<LabelTarget>;

  constructor(labels: Dict<RawLabel>) {
    this.labels = vkmap(labels, unrawOfLabel);
    this.rebuild();
  }

  rebuild() {
    this.label_rt = rbush(10);
    Object.entries(this.labels).forEach(([k, p]) => {
      insertPt(this.label_rt, p.pt, p.name);
    });
  }

  // MUTATES
  replace_vertex(name: string, p: Point) {
    const lab = this.labels[name];
    removePt(this.label_rt, lab.pt);
    lab.pt = p;
    insertPt(this.label_rt, lab.pt, name);
  }

  add_point_feature(lab: Label) {
    this.labels[lab.name] = lab;
    console.log("adding pt " + JSON.stringify(lab), lab.name, { x: lab.pt.x, y: lab.pt.y, w: 0, h: 0 });
    insertPt(this.label_rt, lab.pt, lab.name);
  }

  replace_point_feature(lab: Label) {
    console.log(lab);
    this.labels[lab.name] = lab;
  }

  model(): { labels: Dict<RawLabel> } {
    return { labels: vmap(this.labels, rawOfLabel) };
  }
}
