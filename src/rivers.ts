import { colors } from './colors';
import { Layer, RenderCtx, Rivers } from './types';
import { canvasIntoWorld } from './util';

export class RiverLayer implements Layer {
  rivers: Rivers;

  constructor(rivers: Rivers) {
    this.rivers = rivers;
  }

  render(rc: RenderCtx): void {
    const { d, cameraData, us } = rc;
    if (!us.layers.river)
      return;
    d.save();
    canvasIntoWorld(d, cameraData);
    d.lineCap = "round";
    d.lineJoin = "round";
    this.rivers.features.forEach((feature) => {
      d.beginPath();
      feature.geometry.coordinates.forEach((obj) => {
        obj.forEach((pt, n) => {
          if (n == 0)
            d.moveTo(pt[0], pt[1]);
          else
            d.lineTo(pt[0], pt[1]);
        });
      });
      d.fillStyle = colors.ocean;
      d.globalAlpha = 0.2;
      d.fillStyle = "blue";
      d.fill();
    });
    d.restore();
  }

  model() {
    return {};
  }
}
