const fs = require('fs');
const path = require('path');
const { listTranscriptJobChunkIndices } = require('../../repositories/transcriptsRepository');
const { downloadTranscriptChunk } = require('./transcriptStorage');
const { ensureNotCanceled } = require('./transcriptProcessingUtils');

async function writeStreamChunk(writeStream, chunk) {
  if (!writeStream.write(chunk)) {
    await new Promise((resolve) => writeStream.once('drain', resolve));
  }
}

async function assembleUploadFromChunks(job, jobDir, state) {
  ensureNotCanceled(state);
  const uploadPath = path.join(jobDir, 'media.bin');
  const chunkIndices = await listTranscriptJobChunkIndices(job.id);

  if (chunkIndices.length === 0) {
    throw new Error('Uploaded media not found for this job');
  }

  if (job.expected_total_chunks) {
    const expectedCount = Number(job.expected_total_chunks);
    if (chunkIndices.length !== expectedCount) {
      throw new Error('Uploaded chunks are incomplete');
    }
  }

  const writeStream = fs.createWriteStream(uploadPath);

  try {
    for (const chunkIndex of chunkIndices) {
      ensureNotCanceled(state);
      const chunk = await downloadTranscriptChunk({
        userId: job.user_id,
        jobId: job.id,
        chunkIndex,
      });
      await writeStreamChunk(writeStream, chunk);
    }
  } finally {
    writeStream.end();
  }

  return uploadPath;
}

module.exports = {
  assembleUploadFromChunks,
};
