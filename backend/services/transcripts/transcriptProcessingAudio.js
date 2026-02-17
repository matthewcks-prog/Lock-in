const fs = require('fs');
const path = require('path');
const { logger } = require('../../observability');
const { SIXTY, THOUSAND } = require('../../constants/numbers');
const { runFfmpeg, SEGMENT_DURATION_SECONDS } = require('./transcriptFfmpeg');
const { ensureNotCanceled } = require('./transcriptProcessingUtils');

const BYTES_PER_KIBIBYTE = 1024;
const BYTES_PER_MEBIBYTE = BYTES_PER_KIBIBYTE * BYTES_PER_KIBIBYTE;
const SMALL_FILE_THRESHOLD_MB = 20;
const SMALL_FILE_THRESHOLD_BYTES = SMALL_FILE_THRESHOLD_MB * BYTES_PER_MEBIBYTE;
const ZERO_START_MS = 0;
const SECONDS_PER_MINUTE = SIXTY;
const MS_PER_SECOND = THOUSAND;

function formatMegabytes(byteCount) {
  return (byteCount / BYTES_PER_MEBIBYTE).toFixed(1);
}

function collectSegments(files, segmentsDir) {
  return files
    .filter((file) => file.startsWith('segment-') && file.endsWith('.mp3'))
    .sort()
    .map((file, index) => ({
      path: path.join(segmentsDir, file),
      startMs: index * SEGMENT_DURATION_SECONDS * MS_PER_SECOND,
    }));
}

/**
 * Convert input media to MP3 format optimized for Whisper API.
 * Uses 64kbps mono audio - ideal balance of quality and file size.
 */
async function convertToAudio(inputPath, outputPath, state) {
  ensureNotCanceled(state);
  await runFfmpeg(
    [
      '-y',
      '-i',
      inputPath,
      '-vn',
      '-ac',
      '1',
      '-ar',
      '16000',
      '-b:a',
      '64k',
      '-f',
      'mp3',
      outputPath,
    ],
    state,
  );
}

/**
 * Split audio into segments for reliable transcription.
 * Uses time-based splitting (5 min segments) rather than size-based.
 */
async function splitAudioIfNeeded(audioPath, jobDir, state) {
  ensureNotCanceled(state);
  const stats = await fs.promises.stat(audioPath);

  if (stats.size <= SMALL_FILE_THRESHOLD_BYTES) {
    logger.info(`[Transcripts] File size ${formatMegabytes(stats.size)}MB - no splitting needed`);
    return [{ path: audioPath, startMs: ZERO_START_MS }];
  }

  logger.info(
    `[Transcripts] File size ${formatMegabytes(stats.size)}MB - splitting into ${
      SEGMENT_DURATION_SECONDS / SECONDS_PER_MINUTE
    } minute segments`,
  );
  const segmentsDir = path.join(jobDir, 'segments');
  await fs.promises.mkdir(segmentsDir, { recursive: true });
  const outputPattern = path.join(segmentsDir, 'segment-%03d.mp3');

  await runFfmpeg(
    [
      '-y',
      '-i',
      audioPath,
      '-vn',
      '-f',
      'segment',
      '-segment_time',
      String(SEGMENT_DURATION_SECONDS),
      '-reset_timestamps',
      '1',
      '-ac',
      '1',
      '-ar',
      '16000',
      '-b:a',
      '64k',
      outputPattern,
    ],
    state,
  );

  const files = await fs.promises.readdir(segmentsDir);
  const segments = collectSegments(files, segmentsDir);

  logger.info(`[Transcripts] Created ${segments.length} segments for transcription`);
  return segments;
}

module.exports = {
  convertToAudio,
  splitAudioIfNeeded,
};
