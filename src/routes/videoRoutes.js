const express = require('express');
const asyncHandler = require('../middlewares/asyncHandler');

function createVideoRoutes(videoController, uploadVideoMiddleware) {
  const router = express.Router();

  router.post('/upload', uploadVideoMiddleware, asyncHandler(videoController.upload));
  router.get('/', asyncHandler(videoController.list));
  router.get('/catalog', asyncHandler(videoController.catalog));
  router.get('/catalog.json', asyncHandler(videoController.catalog));
  router.get('/:videoId', asyncHandler(videoController.detail));
  router.get('/:videoId/status', asyncHandler(videoController.status));
  router.post('/:videoId/retry', asyncHandler(videoController.retry));

  return router;
}

module.exports = createVideoRoutes;
