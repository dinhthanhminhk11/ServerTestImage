const fs = require('fs/promises');
const path = require('path');
const { spawn } = require('child_process');
const appConfig = require('../config/appConfig');
const videoModel = require('../models/videoModel');

function makeEven(value) {
  const rounded = Math.max(2, Math.floor(value));
  return rounded % 2 === 0 ? rounded : rounded - 1;
}

function normalizeRotation(rotation) {
  if (!Number.isFinite(rotation)) {
    return 0;
  }

  return ((rotation % 360) + 360) % 360;
}

function getRotation(stream) {
  const tagRotation = Number.parseInt(stream?.tags?.rotate ?? '', 10);
  const sideDataRotation = Array.isArray(stream?.side_data_list)
    ? Number.parseInt(
        stream.side_data_list.find((item) => item && Number.isFinite(Number(item.rotation)))?.rotation ?? '',
        10,
      )
    : Number.NaN;

  return normalizeRotation(Number.isFinite(sideDataRotation) ? sideDataRotation : tagRotation);
}

function getDisplayDimensions(videoStream) {
  if (!videoStream?.width || !videoStream?.height) {
    return null;
  }

  let width = videoStream.width;
  let height = videoStream.height;
  const rotation = getRotation(videoStream);

  if (rotation === 90 || rotation === 270) {
    [width, height] = [height, width];
  }

  return {
    width: makeEven(width),
    height: makeEven(height),
    rotation,
  };
}

function parseBitrate(bitRate) {
  const match = /^(\d+(?:\.\d+)?)([kmg])$/i.exec(bitRate);
  if (!match) {
    return Number.parseInt(bitRate, 10) || 0;
  }

  const value = Number.parseFloat(match[1]);
  const unit = match[2].toLowerCase();

  if (unit === 'g') {
    return Math.round(value * 1_000_000_000);
  }

  if (unit === 'm') {
    return Math.round(value * 1_000_000);
  }

  return Math.round(value * 1_000);
}

function computeOutputSize(sourceWidth, sourceHeight, maxWidth, maxHeight) {
  const ratio = Math.min(maxWidth / sourceWidth, maxHeight / sourceHeight, 1);
  return {
    width: makeEven(sourceWidth * ratio),
    height: makeEven(sourceHeight * ratio),
  };
}

function normalizeBitrate(value, fallback) {
  const parsed = Number.parseInt(value || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function buildSourceRendition(sourceWidth, sourceHeight, probeResult) {
  const sourceVideoBitrate = normalizeBitrate(
    probeResult.videoStream?.bit_rate,
    Math.max(Math.round((sourceWidth * sourceHeight * 3) / 2), 1_000_000),
  );
  const sourceAudioBitrate = probeResult.hasAudio
    ? normalizeBitrate(
        probeResult.raw.streams?.find((stream) => stream.codec_type === 'audio')?.bit_rate,
        96_000,
      )
    : 0;
  const averageBandwidth = sourceVideoBitrate + sourceAudioBitrate;

  return {
    id: 'source',
    width: sourceWidth,
    height: sourceHeight,
    outputWidth: sourceWidth,
    outputHeight: sourceHeight,
    videoBitrate: String(sourceVideoBitrate),
    maxRate: String(Math.round(sourceVideoBitrate * 1.15)),
    bufSize: String(Math.round(sourceVideoBitrate * 2)),
    audioBitrate: probeResult.hasAudio ? String(sourceAudioBitrate) : null,
    averageBandwidth,
    bandwidth: Math.round(averageBandwidth * 1.08),
  };
}

function mapPresetRenditions(sourceWidth, sourceHeight, presets) {
  return presets
    .filter((rendition) => rendition.width <= sourceWidth && rendition.height <= sourceHeight)
    .map((rendition) => {
      const output = computeOutputSize(sourceWidth, sourceHeight, rendition.width, rendition.height);
      const averageBandwidth = parseBitrate(rendition.videoBitrate) + parseBitrate(rendition.audioBitrate);

      return {
        ...rendition,
        outputWidth: output.width,
        outputHeight: output.height,
        averageBandwidth,
        bandwidth: Math.round(averageBandwidth * 1.08),
      };
    })
    .filter((rendition) => rendition.outputWidth >= 2 && rendition.outputHeight >= 2);
}

function dedupeRenditions(renditions) {
  const seen = new Set();
  const result = [];

  for (const rendition of renditions) {
    const key = `${rendition.outputWidth}x${rendition.outputHeight}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(rendition);
  }

  return result;
}

function sortRenditions(renditions) {
  return renditions.sort((left, right) => {
    const leftPixels = left.outputWidth * left.outputHeight;
    const rightPixels = right.outputWidth * right.outputHeight;

    if (rightPixels !== leftPixels) {
      return rightPixels - leftPixels;
    }

    if (right.outputHeight !== left.outputHeight) {
      return right.outputHeight - left.outputHeight;
    }

    return right.outputWidth - left.outputWidth;
  });
}

function selectRenditions(sourceWidth, sourceHeight, probeResult) {
  const orientation = sourceHeight > sourceWidth ? 'portrait' : 'landscape';
  const sourceRendition = buildSourceRendition(sourceWidth, sourceHeight, probeResult);
  const presetRenditions = mapPresetRenditions(sourceWidth, sourceHeight, appConfig.renditions[orientation]);
  const renditions = sortRenditions(dedupeRenditions([sourceRendition, ...presetRenditions]));

  if (renditions.length > 0) {
    return renditions;
  }

  return [sourceRendition];
}

function createMasterPlaylist(renditions, hasAudio) {
  const codecs = hasAudio ? 'avc1.64001f,mp4a.40.2' : 'avc1.64001f';
  const lines = ['#EXTM3U', '#EXT-X-VERSION:3'];

  for (const rendition of renditions) {
    lines.push(
      `#EXT-X-STREAM-INF:BANDWIDTH=${rendition.bandwidth},AVERAGE-BANDWIDTH=${rendition.averageBandwidth},RESOLUTION=${rendition.outputWidth}x${rendition.outputHeight},CODECS="${codecs}"`,
    );
    lines.push(`${rendition.id}/index.m3u8`);
  }

  return `${lines.join('\n')}\n`;
}

function runProcess(binaryPath, args, label) {
  return new Promise((resolve, reject) => {
    if (!binaryPath) {
      reject(new Error(`${label} binary is not configured.`));
      return;
    }

    const child = spawn(binaryPath, args, {
      windowsHide: true,
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }

      const error = new Error(`${label} exited with code ${code}.\n${stderr.trim()}`.trim());
      error.stdout = stdout;
      error.stderr = stderr;
      reject(error);
    });
  });
}

