const multer = require('multer');

function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    next(error);
    return;
  }

  if (error instanceof multer.MulterError) {
    res.status(400).json({
      error: error.message,
    });
    return;
  }

  if (error?.statusCode) {
    res.status(error.statusCode).json({
      error: error.message,
    });
    return;
  }

  console.error(error);
  res.status(500).json({
    error: error?.message || 'Internal server error.',
  });
}

module.exports = errorHandler;
