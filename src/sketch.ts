import { Mode, Layer, Ctx, ArRectangle, Zpoint, RenderCtx } from './types';
import { cscale } from './util';

type Path = Zpoint[];
type Sketches = Path[];

export class SketchLayer implements Layer {
  sketches: Sketches;

  constructor(sketches?: Sketches) {
    this.sketches = sketches || [];
  }

  render(rc: RenderCtx): void {
    const { d, camera } = rc;

    d.save();
    d.translate(camera.x, camera.y);
    d.scale(cscale(camera), -cscale(camera));
    d.lineCap = "round";
    d.lineJoin = "round";
    this.sketches.forEach(feature => {
      d.beginPath();
      feature.forEach(({ point: pt }, n) => {
        if (n == 0)
          d.moveTo(pt.x, pt.y);
        else
          d.lineTo(pt.x, pt.y);
      });

      d.lineWidth = 1.1 / cscale(camera);
      d.strokeStyle = "black";
      d.stroke();
      d.fillStyle = "black";

    });
    d.restore();
  }

  pop() {
    return this.sketches.pop();
  }

  add(path: Path) {
    this.sketches.push(path);
  }

}
