const fs = require('fs');
const path = require('path');
const { TRANSCRIPTION_TEMP_DIR } = require('../../config');
const { logger } = require('../../observability');

function getJobDir(jobId) {
  return path.join(TRANSCRIPTION_TEMP_DIR, jobId);
}

async function ensureJobDir(jobId) {
  const dir = getJobDir(jobId);
  await fs.promises.mkdir(dir, { recursive: true });
  return dir;
}

async function cleanupJobFiles(jobId) {
  const dir = getJobDir(jobId);
  try {
    await fs.promises.rm(dir, { recursive: true, force: true });
  } catch (error) {
    logger.warn({ err: error }, '[Transcripts] Failed to clean up job files');
  }
}

module.exports = {
  getJobDir,
  ensureJobDir,
  cleanupJobFiles,
};
