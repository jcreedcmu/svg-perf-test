import * as React from 'react';
import { UIState } from './types';

export function renderUi(s: UIState, dispatch: () => void): JSX.Element {

  function radio(k: keyof UIState, hs: string): JSX.Element {
    function change<T>(e: React.ChangeEvent<T>): void {
      s[k] = !s[k];
      dispatch();
    }
    return <span>
      <input type="checkbox" id={k}
        onChange={change} checked={s[k]} /> <label htmlFor={k}>{hs} layer </label>
      <br />
    </span>

  }
  const x = 3;
  return <div>
    {radio("road", "Road")}
    {radio("boundary", "Boundary")}
  </div>;
}
