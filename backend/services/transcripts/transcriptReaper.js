const {
  deleteTranscriptJobChunks,
  listTranscriptJobChunkIndices,
  listTranscriptJobsByHeartbeatBefore,
  listTranscriptJobsCreatedBefore,
  listTranscriptJobsByStatusBefore,
  updateTranscriptJob,
} = require('../../repositories/transcriptsRepository');
const {
  TRANSCRIPT_CHUNK_RETENTION_HOURS,
  TRANSCRIPT_CHUNK_HARD_TTL_DAYS,
  TRANSCRIPT_JOB_TTL_MINUTES,
  TRANSCRIPT_JOB_REAPER_INTERVAL_MINUTES,
  TRANSCRIPT_PROCESSING_STALE_MINUTES,
} = require('../../config');
const { logger } = require('../../observability');
const { removeTranscriptChunks } = require('./transcriptStorage');
const { cleanupJobFiles } = require('./transcriptFs');
const { startTranscriptProcessing } = require('./transcriptProcessing');

async function cleanupTranscriptChunksForJob(job, reason) {
  if (!job?.id || !job?.user_id) return { removed: 0 };
  const chunkIndices = await listTranscriptJobChunkIndices(job.id);
  if (chunkIndices.length === 0) return { removed: 0 };

  const batchSize = 100;
  let removed = 0;

  for (let i = 0; i < chunkIndices.length; i += batchSize) {
    const batch = chunkIndices.slice(i, i + batchSize);
    await removeTranscriptChunks({ userId: job.user_id, jobId: job.id, chunkIndices: batch });
    removed += batch.length;
  }

  await deleteTranscriptJobChunks(job.id);
  logger.info({ jobId: job.id, removed, reason }, '[Transcripts] Cleaned up transcript job chunks');

  return { removed };
}

async function cleanupCompletedTranscriptChunks() {
  const retentionMs = Math.max(1, TRANSCRIPT_CHUNK_RETENTION_HOURS) * 60 * 60 * 1000;
  const cutoff = new Date(Date.now() - retentionMs).toISOString();
  const jobs = await listTranscriptJobsByStatusBefore({
    statuses: ['done', 'error', 'canceled'],
    updatedBefore: cutoff,
  });

  for (const job of jobs) {
    try {
      await cleanupTranscriptChunksForJob(job, 'retention');
    } catch (error) {
      logger.warn({ err: error }, '[Transcripts] Failed to clean retained job chunks');
    }
  }

  return jobs.length;
}

async function cleanupExpiredTranscriptChunks() {
  const ttlMs = Math.max(1, TRANSCRIPT_CHUNK_HARD_TTL_DAYS) * 24 * 60 * 60 * 1000;
  const cutoff = new Date(Date.now() - ttlMs).toISOString();
  const jobs = await listTranscriptJobsCreatedBefore({ createdBefore: cutoff });

  for (const job of jobs) {
    try {
      const result = await cleanupTranscriptChunksForJob(job, 'hard-ttl');
      if (
        result.removed > 0 &&
        ['created', 'uploading', 'uploaded', 'processing'].includes(job.status)
      ) {
        await updateTranscriptJob({
          jobId: job.id,
          userId: job.user_id,
          updates: { status: 'error', error: 'Job exceeded retention TTL' },
        });
      }
    } catch (error) {
      logger.warn({ err: error }, '[Transcripts] Failed to clean expired job chunks');
    }
  }

  return jobs.length;
}

async function resumeStaleTranscriptJobs() {
  const staleMinutes = Math.max(1, TRANSCRIPT_PROCESSING_STALE_MINUTES);
  const staleBefore = new Date(Date.now() - staleMinutes * 60 * 1000).toISOString();
  const staleJobs = await listTranscriptJobsByHeartbeatBefore({
    statuses: ['processing'],
    heartbeatBefore: staleBefore,
  });

  for (const job of staleJobs) {
    try {
      await startTranscriptProcessing(job);
    } catch (error) {
      logger.warn({ err: error }, '[Transcripts] Failed to resume stale job');
    }
  }

  return staleJobs.length;
}

async function reapStaleTranscriptJobs() {
  const resumed = await resumeStaleTranscriptJobs();
  const ttlMs = Math.max(1, TRANSCRIPT_JOB_TTL_MINUTES) * 60 * 1000;
  const cutoff = new Date(Date.now() - ttlMs).toISOString();
  const staleJobs = await listTranscriptJobsByStatusBefore({
    statuses: ['created', 'uploading', 'uploaded', 'processing'],
    updatedBefore: cutoff,
  });

  for (const job of staleJobs) {
    try {
      await updateTranscriptJob({
        jobId: job.id,
        userId: job.user_id,
        updates: {
          status: 'error',
          error: 'Job expired before completion',
        },
      });
      await cleanupJobFiles(job.id);
    } catch (error) {
      logger.warn({ err: error }, '[Transcripts] Failed to mark stale job');
    }
  }

  const cleaned = await cleanupCompletedTranscriptChunks();
  const hardCleaned = await cleanupExpiredTranscriptChunks();

  return {
    reaped: staleJobs.length,
    resumed,
    cleaned,
    hardCleaned,
  };
}

let reaperInterval = null;

function startTranscriptJobReaper() {
  const intervalMs = Math.max(1, TRANSCRIPT_JOB_REAPER_INTERVAL_MINUTES) * 60 * 1000;

  reapStaleTranscriptJobs().catch((error) => {
    logger.warn({ err: error }, '[Transcripts] Initial job reaper run failed');
  });

  reaperInterval = setInterval(() => {
    reapStaleTranscriptJobs().catch((error) => {
      logger.warn({ err: error }, '[Transcripts] Job reaper run failed');
    });
  }, intervalMs);

  return () => stopTranscriptJobReaper();
}

function stopTranscriptJobReaper() {
  if (reaperInterval) {
    clearInterval(reaperInterval);
    reaperInterval = null;
  }
}

module.exports = {
  reapStaleTranscriptJobs,
  startTranscriptJobReaper,
  stopTranscriptJobReaper,
};
