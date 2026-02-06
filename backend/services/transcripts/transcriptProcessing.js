const { randomUUID } = require('crypto');
const {
  claimTranscriptJobForProcessing,
  getTranscriptJob,
  updateTranscriptJob,
} = require('../../repositories/transcriptsRepository');
const {
  TRANSCRIPT_PROCESSING_HEARTBEAT_INTERVAL_SECONDS,
  TRANSCRIPT_PROCESSING_STALE_MINUTES,
} = require('../../config');
const { logger } = require('../../observability');
const { uploadTranscriptChunk } = require('./transcriptStorage');
const { cleanupJobFiles } = require('./transcriptFs');
const { createProcessingState } = require('./transcriptProcessingUtils');
const { createProcessingMonitor } = require('./transcriptProcessingMonitor');
const { processTranscriptJob } = require('./transcriptProcessingJob');

const WORKER_ID = randomUUID();
const startProcessingMonitor = createProcessingMonitor({
  getTranscriptJob,
  updateTranscriptJob,
  logger,
  heartbeatIntervalSeconds: TRANSCRIPT_PROCESSING_HEARTBEAT_INTERVAL_SECONDS,
  workerId: WORKER_ID,
});

async function appendTranscriptChunk({ jobId, userId, chunk, chunkIndex }) {
  if (!userId) {
    throw new Error('Transcript chunk upload requires userId');
  }
  await uploadTranscriptChunk({ userId, jobId, chunkIndex, chunk });
  return { jobId, chunkIndex };
}

async function startTranscriptProcessing(job, options) {
  const staleMinutes = Math.max(1, TRANSCRIPT_PROCESSING_STALE_MINUTES);
  const staleBefore = new Date(Date.now() - staleMinutes * 60 * 1000).toISOString();
  const claimedJob = await claimTranscriptJobForProcessing({
    jobId: job.id,
    workerId: WORKER_ID,
    staleBefore,
  });

  if (!claimedJob) {
    logger.info({ jobId: job.id }, '[Transcripts] Job already claimed by another worker');
    return;
  }

  const state = createProcessingState(claimedJob);
  const stopMonitor = startProcessingMonitor(state);

  processTranscriptJob(claimedJob, options, state)
    .catch(async (error) => {
      const message = error instanceof Error ? error.message : String(error);
      const canceled = message === 'CANCELED' || state.cancelRequested;

      await updateTranscriptJob({
        jobId: claimedJob.id,
        userId: claimedJob.user_id,
        updates: {
          status: canceled ? 'canceled' : 'error',
          error: canceled ? 'Canceled' : message,
        },
      });

      await cleanupJobFiles(claimedJob.id);
    })
    .finally(() => {
      stopMonitor();
    });
}

module.exports = {
  appendTranscriptChunk,
  startTranscriptProcessing,
};
