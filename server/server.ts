import stringify = require('canonical-json');
import { writeFileSync } from 'fs';
import * as express from 'express';
import * as WebpackDevServer from 'webpack-dev-server';
import * as webpack from 'webpack';

const config: webpack.Configuration = require('./webpack.config');
if (config.devServer == undefined) {
  config.devServer = {};
}
const devConfig: WebpackDevServer.Configuration = {
  before: (app) => {
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
    //  app.use('/', express.static(__dirname + "/public"));
  },
  contentBase: __dirname + '/../public',
  //  hot: true,
  filename: 'bundle.js',
  publicPath: '/',
  stats: {
    colors: true,
  },
};
const compiler = webpack(config);
const _app = new WebpackDevServer(compiler, devConfig);

_app.listen(3000, '127.0.0.1', function() {
  console.log("listening on port 3000");
});
