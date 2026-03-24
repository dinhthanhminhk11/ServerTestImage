const { createHttpError } = require('../utils/httpError');

function createVideoController({ queueService, videoService }) {
  async function upload(req, res) {
    if (!req.file) {
      throw createHttpError(400, 'Form-data field "video" is required.');
    }

    const record = await videoService.createUploadedVideo({
      file: req.file,
      title: req.body?.title,
    });

    res.status(202).json({
      message: 'Video accepted. Transcoding started in background.',
      video: videoService.serializeVideo(record, req),
    });
  }

  async function list(req, res) {
    const records = await videoService.listVideos();
    res.json({
      queue: queueService.getStats(),
      videos: records.map((record) => videoService.serializeVideo(record, req)),
    });
  }

  async function detail(req, res) {
    const record = await videoService.getRequiredVideoById(req.params.videoId);
    res.json({
      video: videoService.serializeVideo(record, req),
    });
  }

  async function status(req, res) {
    const record = await videoService.getRequiredVideoById(req.params.videoId);
    const serializedVideo = videoService.serializeVideo(record, req);

    res.json({
      id: record.id,
      status: record.status,
      error: record.error || null,
      processing: record.processing || null,
      playback: record.status === 'ready' ? serializedVideo.playback : null,
    });
  }

  async function retry(req, res) {
    const result = await videoService.retryVideo(req.params.videoId);

    if (result.type === 'ready') {
      res.status(409).json({
        error: 'Video is already ready. Upload a new source if you need a fresh encode.',
      });
      return;
    }

    if (result.type === 'in-progress') {
      res.status(202).json({
        message: 'Video is already in the transcode queue.',
        video: videoService.serializeVideo(result.record, req),
      });
      return;
    }

    res.status(202).json({
      message: 'Video re-queued for transcoding.',
      video: videoService.serializeVideo(result.record, req),
    });
  }

  return {
    detail,
    list,
    retry,
    status,
    upload,
  };
}

module.exports = {
  createVideoController,
};
