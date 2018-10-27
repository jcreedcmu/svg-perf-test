import stringify = require('canonical-json');
import { readFileSync, writeFileSync } from 'fs';
import * as path from 'path';
import { Geo, Image, Images, Obj, Sketches } from '../src/types';
import { vmap } from '../src/util';

function iSketches(x: any): Sketches {
  console.log(x);
  return x;
}

function iObjects(x: any): Obj[] {
  return x;
}
function iImages(x: any): Images {
  function iImage(z: any): Image {
    const { scale, x, y } = z;
    return { scale, x, y };
  }
  return vmap(x, iImage);
}

function iGeo(x: any): Geo {
  const { counter, images, objects, sketches } = x;
  return {
    counter: counter + 0,
    images: iImages(images),
    objects: iObjects(objects),
    sketches: iSketches(sketches),
  };
}

const geo = JSON.parse(readFileSync(path.join(__dirname, '../data/geo.json'), 'utf8'));
writeFileSync('/tmp/geo.json', stringify(iGeo(geo), null, 2), 'utf8');
