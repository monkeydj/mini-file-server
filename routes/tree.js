var router = require('express').Router(),
  fs = require('fs'), path = require('path');

var debug = require('debug'),
  readTree = debug('tree:read'),
  loopTree = debug('tree:loop'),
  fileTree = debug('tree:file'),
  faulty = debug('tree:error');

module.exports = function (app) {
  router.get(/\//, returnFileTree);

  return router;
}

function returnFileTree(req, res, next) {
  var root = req.app.get('uploadRoot'),
    tree = readDirectory(root + req.url, req.app.get('allowedFile').regex);
  // only success response as of this is first written
  res.status(200).json(tree.map(removeUploadRoot));

  function removeUploadRoot(aFile) {
    aFile.path = aFile.path.replace(root, '').replace(/\\/g, "/") + '/';
    delete aFile.absolute; return aFile;
  }
}

/**
 * read available files in a directory path
 * @param {string} aPath starting directory path
 * @param {regex|string} fileExts regex for return needed (real) file
 */
function readDirectory(aPath, fileExts) {
  var files = [], i = -1, tmpDir;
  try {
    // get file list at this path; each one is an absolute path
    files = fs.readdirSync(aPath).map(absPath);
    readTree(aPath), readTree('desired:', fileExts);
    while (++i < files.length) {
      loopTree(i, files[i].filename.match(fileExts)), fileTree(files[i]);
      if (files[i].type == 'folder') {
        tmpDir = readDirectory(files[i].absolute, fileExts);
        loopTree('end:', files[i].absolute);
        files[i].size += +tmpDir.size || 0;
      } else if (!files[i].filename.match(fileExts)) {
        files.splice(i--, 1); continue;
      }
      files.size = (+files.size || 0) + files[i].size;
       // remove unnecessary properties
    }
  }
  // as of this file is first written, only e.code == 'ENOTDIR' is examined
  catch (e) { faulty(e); } finally { return readTree(files), files; }

  function absPath(aFile) { return getMetadata(path.join(aPath, aFile)); }
}

/**
 * get metadata of the specified file
 * @param {string} aFile absolute to the file
 */
function getMetadata(aFile) {
  var meta = {
    size: 0, absolute: aFile,
    path: path.dirname(aFile),
    filename: path.basename(aFile),
    type: path.extname(aFile).slice(1)
  };
  try {
    var stats = fs.statSync(aFile);
    if (stats.isDirectory()) meta.type = 'folder';
    // may need to calculate total size of a folder later  
    else meta.size = stats.size;
  }
  catch (e) { faulty(e); } finally { return meta; }
}