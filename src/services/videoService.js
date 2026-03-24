const crypto = require('crypto');
const path = require('path');
const appConfig = require('../config/appConfig');
const videoModel = require('../models/videoModel');
const { createHttpError } = require('../utils/httpError');

function createVideoService({ queueService }) {
  function buildBaseUrl(req) {
    if (appConfig.publicPlaybackBaseUrl) {
      return appConfig.publicPlaybackBaseUrl.replace(/\/$/, '');
    }

    return `${req.protocol}://${req.get('host')}`;
  }

  function serializeVideo(record, req) {
    const playbackRoot = appConfig.publicPlaybackBaseUrl
      ? appConfig.publicPlaybackBaseUrl.replace(/\/$/, '')
      : `${buildBaseUrl(req)}/cdn/videos`;
    const highestRendition = record.renditions?.[0] || null;
    const sourceRendition = record.renditions?.find((rendition) => rendition.id === 'source') || null;

    return {
      id: record.id,
      title: record.title,
      status: record.status,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      source: record.source,
      video: record.video || null,
      renditions: record.renditions || [],
      error: record.error || null,
      processing: record.processing || null,
      playback:
        record.status === 'ready'
          ? {
              masterPlaylistUrl: `${playbackRoot}/${record.id}/master.m3u8`,
              highestPlaylistUrl: highestRendition
                ? `${playbackRoot}/${record.id}/${highestRendition.playlist}`
                : null,
              sourcePlaylistUrl: sourceRendition
                ? `${playbackRoot}/${record.id}/${sourceRendition.playlist}`
                : null,
            }
          : null,
    };
  }

  function buildVideoRecord(videoId, file, title) {
    const now = new Date().toISOString();

    return {
      id: videoId,
      title: title || path.parse(file.originalname).name,
      status: 'uploaded',
      createdAt: now,
      updatedAt: now,
      source: {
        originalFilename: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        storedFilename: null,
      },
      video: null,
      renditions: [],
      playback: null,
      error: null,
      processing: {
        stage: 'uploaded',
      },
    };
  }

  async function createUploadedVideo({ file, title }) {
    const videoId = crypto.randomUUID();
    let record = buildVideoRecord(videoId, file, title);
    let movedSourcePath = null;

    try {
      const movedSource = await videoModel.moveIncomingFile(videoId, file);
      movedSourcePath = movedSource.sourcePath;
      record.source.storedFilename = movedSource.storedFilename;
      record.status = 'queued';
      record.processing = {
        stage: 'queued',
        queuedAt: new Date().toISOString(),
      };

      await videoModel.saveVideoRecord(record);
      return queueService.enqueue(videoId);
    } catch (error) {
      await videoModel.removeFileIfExists(file?.path);
      await videoModel.removeFileIfExists(movedSourcePath);
      record = {
        ...record,
        status: 'failed',
        error: String(error.message || error),
      };
      await videoModel.saveVideoRecord(record);
      throw error;
    }
  }

  async function listVideos() {
    return videoModel.listVideoRecords();
  }

  async function getVideoById(videoId) {
    return videoModel.readVideoRecord(videoId);
  }

  async function getRequiredVideoById(videoId) {
    const record = await getVideoById(videoId);
    if (!record) {
      throw createHttpError(404, 'Video not found.');
    }

    return record;
  }

  async function retryVideo(videoId) {
    const record = await getRequiredVideoById(videoId);

    if (!record.source?.storedFilename) {
      throw createHttpError(400, 'Video does not have a stored source file to reprocess.');
    }

    if (record.status === 'ready') {
      return {
        type: 'ready',
        record,
      };
    }

    if (record.status === 'queued' || record.status === 'processing') {
      return {
        type: 'in-progress',
        record,
      };
    }

    const queuedRecord = await queueService.enqueue(record.id);
    return {
      type: 'queued',
      record: queuedRecord,
    };
  }

  return {
    createUploadedVideo,
    getRequiredVideoById,
    getVideoById,
    listVideos,
    retryVideo,
    serializeVideo,
  };
}

module.exports = {
  createVideoService,
};