async function probeSource(sourcePath) {
  const args = ['-v', 'error', '-print_format', 'json', '-show_streams', '-show_format', sourcePath];
  const { stdout } = await runProcess(appConfig.ffprobePath, args, 'ffprobe');
  const probe = JSON.parse(stdout);
  const videoStream = probe.streams?.find((stream) => stream.codec_type === 'video');

  if (!videoStream) {
    throw new Error('Uploaded file does not contain a video stream.');
  }

  const display = getDisplayDimensions(videoStream);
  if (!display) {
    throw new Error('Unable to detect video dimensions from uploaded file.');
  }

  return {
    raw: probe,
    videoStream,
    display,
    hasAudio: probe.streams?.some((stream) => stream.codec_type === 'audio') || false,
    durationSeconds: Number.parseFloat(videoStream.duration || probe.format?.duration || '0') || 0,
  };
}

async function transcodeRendition(sourcePath, probeResult, rendition, outputDir) {
  await fs.mkdir(outputDir, { recursive: true });

  const args = ['-y', '-i', sourcePath, '-map', '0:v:0'];
  if (probeResult.hasAudio) {
    args.push('-map', '0:a:0?');
  }

  args.push(
    '-vf',
    `scale=${rendition.outputWidth}:${rendition.outputHeight}:flags=lanczos`,
    '-c:v',
    'libx264',
    '-preset',
    appConfig.ffmpegPreset,
    '-pix_fmt',
    'yuv420p',
    '-sc_threshold',
    '0',
    '-force_key_frames',
    `expr:gte(t,n_forced*${appConfig.hlsSegmentDuration})`,
    '-b:v',
    rendition.videoBitrate,
    '-maxrate',
    rendition.maxRate,
    '-bufsize',
    rendition.bufSize,
  );

  if (probeResult.hasAudio) {
    args.push('-c:a', 'aac', '-ar', '48000', '-ac', '2', '-b:a', rendition.audioBitrate);
  } else {
    args.push('-an');
  }

  args.push(
    '-hls_time',
    String(appConfig.hlsSegmentDuration),
    '-hls_playlist_type',
    'vod',
    '-hls_flags',
    'independent_segments',
    '-hls_segment_filename',
    path.join(outputDir, 'segment_%05d.ts'),
    '-f',
    'hls',
    path.join(outputDir, 'index.m3u8'),
  );

  await runProcess(appConfig.ffmpegPath, args, 'ffmpeg');
}

async function publishStagedOutput(videoId, stagingDir) {
  const publishedDir = videoModel.getPublishedOutputDir(videoId);
  await fs.rm(publishedDir, { recursive: true, force: true });
  await fs.rename(stagingDir, publishedDir);
}

async function transcodeVideo(videoId, options = {}) {
  const record = await videoModel.readVideoRecord(videoId);
  if (!record?.source?.storedFilename) {
    throw new Error(`Video ${videoId} does not have an uploaded source file.`);
  }

  const sourcePath = videoModel.getSourcePath(videoId, record.source.storedFilename);
  const stagingDir = videoModel.getStagingOutputDir(videoId);

  await fs.rm(stagingDir, { recursive: true, force: true });
  await fs.mkdir(stagingDir, { recursive: true });

  if (typeof options.onStage === 'function') {
    await options.onStage({ stage: 'probing' });
  }

  const probeResult = await probeSource(sourcePath);
  const sourceWidth = probeResult.display.width;
  const sourceHeight = probeResult.display.height;
  const renditions = selectRenditions(sourceWidth, sourceHeight, probeResult);

  for (const rendition of renditions) {
    if (typeof options.onStage === 'function') {
      await options.onStage({
        stage: 'transcoding',
        currentRendition: rendition.id,
      });
    }

    await transcodeRendition(sourcePath, probeResult, rendition, path.join(stagingDir, rendition.id));
  }

  const masterPlaylist = createMasterPlaylist(renditions, probeResult.hasAudio);
  await fs.writeFile(path.join(stagingDir, 'master.m3u8'), masterPlaylist, 'utf8');
  await publishStagedOutput(videoId, stagingDir);

  return {
    durationSeconds: probeResult.durationSeconds,
    source: {
      width: sourceWidth,
      height: sourceHeight,
      rotation: probeResult.display.rotation,
    },
    renditions: renditions.map((rendition) => ({
      id: rendition.id,
      width: rendition.outputWidth,
      height: rendition.outputHeight,
      videoBitrate: rendition.videoBitrate,
      audioBitrate: probeResult.hasAudio ? rendition.audioBitrate : null,
      bandwidth: rendition.bandwidth,
      playlist: `${rendition.id}/index.m3u8`,
    })),
  };
}

module.exports = {
  transcodeVideo,
};
