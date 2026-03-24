const path = require('path');
const ffmpegStatic = require('ffmpeg-static');
const ffprobeStatic = require('ffprobe-static');

const ROOT_DIR = path.resolve(__dirname, '..', '..');
const STORAGE_DIR = path.join(ROOT_DIR, 'storage');
const INCOMING_DIR = path.join(STORAGE_DIR, 'incoming');
const UPLOADS_DIR = path.join(STORAGE_DIR, 'uploads');
const VIDEOS_DIR = path.join(STORAGE_DIR, 'videos');
const CATALOG_DIR = path.join(STORAGE_DIR, 'catalog');
const TEMP_DIR = path.join(STORAGE_DIR, 'temp');

function readInteger(name, fallback) {
  const rawValue = process.env[name];
  const value = Number.parseInt(rawValue ?? '', 10);
  return Number.isFinite(value) ? value : fallback;
}

const LANDSCAPE_RENDITIONS = [
  {
    id: '2160p',
    width: 3840,
    height: 2160,
    videoBitrate: '12000k',
    maxRate: '15000k',
    bufSize: '24000k',
    audioBitrate: '192k',
  },
  {
    id: '1440p',
    width: 2560,
    height: 1440,
    videoBitrate: '8000k',
    maxRate: '10000k',
    bufSize: '16000k',
    audioBitrate: '192k',
  },
  {
    id: '1080p',
    width: 1920,
    height: 1080,
    videoBitrate: '5000k',
    maxRate: '5350k',
    bufSize: '7500k',
    audioBitrate: '192k',
  },
  {
    id: '720p',
    width: 1280,
    height: 720,
    videoBitrate: '2800k',
    maxRate: '2996k',
    bufSize: '4200k',
    audioBitrate: '128k',
  },
  {
    id: '480p',
    width: 854,
    height: 480,
    videoBitrate: '1400k',
    maxRate: '1498k',
    bufSize: '2100k',
    audioBitrate: '128k',
  },
  {
    id: '360p',
    width: 640,
    height: 360,
    videoBitrate: '800k',
    maxRate: '856k',
    bufSize: '1200k',
    audioBitrate: '96k',
  },
  {
    id: '240p',
    width: 426,
    height: 240,
    videoBitrate: '450k',
    maxRate: '481k',
    bufSize: '675k',
    audioBitrate: '64k',
  },
];

const PORTRAIT_RENDITIONS = [
  {
    id: '1080x1920',
    width: 1080,
    height: 1920,
    videoBitrate: '6000k',
    maxRate: '7200k',
    bufSize: '12000k',
    audioBitrate: '192k',
  },
  {
    id: '720x1280',
    width: 720,
    height: 1280,
    videoBitrate: '3500k',
    maxRate: '4200k',
    bufSize: '7000k',
    audioBitrate: '160k',
  },
  {
    id: '540x960',
    width: 540,
    height: 960,
    videoBitrate: '2200k',
    maxRate: '2640k',
    bufSize: '4400k',
    audioBitrate: '128k',
  },
  {
    id: '360x640',
    width: 360,
    height: 640,
    videoBitrate: '1100k',
    maxRate: '1320k',
    bufSize: '2200k',
    audioBitrate: '96k',
  },
];

const appConfig = {
  rootDir: ROOT_DIR,
  port: readInteger('PORT', 3000),
  maxUploadSizeMb: readInteger('MAX_UPLOAD_SIZE_MB', 4096),
  transcodeConcurrency: Math.max(readInteger('TRANSCODE_CONCURRENCY', 1), 1),
  hlsSegmentDuration: Math.max(readInteger('HLS_SEGMENT_DURATION', 6), 2),
  ffmpegPreset: process.env.FFMPEG_PRESET || 'veryfast',
  corsOrigin: process.env.CORS_ORIGIN || '*',
  publicPlaybackBaseUrl: process.env.PUBLIC_PLAYBACK_BASE_URL || '',
  longCacheControl: 'public, max-age=31536000, immutable',
  ffmpegPath: process.env.FFMPEG_PATH || ffmpegStatic,
  ffprobePath: process.env.FFPROBE_PATH || ffprobeStatic.path,
  storage: {
    root: STORAGE_DIR,
    incoming: INCOMING_DIR,
    uploads: UPLOADS_DIR,
    videos: VIDEOS_DIR,
    catalog: CATALOG_DIR,
    temp: TEMP_DIR,
  },
  renditions: {
    landscape: LANDSCAPE_RENDITIONS,
    portrait: PORTRAIT_RENDITIONS,
  },
};

appConfig.maxUploadSizeBytes = appConfig.maxUploadSizeMb * 1024 * 1024;

module.exports = appConfig;
