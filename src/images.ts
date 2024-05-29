import { Mode, Layer, Ctx, Camera, ArRectangle, Point, SizedImage, Images, RenderCtx, Dict } from './types';
import { cscale, Buffer, buffer } from './util';

export function image_url(img_name: string): string {
  return '/img/' + img_name + '.png';
}

// mathematically correct mod
function mod(n: number, m: number): number {
  if (n > 0)
    return n % m
  else
    return ((n % m) + m) % m
}

type NamedImage = SizedImage & { name: string };

export class ImageLayer implements Layer {
  dispatch: () => void;
  named_imgs: NamedImage[];
  overlay: HTMLImageElement;
  cur_img_ix: number;

  constructor(dispatch: () => void, cur_img_ix: number, imgs: Images) {
    const named_imgs: NamedImage[] = Object.entries(imgs).map(pair => {
      return { ...pair[1], name: pair[0] };
    });
    this.dispatch = dispatch;
    this.named_imgs = named_imgs;
    this.cur_img_ix = cur_img_ix;
    this.overlay = new Image();
  }

  render(rc: RenderCtx): void {
    const { d, camera } = rc;
    const nimg = this.named_imgs[this.cur_img_ix];
    d.save();
    d.translate(camera.x, camera.y);
    d.scale(cscale(camera), cscale(camera));
    d.globalAlpha = 0.25;
    const ovr = this.overlay;
    if (ovr != null) {
      d.imageSmoothingEnabled = false;
      d.drawImage(ovr, 0, 0, ovr.width,
        ovr.height, nimg.x, -nimg.y + ovr.height * nimg.scale,
        ovr.width * nimg.scale,
        -ovr.height * nimg.scale);
      d.globalAlpha = 0.5;
      d.beginPath();
      d.moveTo(0, -nimg.y);
      d.lineTo(3807232, -nimg.y);
      d.moveTo(nimg.x, 0);
      d.lineTo(nimg.x, -3226521);

      d.strokeStyle = "blue";
      d.lineWidth = 1 / cscale(camera);
      d.stroke();
      d.strokeRect(nimg.x, -nimg.y + ovr.height * nimg.scale,
        ovr.width * nimg.scale,
        -ovr.height * nimg.scale);
    }

    d.restore();
  }

  reload_img(img_ix: number): void {
    this.cur_img_ix = img_ix;
    if (this.overlay == undefined) {
      this.overlay = new Image();
    }

    this.overlay.src = image_url(this.named_imgs[img_ix].name);
    this.overlay.onload = () => {
      this.dispatch();
    }
  }

  prev() {
    this.cur_img_ix = mod(this.cur_img_ix - 1, this.named_imgs.length);
    this.reload_img(this.cur_img_ix);
  }

  next() {
    this.cur_img_ix = mod(this.cur_img_ix + 1, this.named_imgs.length);
    this.reload_img(this.cur_img_ix);
  }

  scale(by: number) {
    const img_state = this.named_imgs[this.cur_img_ix];
    img_state.scale *= by;
  }

  get_pos() {
    const img_state = this.named_imgs[this.cur_img_ix];
    return { x: img_state.x, y: img_state.y };
  }

  get_img_state(): { x: number, y: number, scale: number } {
    return this.named_imgs[this.cur_img_ix];
  }

  get_image_data(): ImageData {
    // XXX repaints the same image every time
    const im = this.overlay;
    console.log('get_image_data', im.width, im.height);
    const buf = buffer({ x: im.width, y: im.height });
    buf.d.drawImage(im, 0, 0);
    const rv = buf.d.getImageData(0, 0, im.width, im.height);
    return rv;
  }

  set_pos(p: Point) {
    const img_state = this.named_imgs[this.cur_img_ix];
    img_state.x = p.x;
    img_state.y = p.y;
  }

  model(): { images: Images } {
    const images: Dict<SizedImage> = {};
    this.named_imgs.forEach(obj => {
      const { name, ...rest } = obj;
      images[obj.name] = rest;
    });
    return { images };
  }

}
