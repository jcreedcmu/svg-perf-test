var express = require('express');

var app = express();
app.use('/', express.static(__dirname));
app.use('/img', express.static("/home/jcreed/art/whatever/"));
app.post('/export', function(req, res) {
  var data = '';
  req.setEncoding('utf8');
  req.on('data', function(chunk) {
    data += chunk;
  });
  req.on('end', function() {
    req.body = JSON.parse(data);
    console.log(req.body);
    res.end("ok");
  });
});

app.listen(3000, '127.0.0.1', function() {
  console.log("listening on port 3000");
});
