const fs = require('fs/promises');
const path = require('path');
const appConfig = require('../config/appConfig');

const VIDEO_EXTENSIONS = {
  'video/mp4': '.mp4',
  'video/quicktime': '.mov',
  'video/x-msvideo': '.avi',
  'video/x-matroska': '.mkv',
  'video/webm': '.webm',
  'video/mpeg': '.mpeg',
};

function getCatalogPath(videoId) {
  return path.join(appConfig.storage.catalog, `${videoId}.json`);
}

function getUploadDir(videoId) {
  return path.join(appConfig.storage.uploads, videoId);
}

function getSourcePath(videoId, storedFilename) {
  return path.join(getUploadDir(videoId), storedFilename);
}

function getPublishedOutputDir(videoId) {
  return path.join(appConfig.storage.videos, videoId);
}

function getStagingOutputDir(videoId) {
  return path.join(appConfig.storage.temp, videoId);
}

async function ensureDirectories() {
  const directories = Object.values(appConfig.storage);
  await Promise.all(directories.map((directory) => fs.mkdir(directory, { recursive: true })));
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return false;
    }

    throw error;
  }
}

async function readVideoRecord(videoId) {
  try {
    const content = await fs.readFile(getCatalogPath(videoId), 'utf8');
    return JSON.parse(content);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null;
    }

    throw error;
  }
}

async function saveVideoRecord(record) {
  const nextRecord = {
    ...record,
    updatedAt: new Date().toISOString(),
  };

  await fs.writeFile(getCatalogPath(record.id), JSON.stringify(nextRecord, null, 2), 'utf8');
  return nextRecord;
}

async function updateVideoRecord(videoId, updater) {
  const currentRecord = await readVideoRecord(videoId);

  if (!currentRecord) {
    throw new Error(`Video ${videoId} does not exist.`);
  }

  const nextRecord =
    typeof updater === 'function' ? await updater(currentRecord) : { ...currentRecord, ...updater };

  nextRecord.id = currentRecord.id;
  return saveVideoRecord(nextRecord);
}

async function listVideoRecords() {
  const entries = await fs.readdir(appConfig.storage.catalog, { withFileTypes: true });
  const records = await Promise.all(
    entries
      .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
      .map(async (entry) => {
        const content = await fs.readFile(path.join(appConfig.storage.catalog, entry.name), 'utf8');
        return JSON.parse(content);
      }),
  );

  return records.sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt));
}

function resolveVideoExtension(originalFilename, mimeType) {
  const extension = path.extname(originalFilename || '').toLowerCase();
  if (extension) {
    return extension;
  }

  return VIDEO_EXTENSIONS[mimeType] || '.mp4';
}

async function moveIncomingFile(videoId, file) {
  const extension = resolveVideoExtension(file.originalname, file.mimetype);
  const uploadDir = getUploadDir(videoId);
  const storedFilename = `source${extension}`;
  const sourcePath = getSourcePath(videoId, storedFilename);

  await fs.mkdir(uploadDir, { recursive: true });
  await fs.rename(file.path, sourcePath);

  return { storedFilename, sourcePath };
}

async function removeFileIfExists(targetPath) {
  if (!targetPath) {
    return;
  }

  try {
    await fs.rm(targetPath, { force: true });
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
}

module.exports = {
  ensureDirectories,
  getCatalogPath,
  getUploadDir,
  getSourcePath,
  getPublishedOutputDir,
  getStagingOutputDir,
  listVideoRecords,
  moveIncomingFile,
  pathExists,
  readVideoRecord,
  removeFileIfExists,
  saveVideoRecord,
  updateVideoRecord,
};
