import { doZoom, incCam, inc_offset, set_offset_pres } from './camera-state';
import { LabType, UiState, Action } from './types';
import { castImmutable, produce } from 'immer';
import { vadd, vsub } from './vutil';
import { PANNING_MARGIN } from './main';

export function reduce(state: UiState, action: Action): UiState {
  function sanitize(s: string): LabType {
    if (s == "park" || s == "city" || s == "region" || s == "sea" || s == "minorsea" || s == "river")
      return s;
    return "region";
  }

  const { mode } = state;
  switch (action.t) {
    case "SetMode": {
      return produce(state, s => {
        s.mode = action.mode;
      });
    }
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
        s.layers[action.k] = !state.layers[action.k];
      });
    case "setCameraData":
      return produce(state, s => {
        s.cameraData = action.camera;
      });
    case 'mouseDown': {
      console.log('mouseDown', action.p_in_page);
      const newCameraData = set_offset_pres(state.cameraData, { x: -PANNING_MARGIN, y: -PANNING_MARGIN });
      return produce(state, s => {
        s.mouseState = {
          t: 'pan',
          orig_p_in_page: action.p_in_page,
          p_in_page: action.p_in_page,
          cameraData: newCameraData,
        };
      });
    }
    case 'mouseUp': {
      const ms = state.mouseState;
      if (ms.t != 'pan')
        return produce(state, s => { s.mouseState = { t: 'up' }; });
      const delta = vsub(ms.p_in_page, ms.orig_p_in_page);
      const newCam = incCam(state.cameraData, delta.x, delta.y);
      return produce(state, s => {
        s.cameraData = newCam;
        s.mouseState = { t: 'up' };
      });
    }
    case 'mouseMove': {
      const ms = state.mouseState;
      if (ms.t != 'pan')
        return state;

      let newCamera = inc_offset(ms.cameraData, vsub(action.p_in_page, ms.p_in_page));

      const newMs = produce(ms, s => {
        s.p_in_page = action.p_in_page;
        s.cameraData = newCamera;
      });

      return produce(state, s => {
        s.mouseState = newMs;
      });

    }
    case 'doZoom': {
      const cameraData = doZoom(state.cameraData, action.p_in_canvas, action.zoom_amount);
      return produce(state, s => {
        s.cameraData = cameraData;
      });
    }
    case 'setCurrentImage': {
      console.log('setCurrentImage', action.ix);
      return produce(state, s => {
        s.imageLayerState.cur_img_ix = action.ix;
        s.imageLayerState.overlay = null;
      });
    }
    case 'setOverlayImage': {
      console.log('setOverlay');
      return produce(state, s => {
        s.imageLayerState.overlay = 'render';
      });
    }
  }

}


// this.render();
