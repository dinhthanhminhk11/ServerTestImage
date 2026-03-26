const appConfig = require('../config/appConfig');
const videoModel = require('../models/videoModel');
const { transcodeVideo } = require('./transcodeService');

function createVideoQueueService({ concurrency = appConfig.transcodeConcurrency } = {}) {
  const pending = [];
  const active = new Set();

  async function enqueue(videoId) {
    const record = await videoModel.readVideoRecord(videoId);
    if (!record) {
      throw new Error(`Video ${videoId} was not found.`);
    }

    if (record.status === 'ready') {
      return record;
    }

    if (!pending.includes(videoId) && !active.has(videoId)) {
      pending.push(videoId);
      await videoModel.updateVideoRecord(videoId, (current) => ({
        ...current,
        status: 'queued',
        error: null,
        processing: {
          ...current.processing,
          stage: 'queued',
          queuedAt: new Date().toISOString(),
          currentRendition: null,
        },
      }));
      void drain();
    }

    return videoModel.readVideoRecord(videoId);
  }

  async function markReady(videoId, result) {
    return videoModel.updateVideoRecord(videoId, (current) => ({
      ...current,
      status: 'ready',
      error: null,
      thumbnail: result.thumbnail || current.thumbnail || null,
      video: {
        durationSeconds: result.durationSeconds,
        width: result.source.width,
        height: result.source.height,
        rotation: result.source.rotation,
      },
      renditions: result.renditions,
      playback: {
        masterPlaylistPath: `/cdn/videos/${videoId}/master.m3u8`,
      },
      processing: {
        ...current.processing,
        stage: 'ready',
        currentRendition: null,
        finishedAt: new Date().toISOString(),
      },
    }));
  }

  async function markFailure(videoId, error) {
    const message = String(error?.message || error).trim();
    return videoModel.updateVideoRecord(videoId, (current) => ({
      ...current,
      status: 'failed',
      error: message,
      processing: {
        ...current.processing,
        stage: 'failed',
        finishedAt: new Date().toISOString(),
      },
    }));
  }

  async function processVideo(videoId) {
    await videoModel.updateVideoRecord(videoId, (current) => ({
      ...current,
      status: 'processing',
      error: null,
      processing: {
        ...current.processing,
        stage: 'starting',
        startedAt: current.processing?.startedAt || new Date().toISOString(),
      },
    }));

    try {
      const result = await transcodeVideo(videoId, {
        onStage: async (stage) => {
          await videoModel.updateVideoRecord(videoId, (current) => ({
            ...current,
            status: 'processing',
            processing: {
              ...current.processing,
              ...stage,
            },
          }));
        },
      });

      await markReady(videoId, result);
    } catch (error) {
      await markFailure(videoId, error);
    }
  }

  function drain() {
    while (active.size < concurrency && pending.length > 0) {
      const videoId = pending.shift();
      active.add(videoId);

      void processVideo(videoId)
        .catch((error) => {
          console.error(`Transcode job ${videoId} failed unexpectedly.`);
          console.error(error);
        })
        .finally(() => {
          active.delete(videoId);
          drain();
        });
    }
  }

  async function resumePendingJobs() {
    const records = await videoModel.listVideoRecords();

    for (const record of records) {
      if (!['uploaded', 'queued', 'processing', 'interrupted'].includes(record.status)) {
        continue;
      }

      if (!record.source?.storedFilename) {
        continue;
      }

      const sourcePath = videoModel.getSourcePath(record.id, record.source.storedFilename);
      if (!(await videoModel.pathExists(sourcePath))) {
        continue;
      }

      await enqueue(record.id);
    }
  }

  function getStats() {
    return {
      concurrency,
      active: active.size,
      pending: pending.length,
      activeVideoIds: Array.from(active),
      pendingVideoIds: [...pending],
    };
  }

  return {
    enqueue,
    getStats,
    resumePendingJobs,
  };
}

module.exports = {
  createVideoQueueService,
};
