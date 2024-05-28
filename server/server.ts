import stringify = require('canonical-json');
import { writeFileSync } from 'fs';
import * as express from 'express';
import * as path from 'path';

const app = express();

app.use('/data', express.static(__dirname + "/../data/"));
app.use('/img', express.static("/home/jcreed/art/whatever/num1/"));
app.post('/export', function(req, res) {
  var data = '';
  req.setEncoding('utf8');
  req.on('data', function(chunk) {
    data += chunk;
  });
  req.on('end', function() {
    var body = JSON.parse(data);
    writeFileSync(__dirname + "/../data/geo.json", stringify(body, null, 2) + "\n", "utf8");
    console.log("ok");
    res.end("ok");
  });
});
app.use('/', express.static(path.join(__dirname, '../public')));

app.listen(3000, '127.0.0.1', function() {
  console.log("listening on port 3000");
});
