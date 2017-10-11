var express = require('express'),
  bodyParser = require('body-parser'),
  morgan = require('morgan');
  path = require('path'),
  config = require('./config.json'),
  app = express();

/** normalize common config data */
config.viewRoot = path.resolve(__dirname, config.viewRoot);
config.uploadRoot = path.resolve(__dirname, config.uploadRoot);
config.thumbnailRoot = path.resolve(__dirname, config.thumbnailRoot);
config.allowedFile = config.allowedFile || { regex: '' };
config.allowedFile.regex = new RegExp(config.allowedFile.regex);
config.routes = config.routes || {};

// module.exports = app; // for later test suite

/** set constants for uses in later routes */
app.set('uploadRoot', config.uploadRoot);
app.set('thumbnailRoot', config.thumbnailRoot);
app.set('uploadFields', config.uploadFields); // specific for uploading
app.set('allowedFile', config.allowedFile);

/** set up log for incoming requests */
// formats described in https://github.com/expressjs/morgan
app.use(morgan(String(config.logger)));

/** set up parser for form|body data */
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

/** resolve the Cross Origin problem */
app.use(require('cors')());

/** add some static routes */
app.use(express.static(config.viewRoot));
app.get('/', function (req, res) {
  res.sendFile("index.html", { root: config.viewRoot });
});
app.use(function decoding(req, res, next) {
  req.url = decodeURI(req.url);
  next();
});
app.use('/file', express.static(app.get('uploadRoot')));
app.use('/thumb', express.static(app.get('thumbnailRoot')));

/** check & add dynamic routes from config */
if (Array.isArray(config.routes.tree)) {
  config.routes.tree.map(addRoute);
}

/** start up server */
app.listen(config.port, function () {
  console.info('Upload server is on @', config.port)
});

/**
 * add a route to this express server
 * @param {object} node a route information: { url, file }
 */
function addRoute(node) {
  try {
    node.file = path.resolve(__dirname, config.routes.directory, node.file);
    app.use(
      (config.routes.prefix || '') + node.url,
      require(node.file)(app)
    );
  } catch (e) {
    console.error(e);
    console.info('Invalid node:', node);
  }
}