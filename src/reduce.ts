import { produce } from 'immer';
import { PANNING_MARGIN, doZoom, incCam, inc_offset, set_offset_pres } from './camera-state';
import { Action, Geometry, LabType, MouseDownAction, Target, UiState } from './types';
import { vsub } from './vutil';

export function reduceMouseDown(state: UiState, action: MouseDownAction, geo: Geometry): UiState {
  console.log('mouseDown', action.p_in_page);
  const { mode } = state;
  switch (mode.t) {
    case 'normal': {
      const { tool } = mode;
      switch (tool) {
        case 'Pan':
          const newCameraData = set_offset_pres(state.cameraData, { x: -PANNING_MARGIN, y: -PANNING_MARGIN });
          return produce(state, s => {
            s.mouseState = {
              t: 'pan',
              orig_p_in_page: action.p_in_page,
              p_in_page: action.p_in_page,
              cameraData: newCameraData,
            };
          });
        case 'Measure': {
          return produce(state, s => {
            s.mouseState = {
              t: 'measure',
              orig_p_in_page: action.p_in_page,
              p_in_page: action.p_in_page,
            };
          });
        }
        case 'Label': {
          if (state.lastz.length > 0) {
            const target = state.lastz[0];
            if (target[0] == 'label') {
              const lab = geo.labelStore.labels[target[1]];
              const v = {
                text: lab.properties.text,
                tp: lab.properties.label,
                zoom: lab.properties.zoom + '',
              };
              console.log(v);
              return produce(state, s => {
                s.mode = { t: 'label-modal', status: { isNew: false, prev: lab }, v, prev: state.mode };
              });
            }
            else {
              return state;
            }
          }
          else {
            return produce(state, s => {
              s.mode = {
                t: 'label-modal', status: { isNew: true, pt: action.p_in_page /* WRONG */ },
                v: {
                  text: '',
                  tp: 'region',
                  zoom: '4',
                },
                prev: state.mode
              }
            });
          }
        }
        default: return state;
      }
    }
    case 'label-modal': return state;
    case 'feature-modal': return state;
  }
}
export function reduce(state: UiState, action: Action, geo: Geometry): UiState {
  function sanitize(s: string): LabType {
    if (s == "park" || s == "city" || s == "region" || s == "sea" || s == "minorsea" || s == "river")
      return s;
    return "region";
  }

  const { mode } = state;
  switch (action.t) {
    case "setMode": {
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
      const mode = state.mode;
      if (mode.t != 'label-modal') {
        throw new Error(`Tried to Ok out of modal we're not in`);
      }
      console.log(action.result);
      return produce(state, s => {
        s.mode = mode.prev;
      });
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

    case "FeatureModalCancel":
    case "LabelModalCancel":
      const mode = state.mode;
      if (mode.t != 'label-modal' && mode.t != 'feature-modal') {
        throw new Error(`Tried to cancel out of modal we're not in`);
      }
      return produce(state, s => {
        s.mode = mode.prev;
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
      return reduceMouseDown(state, action, geo);
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
      switch (ms.t) {
        case 'pan':
          let newCamera = inc_offset(ms.cameraData, vsub(action.p_in_page, ms.p_in_page));

          const newMs = produce(ms, s => {
            s.p_in_page = action.p_in_page;
            s.cameraData = newCamera;
          });

          return produce(state, s => {
            s.mouseState = newMs;
          });
        case 'up': {
          return state;
        }
        case 'measure': {
          const newMs = produce(ms, s => {
            s.p_in_page = action.p_in_page;
          });

          return produce(state, s => {
            s.mouseState = newMs;
          });
        }
      }
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
      return produce(state, s => {
        s.imageLayerState.overlay = 'render';
      });
    }
    case 'setHighlight': {
      const h = action.highlight;
      const newLastz: Target[] = h == undefined ? [] : [h];
      const newSlastz: string = JSON.stringify(newLastz);
      return produce(state, s => {
        s.lastz = newLastz;
        s.slastz = newSlastz;
      });
    }
    case 'multiple': {
      let st = state;
      for (const a of action.actions) {
        st = reduce(st, a, geo);
      }
      return st;
    }
  }
}
