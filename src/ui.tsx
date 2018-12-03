import * as React from 'react';
import { UIState } from './types';

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
  return <div className="sidebar">
    {radio("road", "Road")}
    {radio("boundary", "Boundary")}
    {radio("river", "River")}
  </div>;
}
