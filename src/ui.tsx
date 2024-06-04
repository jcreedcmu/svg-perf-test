import * as React from 'react';
import { mkCameraData } from './camera-state';
import { image_url } from './images';
import { MapCanvas } from './map-canvas';
import { OverlayCanvas } from './overlay-canvas';
import { reduce } from './reduce';
import { Action, Dict, Geometry, ImageLayerState, NamedImage, SizedImage, UiState } from './types';
import { LabelModal } from './label-modal';

export const SIDEBAR_WIDTH = 200;

/* function FeatureModal(props: { us: UiState, dispatch: (r: FeatureModalResult) => void }) {
 *   const { us, dispatch } = props;
 *   const [text, setText] = useState("");
 *   const [tp, setTp] = useState("region");
 *   const [zoom, setZoom] = useState("4");
 *   const dismiss = () => dispatch({ t: "FeatureModalCancel" });
 *   const submit = () => dispatch({
 *     t: "FeatureModalOk", v: { text, tp, zoom }
 *   });
 *
 *   return <Modal show={us.mode.t == "feature-modal"} onHide={dismiss}>
 *     <Modal.Header closeButton>
 *       <Modal.Title>Add Feature</Modal.Title>
 *     </Modal.Header>
 *     <Modal.Body>
 *       <form>
 *         <div className="modal-body">
 *           <div className="form-group">
 *             <label htmlFor="text">Text</label>
 *             <input type="text" className="form-control" name="text" placeholder="erla-otul"
 *               value={text} onChange={e => setText(e.target.value)} />
 *           </div>
 *           <div className="form-group">
 *             <label htmlFor="type">Type</label>
 *             <input type="text" className="form-control" name="type" placeholder="region"
 *               value={tp} onChange={e => setTp(e.target.value)} />
 *           </div>
 *           <div className="form-group">
 *             <label htmlFor="zoom">Zoom</label>
 *             <input type="text" className="form-control" name="zoom"
 *               placeholder={zoom} onChange={e => setZoom(e.target.value)} />
 *           </div>
 *         </div>
 *         <div className="modal-footer">
 *           <button type="button" className="btn btn-default" onClick={dismiss}>Cancel</button>
 *           <button type="button" className="btn btn-primary" onClick={submit}>Ok</button>
 *         </div>
 *       </form>
 *     </Modal.Body>
 *   </Modal>;
 * } */


export type Dispatch = (action: Action) => void;

export type MainUiProps = {
  geo: Geometry,
  images: Dict<SizedImage>,
};

function mkUiState(images: Dict<SizedImage>): UiState {
  const named_imgs: NamedImage[] = Object.entries(images).map(pair => {
    return { ...pair[1], name: pair[0] };
  });

  return {
    layers: { boundary: false, river: false, road: false },
    mode: { t: 'normal', tool: 'Pan' },
    cameraData: mkCameraData(),
    mouseState: { t: 'up' },
    imageLayerState: {
      cur_img_ix: 0,
      named_imgs,
      overlay: null,
    },
    lastz: [],
    slastz: "[]",
  };
}

function incCurrentImage(dispatch: Dispatch, ils: ImageLayerState, di: number) {
  const image = new Image();
  (window as any)._image = image;
  const { cur_img_ix, named_imgs } = ils;
  const newix = (cur_img_ix + di + named_imgs.length) % named_imgs.length;
  image.src = image_url(ils.named_imgs[newix].name)
  dispatch({ t: 'setCurrentImage', ix: newix });
  image.onload = () => {
    dispatch({ t: 'setOverlayImage' });
  }
}

function onKeyDown(state: UiState, e: KeyboardEvent, dispatch: Dispatch): void {
  if (state.mode.t == 'normal') {
    const ils = state.imageLayerState;
    switch (e.key) {
      case ',': incCurrentImage(dispatch, ils, -1); break;
      case '.': incCurrentImage(dispatch, ils, 1); break;
      case 'p': dispatch({ t: 'setMode', mode: { t: 'normal', tool: 'Pan' } }); break;
      case 'm': dispatch({ t: 'setMode', mode: { t: 'normal', tool: 'Move' } }); break;
      case 'e': dispatch({ t: 'setMode', mode: { t: 'normal', tool: 'Measure' } }); break;
      case 'l': dispatch({ t: 'setMode', mode: { t: 'normal', tool: 'Label' } }); break;
      case 'S': dispatch({ t: 'saveModel' }); break;
    }
  }
}

export function MainUi(props: MainUiProps): JSX.Element {
  const { geo, images } = props;

  const reduceWithGeo = (state: UiState, action: Action): UiState => {
    return reduce(state, action, geo);
  };

  const initState = mkUiState(images);
  const [state, dispatch] = React.useReducer<(s: UiState, a: Action) => UiState>(reduceWithGeo, initState);

  const keyHandler = (e: KeyboardEvent) => onKeyDown(state, e, dispatch);
  React.useEffect(() => {
    document.addEventListener('keydown', keyHandler);
    return () => {
      document.removeEventListener('keydown', keyHandler);
    };
  }, [state]);

  function radio(k: keyof UiState['layers'], hs: string): JSX.Element {
    function change<T>(e: React.ChangeEvent<T>): void {
      dispatch({ t: "RadioToggle", k });
    }
    return <span>
      <input type="checkbox" id={k}
        onChange={change} checked={state.layers[k]} /> <label htmlFor={k}>{hs} layer </label>
      <br />
    </span >
  }

  const style = {
    width: SIDEBAR_WIDTH,
  };

  const labelModal = state.mode.t != 'label-modal' ? undefined : <LabelModal initial={state.mode.v} dispatch={dispatch} />;

  return <div>
    <div className="sidebar" style={style}>
      {radio("road", "Road")}
      {radio("boundary", "Boundary")}
      {radio("river", "River")}
    </div>
    <div className="map-container" >
      <MapCanvas uiState={state} dispatch={dispatch} geo={geo} />
      <OverlayCanvas uiState={state} />
    </div>
    {labelModal}
  </div>;

  /* <FeatureModal us={state} dispatch={dispatch} />

    */
}
