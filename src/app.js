const path = require('path');
const express = require('express');
const appConfig = require('./config/appConfig');
const { createSystemController } = require('./controllers/systemController');
const { createVideoController } = require('./controllers/videoController');
const corsMiddleware = require('./middlewares/corsMiddleware');
const errorHandler = require('./middlewares/errorHandler');
const uploadVideoMiddleware = require('./middlewares/uploadVideoMiddleware');
const videoModel = require('./models/videoModel');
const registerRoutes = require('./routes');
const { createVideoQueueService } = require('./services/videoQueueService');
const { createVideoService } = require('./services/videoService');

function attachStaticVideoOrigin(app) {
  app.use('/cdn/videos', (req, res, next) => {
    res.setHeader('Cache-Control', appConfig.longCacheControl);
    res.setHeader('Access-Control-Allow-Origin', appConfig.corsOrigin);
    res.setHeader('Timing-Allow-Origin', appConfig.corsOrigin);
    next();
  });

  app.use(
    '/cdn/videos',
    express.static(appConfig.storage.videos, {
      etag: true,
      lastModified: true,
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('.m3u8')) {
          res.type('application/vnd.apple.mpegurl');
        } else if (filePath.endsWith('.ts')) {
          res.type('video/mp2t');
        }
      },
    }),
  );
}

async function createApp() {
  await videoModel.ensureDirectories();

  const queueService = createVideoQueueService();
  const videoService = createVideoService({ queueService });

  await queueService.resumePendingJobs();

  const systemController = createSystemController({ queueService, videoService });
  const videoController = createVideoController({ queueService, videoService });

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(corsMiddleware);
  app.use(express.json());

  registerRoutes(app, {
    systemController,
    videoController,
    uploadVideoMiddleware,
  });

  app.use('/SpitalBetty', express.static(path.join(appConfig.rootDir, 'SpitalBetty')));
  attachStaticVideoOrigin(app);
  app.use(errorHandler);

  return {
    app,
    config: appConfig,
    services: {
      queueService,
      videoService,
    },
  };
}

module.exports = {
  createApp,
};
