// Some code that generates a random pgm heightmap on stdout. Not sure
// what it was for.

var _ = require("underscore");

var size = 512;
console.log("P2 " + size + " " + size + " " + size + "");

var k = new Array(size * size);
for (var i = 0; i < size; i++) {
  for (var j = 0; j < size; j++) {
    //k[i * size + j] = (i == 128 && j == 128 || (i == 110 && j == 192)) ? 0 : 1e9;
    k[i * size + j] = Math.random() < 0.1/size ? 0 : 1e9;
  }
}


var kk = new Array(size * size);
for (var x = 0; x < size; x++) {
  for (var y = 0; y < size; y++) {
    kk[y * size + x] = k[y * size + x];
  }
}

for (var x = 0; x < size; x++) {
  var min = 1e9;
  for (var y = 0; y < size; y++) {
    min = Math.min(kk[y * size + x], min);
    kk[y * size + x] = min;
    min++;
  }
}

for (var x = 0; x < size; x++) {
  var min = 1e9;
  for (var ny = 0; ny < size; ny++) {
    var y = (size - 1) - ny;
    min = Math.min(kk[y * size + x], min);
    kk[y * size + x] = min;
    min++;
  }
}

var M = new Array(size * size);
for (var x = 0; x < size; x++) {
  for (var y = 0; y < size; y++) {
    M[y * size + x] = 0;
  }
}

function f(p1, p2) {
  return ((p1.y*p1.y - p2.y*p2.y) + (p1.x*p1.x - p2.x*p2.x)) / (2 * (p1.x - p2.x));
}

for (var y = 0; y < size; y++) {
  var Y = y * size;
  var points = [{x: 0, y: kk[Y]}];
  var boundaries = [];
  for (var x = 1; x < size; x++) {
    var newpt = {x:x, y: kk[Y + x]};
    var new_boundary;
    while(1) {
      var last = points[points.length - 1];
      new_boundary = f(last, newpt);
      if (!boundaries.length || boundaries[boundaries.length - 1] < new_boundary)
	break;
      points.pop();
      boundaries.pop();
    }
    points.push(newpt);
    boundaries.push(new_boundary);
  }
 // if (y == 128) { console.log(points, boundaries); }
  var cur = 0;
  for (var x = 0; x < size; x++) {
    while (cur < boundaries.length && boundaries[cur] <= x) cur++;
    var p = points[cur];
    M[Y + x] = Math.floor(Math.sqrt((p.x - x) * (p.x - x) + (p.y * p.y)));
  }

}



// for (var i = 0; i < size; i++) {
//   for (var j = 0; j < size; j++) {
//     console.log(Math.min(size - 1, kk[i * size + j]));
//   }
// }


if (1) {
  for (var i = 0; i < size; i++) {
    for (var j = 0; j < size; j++) {
      console.log((10 *  M[i * size + j]) % size);
    }
  }
}
