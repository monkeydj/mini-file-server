var router = require('express').Router(),
  fsx = require('fs-extra'), path = require('path');

var debug = require('debug'),
  fldrReq = debug('folder:path'),
  faulty = debug('folder:error');

module.exports = function (app) {
  router.route(/\//)
    .post(createFolder)
    .delete(removeFolder)
    .all(respondFolder);

  return router;
}

function createFolder(req, res, next) {
  var folder = req.app.get('uploadRoot') + req.url;

  req.folderType = "Create";
  req.folderMessage = "Folder is created";

  fldrReq(folder);
  fsx.mkdir(folder, handleMkdir);

  function handleMkdir(err) {
    if (err instanceof Error) switch (err.code) {
      case 'EEXIST':
        req.folderCode = 409;
        req.folderMessage = "Already existed";
        break;
      case 'ENOENT':
        req.folderCode = 400;
        req.folderMessage = "The parent folder is not existed";
        break;
    }
    faulty(err); return next();
  }
}

function removeFolder(req, res, next) {
  var folder = req.app.get('uploadRoot') + req.url,
    thumbs = req.app.get('thumbnailRoot') + req.url;
  fldrReq(folder), fldrReq(thumbs);

  req.folderType = 'Delete';
  req.folderMessage = 'Folder is deleted';

  if (req.url == '/') {
    req.folderCode = 403;
    req.folderMessage = "Cannot delete this folder";
    return next();
  } else fsx.remove(folder, handleRemove);

  function handleRemove(err) {
    if (err instanceof Error) {
      req.folderCode = 400;
      req.folderMessage = "This folder is not existed";
    } else fsx.remove(thumbs); // remove mapped thumbnail path
    faulty(err); return next();
  }
}

function respondFolder(req, res, next) {
  var child = path.basename(req.url),
    parent = path.dirname(req.url);
  fldrReq('parent:', parent), fldrReq('child:', child);

  if (!req.folderCode) req.folderCode = 200;
  res.status(req.folderCode);
  res.json({
    success: req.folderCode == 200,
    type: req.folderType,
    message: req.folderMessage,
    data: {
      path: path.join(parent, '/').replace(/\\/g, '/'),
      filename: child,
      type: "folder"
    }
  });
}