function createSystemController({ queueService, videoService }) {
  async function getHome(req, res) {
    const records = await videoService.listVideos();
    const readyCount = records.filter((record) => record.status === 'ready').length;

    res.json({
      name: 'HLS video CDN origin',
      endpoints: {
        upload: 'POST /api/videos/upload',
        list: 'GET /api/videos',
        detail: 'GET /api/videos/:videoId',
        status: 'GET /api/videos/:videoId/status',
        retry: 'POST /api/videos/:videoId/retry',
        playback: 'GET /cdn/videos/:videoId/master.m3u8',
      },
      stats: {
        totalVideos: records.length,
        readyVideos: readyCount,
        queue: queueService.getStats(),
      },
    });
  }

  function getHealth(req, res) {
    res.json({
      status: 'ok',
      queue: queueService.getStats(),
    });
  }

  return {
    getHealth,
    getHome,
  };
}

module.exports = {
  createSystemController,
};
