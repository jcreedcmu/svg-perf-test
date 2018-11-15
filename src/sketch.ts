import { Layer, Ctx, Camera, ArRectangle, SmPoint } from './types';

type Path = SmPoint[];
type Sketches = Path[];

export class SketchLayer {
  sketches: Sketches;

  constructor(sketches: Sketches) {
    this.sketches = sketches || [];
  }

  render(d: Ctx, camera: Camera, locus: any, world_bbox: ArRectangle): void {
    var ms = this.sketches;

    d.save();
    d.translate(camera.x, camera.y);
    d.scale(camera.scale(), -camera.scale());
    d.lineCap = "round";
    d.lineJoin = "round";
    ms.forEach(feature => {
      d.beginPath();
      feature.forEach((pt, n) => {
        if (n == 0)
          d.moveTo(pt[0], pt[1]);
        else
          d.lineTo(pt[0], pt[1]);
      });

      d.lineWidth = 1.1 / camera.scale();
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

  model() {
    return {
      sketches: this.sketches.map(sketch => {
        return sketch.map(pt => [pt[0], pt[1]]);
      })
    };
  }
}
