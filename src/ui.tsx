import * as React from 'react';
import { UIState } from './types';
import { useRef, useLayoutEffect, useState } from 'react';

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

export function renderUi(s: UIState, dispatch: () => void): JSX.Element {

  function radio(k: keyof UIState['layers'], hs: string): JSX.Element {
    function change<T>(e: React.ChangeEvent<T>): void {
      s.layers[k] = !s.layers[k];
      dispatch();
    }
    return <span>
      <input type="checkbox" id={k}
        onChange={change} checked={s.layers[k]} /> <label htmlFor={k}>{hs} layer </label>
      <br />
    </span >

  }
  const x = 3;
  return <span>
    <CanvasComp height={innerHeight} width={innerWidth / 10} state={s} />
    <div className="sidebar">
      {radio("road", "Road")}
      {radio("boundary", "Boundary")}
      {radio("river", "River")}
    </div>
  </span>;
}
