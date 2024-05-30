import { scale_of_camera } from './camera-state';
import { Layer, RenderCtx, Zpoint } from './types';
import { canvasIntoWorld } from './util';

type Path = Zpoint[];
type Sketches = Path[];

export class SketchLayer implements Layer {
  sketches: Sketches;

  constructor(sketches?: Sketches) {
    this.sketches = sketches || [];
  }

  render(rc: RenderCtx): void {
    const { d, cameraData } = rc;

    d.save();
    canvasIntoWorld(d, cameraData);
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

      d.lineWidth = 1.1 / scale_of_camera(cameraData);
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
