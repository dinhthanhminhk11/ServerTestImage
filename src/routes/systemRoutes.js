const express = require('express');
const asyncHandler = require('../middlewares/asyncHandler');

function createSystemRoutes(systemController) {
  const router = express.Router();

  router.get('/', asyncHandler(systemController.getHome));
  router.get('/health', systemController.getHealth);

  return router;
}

module.exports = createSystemRoutes;
