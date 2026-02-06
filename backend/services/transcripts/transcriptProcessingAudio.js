const fs = require('fs');
const path = require('path');
const { logger } = require('../../observability');
const { runFfmpeg, SEGMENT_DURATION_SECONDS } = require('./transcriptFfmpeg');
const { ensureNotCanceled } = require('./transcriptProcessingUtils');

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

  const SMALL_FILE_THRESHOLD = 20 * 1024 * 1024;
  if (stats.size <= SMALL_FILE_THRESHOLD) {
    logger.info(
      `[Transcripts] File size ${(stats.size / 1024 / 1024).toFixed(1)}MB - no splitting needed`,
    );
    return [{ path: audioPath, startMs: 0 }];
  }

  logger.info(
    `[Transcripts] File size ${(stats.size / 1024 / 1024).toFixed(
      1,
    )}MB - splitting into ${SEGMENT_DURATION_SECONDS / 60} minute segments`,
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
  const segments = files
    .filter((file) => file.startsWith('segment-') && file.endsWith('.mp3'))
    .sort()
    .map((file, index) => ({
      path: path.join(segmentsDir, file),
      startMs: index * SEGMENT_DURATION_SECONDS * 1000,
    }));

  logger.info(`[Transcripts] Created ${segments.length} segments for transcription`);
  return segments;
}

module.exports = {
  convertToAudio,
  splitAudioIfNeeded,
};
