import * as React from 'react';
import { UIState, LabelUIMode, FeatureModalResult, LabelModalResult, Result } from './types';
import { useRef, useLayoutEffect, useState } from 'react';
import { nope } from './util';
import * as ReactBootstrap from 'react-bootstrap';
import { Modal, Button } from 'react-bootstrap';

export const SIDEBAR_WIDTH = 200;

function CanvasComp(props: { state: UIState, height: number, width: number }): JSX.Element {
  const { state, height, width } = props;
  console.log('rendering');
  const canvas: React.MutableRefObject<HTMLCanvasElement | null> = useRef(null);
  const [toggle, setToggle] = useState(true);
  useLayoutEffect(() => {
    if (canvas.current == null) return;
    const d = canvas.current.getContext('2d');
    if (d == null) return;
    d.clearRect(0, 0, 100, 100);
    if (toggle)
      d.fillRect(0, 0, 100, 100);
  }, [state, toggle]);

  function mouse(e: React.MouseEvent<HTMLCanvasElement>): void {
    setToggle(t => !t);
  }
  return <canvas height={height} width={width} className="debug" ref={canvas}
    onMouseDown={mouse} />;
}


function FeatureModal(props: { us: UIState, dispatch: (r: FeatureModalResult) => void }) {
  const { us, dispatch } = props;
  const [text, setText] = useState("");
  const [tp, setTp] = useState("region");
  const [zoom, setZoom] = useState("4");
  const dismiss = () => dispatch({ t: "FeatureModalCancel" });
  const submit = () => dispatch({
    t: "FeatureModalOk", v: { text, tp, zoom }
  });

  return <Modal show={us.mode.t == "feature-modal"} onHide={dismiss}>
    <Modal.Header closeButton>
      <Modal.Title>Add Feature</Modal.Title>
    </Modal.Header>
    <Modal.Body>
      <form>
        <div className="modal-body">
          <div className="form-group">
            <label htmlFor="text">Text</label>
            <input type="text" className="form-control" name="text" placeholder="erla-otul"
              value={text} onChange={e => setText(e.target.value)} />
          </div>
          <div className="form-group">
            <label htmlFor="type">Type</label>
            <input type="text" className="form-control" name="type" placeholder="region"
              value={tp} onChange={e => setTp(e.target.value)} />
          </div>
          <div className="form-group">
            <label htmlFor="zoom">Zoom</label>
            <input type="text" className="form-control" name="zoom"
              placeholder={zoom} onChange={e => setZoom(e.target.value)} />
          </div>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-default" onClick={dismiss}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={submit}>Ok</button>
        </div>
      </form>
    </Modal.Body>
  </Modal>;
}

function LabelModal(props: { us: UIState, dispatch: (r: LabelModalResult) => void }): JSX.Element {
  const { us, dispatch } = props;

  const v =
    us.mode.t == "label-modal" ?
      us.mode.v :
      { text: "", zoom: "", tp: "" };

  const { text, zoom, tp } = v;
  const dismiss = () => dispatch({ t: "LabelModalCancel" });
  const submit = () => dispatch({ t: "LabelModalOk" });
  function change(f: (l: LabelUIMode) => LabelUIMode): void {
    dispatch({ t: "LabelModalChange", lm: f(v) });
  }
  return <Modal show={us.mode.t == "label-modal"} onHide={dismiss}>
    <Modal.Header closeButton>
      <Modal.Title>Add Label</Modal.Title>
    </Modal.Header>
    <Modal.Body>
      <form>
        <div className="modal-body">
          <div className="form-group">
            <label htmlFor="text">Text</label>
            <input type="text" className="form-control" name="text" placeholder="erla-otul"
              value={text} onChange={e => change(z => ({ ...z, text: e.target.value }))} />
          </div>
          <div className="form-group">
            <label htmlFor="type">Type</label>
            <input type="text" className="form-control" name="type" placeholder="region"
              value={tp} onChange={e => change(z => ({ ...z, tp: e.target.value }))} />
          </div>
          <div className="form-group">
            <label htmlFor="zoom">Zoom</label>
            <input type="text" className="form-control" name="zoom" placeholder="4"
              value={zoom} onChange={e => change(z => ({ ...z, zoom: e.target.value }))} />
          </div>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-default" onClick={dismiss}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={submit}>Ok</button>
        </div>
      </form>
    </Modal.Body>
  </Modal>;
}

export function renderUi(s: UIState, dispatch: (r: Result) => void): JSX.Element {

  function radio(k: keyof UIState['layers'], hs: string): JSX.Element {
    function change<T>(e: React.ChangeEvent<T>): void {
      dispatch({ t: "RadioToggle", k });
    }
    return <span>
      <input type="checkbox" id={k}
        onChange={change} checked={s.layers[k]} /> <label htmlFor={k}>{hs} layer </label>
      <br />
    </span >
  }

  //     <CanvasComp height={innerHeight} width={innerWidth / 10} state={s} />

  const style = {
    width: SIDEBAR_WIDTH,
  };
  return <span>
    <div className="sidebar" style={style}>
      {radio("road", "Road")}
      {radio("boundary", "Boundary")}
      {radio("river", "River")}
    </div>
    <FeatureModal us={s} dispatch={dispatch} />
    <LabelModal us={s} dispatch={dispatch} />
  </span>;


}
