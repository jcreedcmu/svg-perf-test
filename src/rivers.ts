import { Mode, Layer, Ctx, Camera, ArRectangle, ArPoint } from './types';
import { cscale } from './util';

type River = { geometry: { coordinates: ArPoint[][] } };
type Rivers = { features: River[] };

export class RiverLayer implements Layer {
  rivers: Rivers;

  constructor(rivers: Rivers) {
    this.rivers = rivers;
  }

  render(d: Ctx, camera: Camera, mode: Mode, world_bbox: ArRectangle): void {
    d.save();
    d.translate(camera.x, camera.y);
    d.scale(cscale(camera), -cscale(camera));
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
      d.fillStyle = "#bac7f8";
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
