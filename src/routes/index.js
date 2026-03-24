const createSystemRoutes = require('./systemRoutes');
const createVideoRoutes = require('./videoRoutes');

function registerRoutes(app, { systemController, videoController, uploadVideoMiddleware }) {
  app.use(createSystemRoutes(systemController));
  app.use('/api/videos', createVideoRoutes(videoController, uploadVideoMiddleware));
}

module.exports = registerRoutes;
