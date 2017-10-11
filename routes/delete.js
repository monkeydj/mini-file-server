var router = require('express').Router(),
  path = require('path'), fs = require('fs');

var debug = require('debug'),
  fileStat = debug('delete:file'),
  faulty = debug('delete:error');

module.exports = function (app) {
  router.delete(/file/, removeContent, returnMetadata);

  return router;
}

function removeContent(req, res, next) {
  var file = req.app.get('uploadRoot') + req.url,
    thumb = req.app.get('thumbnailRoot') + req.url;
  fileStat(file), fileStat(thumb);

  // need to get file metadata first
  fs.stat(file, function existOrNot(err, stat) {
    // ref: https://nodejs.org/api/errors.html#errors_common_system_errors
    if (err) return responding(err); // catch 'ENOENT' here
    req.metadata = stat;
    fs.unlink(file, responding); // proceed to remove the file  
  });

  function responding(err) {
    faulty(err);
    if (err instanceof Error) req.fileErrorCode = err.code;
    else fs.unlinkSync(thumb); // remove the corresponding thumbnail
    return next(); // move on to next handler on this route
  }
}

function returnMetadata(req, res, next) {
  if (req.metadata) fileStat(req.metadata);
  res.status(req.fileErrorCode ? 400 : 200);
  res.json({ // start of api response
    success: !req.fileErrorCode,
    type: 'Delete',
    message: req.fileErrorCode ? 'Cannot delete this file' : 'It\'s deleted',
    data: {
      path: path.join(path.dirname(req.url), '/').replace(/\\/g, '/'),
      filename: path.basename(req.url),
      size: (req.metadata || {}).size || 0,
      type: path.extname(req.url).slice(1)
    }
  }); // end of api response
}