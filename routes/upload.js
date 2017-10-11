var router = require('express').Router(),
  Jimp = require('jimp'), // for image processing
  thumb = [150, 150], // fixed resolution of thumbnails
  thumbRatio = thumb[0] / thumb[1], // avoid calculating again and again
  multer = require('multer'), fs = require('fs-extra'), path = require('path');

var debug = require('debug'),
  bodyReq = debug('upload:body'),
  filesMeta = debug('upload:files'),
  thumbIMG = debug('upload:thumbs'),
  faulty = debug('upload:error');

module.exports = function (app) {
  var upload = multer({

    fileFilter: function (req, file, cb) {
      var allowedFile = app.get('allowedFile');
      // let only image files be uploaded for now
      if (!file.originalname.match(allowedFile.regex)) {
        return cb(new Error(allowedFile.failedString));
      } else cb(null, true); // if a file passed
    },

    storage: multer.diskStorage({
      // set uploading folder
      destination: function (req, file, cb) {
        cb(null, app.get('uploadRoot') + req.url);
      },
      // customise uploading file name
      filename: function (req, file, cb) {
        var fname = file.fieldname + '-' + Date.now();
        cb(null, fname + path.extname(file.originalname));
      }
    })

  }).fields(app.get('uploadFields'));

  router.route(/\//)
    .post(handleUpload, createThumbnails, afterUploaded);

  return router;

  /** manual uploading handling for possible errors */
  function handleUpload(req, res, next) {
    upload(req, res, errorHandle);

    function errorHandle(err) {
      if (!err) return next(); // upload successfully!
      // else, customise error message
      switch (err.code) {
        case 'ENOENT': // cannot open requested path
          err.message = 'No such folder existed';
          res.status(404);
          break;
        default: // error while filtering files
          res.status(400);
      }
      res.json(responding(err));
    }
  }
}

/** final route handler when uploading is success */
function afterUploaded(req, res, next) {
  bodyReq(req.body), filesMeta(req.files);
  // according to the defined fields in <req.>app.get('uploadFields')
  var metadata = req.files.file.map(createMetadata); // only `file` for now
  res.status(200).json(responding(null, metadata));

  function createMetadata(file) {
    return {
      path: path.join(req.url, '/').replace(/\\/g, '/'),
      filename: file.filename,
      size: file.size || 0,
      type: path.extname(file.filename).slice(1)
    }
  }
}

/** return response message format on this route*/
function responding(err, data) {
  return faulty(err), filesMeta(data), {
    success: !err, type: 'Upload',
    message: err ? (err.message || 'Invalid request') : 'Upload successfully',
    data: Array.isArray(data) ? data : [] // should it always be an array!
  }
}

/** extending part of this route: creating thumbnails */
function createThumbnails(req, res, next) {
  var root = req.app.get('thumbnailRoot') + req.url;
  // tree structure is mapped between upload- & thumbnail-Root

  fs.mkdirp(root, function (err) { // always try to create mapping folder first
    if (err && ['ENOENT', 'EEXIST'].indexOf(err.code) < 0) faulty(err);
    // 'ENOENT' could not happen as handleUpload has catched it (possibly...)
    // 'EEXIST' on 2nd time uploading to the same folder
    req.files.file.map(processing); next(); // ...
  });

  /** process chain of creating thumbnail of image */
  function processing(file) {
    var crop = outerCrop; // pick either outer- or inner-Crop here
    Jimp.read(file.path).then(crop).then(save).catch(faulty);

    /** output processed image as a local file */
    function save(image) { image.write(path.join(root, file.filename)); }
  }
}

/* helpers for createThumbnails */

function innerCrop(image) {
  var base = baseScale(image.bitmap);
  image.resize.apply(image, base.thumb);
  image.crop.apply(image, base.crop.concat(thumb));
  return image; // pass to next procedure in chain
}

function outerCrop(image) {
  var base = baseScale(image.bitmap, true);
  // create a white background, and paste resized image, then pass it
  return new Jimp(thumb[0], thumb[1], 0xFFFFFFFF, compose);

  function compose(err, bg) {
    // resize bitmap data of original
    image.resize.apply(image, base.thumb);
    // paste resized img on white background
    bg.composite(image, base.crop[0], base.crop[1]);
  }
}

function baseScale(img, reverse) {
  var ratio = img.width / img.height,
    idx = (thumbRatio >= ratio) ^ (reverse = +!!reverse),
    pxls = idx ? (thumb[+!idx] / ratio) : (thumb[+!idx] * ratio),
    base = { thumb: Array.apply({}, thumb), crop: [0, 0] };

  thumbIMG(img.width, '/', img.height, '=', ratio, '(', idx, '~', pxls, ')');

  base.thumb[idx] = Jimp.AUTO; // apply auto resize 
  // calculate starting position for cropping
  if (reverse) base.crop[idx] = thumb[idx] - pxls;
  else base.crop[idx] = pxls - thumb[idx];
  // ...
  base.crop[idx] = Math.round(base.crop[idx] / 2);

  return thumbIMG(base), base // as parameters for cropping procedure up next
}