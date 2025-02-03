import * as fs from 'fs';
import { createCanvas } from 'canvas';
import { render } from '../src/map-canvas-render';

const c = createCanvas(100, 100);
const d = c.getContext('2d');
d.fillStyle = 'red';
d.fillRect(0, 0, 50, 50);

const out = fs.createWriteStream('/tmp/foo.png')
const stream = c.createPNGStream()
stream.pipe(out)
out.on('finish', () => {
  console.log('done');
  process.exit(0);
});
