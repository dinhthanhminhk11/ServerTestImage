const multer = require('multer');
const appConfig = require('../config/appConfig');

const VIDEO_FILE_PATTERN = /\.(mp4|mov|avi|mkv|webm|m4v|mpeg|mpg)$/i;

const uploadVideoMiddleware = multer({
  dest: appConfig.storage.incoming,
  limits: {
    fileSize: appConfig.maxUploadSizeBytes,
  },
  fileFilter: (req, file, callback) => {
    if (file.mimetype?.startsWith('video/') || VIDEO_FILE_PATTERN.test(file.originalname || '')) {
      callback(null, true);
      return;
    }

    callback(new Error('Only video uploads are allowed.'));
  },
}).single('video');

module.exports = uploadVideoMiddleware;
