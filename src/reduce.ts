import { LabType, UIState } from './types';
import { produce } from 'immer';
import * as t from './types';

export function reduce(state: UIState, r: t.Result): UIState {
  function sanitize(s: string): LabType {
    if (s == "park" || s == "city" || s == "region" || s == "sea" || s == "minorsea" || s == "river")
      return s;
    return "region";
  }

  const { mode } = state;
  switch (r.t) {
    case "FeatureModalOk": {
      throw new Error(`FeatureModalOk action unimplemented`);
      // if (mode.t == "feature-modal") {
      //   this.coastline_layer.add_arc_feature("Polygon", mode.points, { t: "boundary" });
      //   state.mode = { t: "normal" };
      // }
      // else {
      //   throw (`unsupported action FeatureModalOk when uistate is ${state}`);
      // }
    } break;
    case "LabelModalOk": {
      throw new Error(`LabelModalOk action unimplemented`);
      // if (mode.t == "label-modal") {
      //   const v = mode.v;
      //   if (mode.status.isNew)
      //     this.coastline_layer.new_point_feature({
      //       name: v.text,
      //       pt: mode.status.pt,
      //       properties: {
      //         label: sanitize(v.tp),
      //         text: v.text,
      //         zoom: parseInt(v.zoom),
      //       }
      //     });
      //   else
      //     this.coastline_layer.labelStore.replace_point_feature({
      //       name: mode.status.prev.name,
      //       pt: mode.status.prev.pt,
      //       properties: {
      //         label: sanitize(v.tp),
      //         text: v.text,
      //         zoom: parseInt(v.zoom),
      //       }
      //     });

      //   state.mode = { t: "normal" };
      // }
      // else {
      //   console.log(`unsupported action FeatureModalOk when uistate is ${state}`);
      // }
    } break;
    case "LabelModalChange":
      throw new Error(`LabelModalChange action unimplemented`);
    // if (mode.t == "label-modal") {
    //   mode.v = r.lm; // MUTATES
    // }
    // else {
    //   throw (`unsupported action LabelModalChange when uistate is ${state}`);
    // } break;
    case "FeatureModalCancel":
    case "LabelModalCancel":
      return produce(state, s => {
        s.mode = { t: "normal" };
      });
    case "RadioToggle":
      return produce(state, s => {
        s.layers[r.k] = !state.layers[r.k];
      });
  }

}


// this.render();
