import WarningRoundedIcon from '@mui/icons-material/WarningRounded';
import Button from '@mui/joy/Button';
import DialogActions from '@mui/joy/DialogActions';
import DialogContent from '@mui/joy/DialogContent';
import DialogTitle from '@mui/joy/DialogTitle';
import Divider from '@mui/joy/Divider';
import Modal from '@mui/joy/Modal';
import ModalDialog from '@mui/joy/ModalDialog';
import FormControl from '@mui/joy/FormControl';
import FormLabel from '@mui/joy/FormLabel';
import FormHelperText from '@mui/joy/FormHelperText';
import Input from '@mui/joy/Input';
import Stack from '@mui/joy/Stack';
import * as React from 'react';
import { mkCameraData } from './camera-state';
import { image_url } from './images';
import { MapCanvas } from './map-canvas';
import { OverlayCanvas } from './overlay-canvas';
import { reduce } from './reduce';
import { Action, Dict, Geometry, ImageLayerState, LabelModalResult, LabelModalState, NamedImage, SizedImage, UiState } from './types';

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

const modalStyle: any = {
  position: 'absolute' as 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: 400,
  bgcolor: 'background.paper',
  border: '2px solid #000',
  boxShadow: 24,
  pt: 2,
  px: 4,
  pb: 3,
};


function LabelModal(props: { us: UiState, dispatch: (r: LabelModalResult) => void }): JSX.Element {
  const { us, dispatch } = props;

  const open = us.mode.t == 'label-modal';
  const v =
    us.mode.t == "label-modal" ?
      us.mode.v :
      { text: "", zoom: "", tp: "" };

  const [state, setState] = React.useState<LabelModalState>(v);
  const { text, zoom, tp } = state;

  const dismiss = () => dispatch({ t: "LabelModalCancel" });
  const submit = () => dispatch({ t: "LabelModalOk", result: state });
  function change(f: (l: LabelModalState) => LabelModalState): void {
    setState(f);
  }
  return <Modal open={open}>
    <ModalDialog variant="outlined" role="alertdialog">
      <DialogTitle>
        Edit Label
      </DialogTitle>
      <Divider />
      <DialogContent>
        <Stack spacing={2}>
          <FormControl>
            <FormLabel>Text</FormLabel>
            <Input placeholder="Text"
              value={text} onChange={e => change(z => ({ ...z, text: e.target.value }))}
            />
          </FormControl>

          <FormControl>
            <FormLabel>Type</FormLabel>
            <Input placeholder="Type"
              value={tp} onChange={e => change(z => ({ ...z, tp: e.target.value }))}
            />
          </FormControl>

          <FormControl>
            <FormLabel>Zoom</FormLabel>
            <Input placeholder="Zoom"
              value={zoom} onChange={e => change(z => ({ ...z, zoom: e.target.value }))}
            />
          </FormControl>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button variant="solid" color="primary" onMouseDown={submit} >
          Save
        </Button>
        <Button variant="plain" color="neutral" >
          Cancel
        </Button>
      </DialogActions>
    </ModalDialog>
  </Modal >
}

/* function LabelModal(props: { us: UiState, dispatch: (r: LabelModalResult) => void }): JSX.Element {
 *   const { us, dispatch } = props;
 *
 *   const v =
 *     us.mode.t == "label-modal" ?
 *       us.mode.v :
 *       { text: "", zoom: "", tp: "" };
 *
 *   const { text, zoom, tp } = v;
 *   const dismiss = () => dispatch({ t: "LabelModalCancel" });
 *   const submit = () => dispatch({ t: "LabelModalOk" });
 *   function change(f: (l: LabelUIMode) => LabelUIMode): void {
 *     dispatch({ t: "LabelModalChange", lm: f(v) });
 *   }
 *   //  const show = us.mode.t == "label-modal";
 *   return <Modal show={show} onHide={dismiss}>
 *     <Modal.Header closeButton>
 *       <Modal.Title>Add Label</Modal.Title>
 *     </Modal.Header>
 *     <Modal.Body>
 *       <form>
 *         <div className="modal-body">
 *           <div className="form-group">
 *             <label htmlFor="text">Text</label>
 *             <input type="text" className="form-control" name="text" placeholder="erla-otul"
 *               value={text} onChange={e => change(z => ({ ...z, text: e.target.value }))} />
 *           </div>
 *           <div className="form-group">
 *             <label htmlFor="type">Type</label>
 *             <input type="text" className="form-control" name="type" placeholder="region"
 *               value={tp} onChange={e => change(z => ({ ...z, tp: e.target.value }))} />
 *           </div>
 *           <div className="form-group">
 *             <label htmlFor="zoom">Zoom</label>
 *             <input type="text" className="form-control" name="zoom" placeholder="4"
 *               value={zoom} onChange={e => change(z => ({ ...z, zoom: e.target.value }))} />
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
    highlightTarget: undefined,
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

function onKeyDown(e: KeyboardEvent, ils: ImageLayerState, dispatch: Dispatch): void {
  switch (e.key) {
    case ',': incCurrentImage(dispatch, ils, -1); break;
    case '.': incCurrentImage(dispatch, ils, 1); break;
    case 'p': dispatch({ t: 'setMode', mode: { t: 'normal', tool: 'Pan' } }); break;
    case 'm': dispatch({ t: 'setMode', mode: { t: 'normal', tool: 'Move' } }); break;
    case 'e': dispatch({ t: 'setMode', mode: { t: 'normal', tool: 'Measure' } }); break;
  }
}

export function MainUi(props: MainUiProps): JSX.Element {
  const { geo, images } = props;

  const initState = mkUiState(images);
  const [state, dispatch] = React.useReducer<(s: UiState, a: Action) => UiState>(reduce, initState);

  const keyHandler = (e: KeyboardEvent) => onKeyDown(e, state.imageLayerState, dispatch);
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
    <LabelModal us={state} dispatch={dispatch} />
  </div>;
  //
  {/* <FeatureModal us={state} dispatch={dispatch} />

	 */}
}
