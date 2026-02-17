const { ValidationError, NotFoundError } = require('../../errors');
const { TRANSCRIPT_MAX_CONCURRENT_JOBS } = require('../../config');
const { JOB_STATUS } = require('./transcriptJobConstants');

function assertUserId(userId) {
  if (!userId) {
    throw new ValidationError('User context missing');
  }
}

function createGetJobResponse(job, transcript) {
  return {
    success: true,
    job: {
      id: job.id,
      status: job.status,
      error: job.error || null,
      transcript,
    },
  };
}

async function resolveDoneTranscript(repo, job, userId) {
  if (job.status !== JOB_STATUS.DONE) {
    return null;
  }

  const cached = await repo.getTranscriptByFingerprint({
    fingerprint: job.fingerprint,
    userId,
  });
  return cached?.transcript_json || null;
}

function mapActiveJob(job) {
  return {
    id: job.id,
    status: job.status,
    fingerprint: job.fingerprint,
    mediaUrl: job.media_url,
    createdAt: job.created_at,
    updatedAt: job.updated_at,
  };
}

function createGetJob(repo) {
  return async function getJob({ userId, jobId } = {}) {
    const job = await repo.getTranscriptJob({ jobId, userId });
    if (!job) {
      throw new NotFoundError('Transcript job', jobId);
    }

    const transcript = await resolveDoneTranscript(repo, job, userId);
    return createGetJobResponse(job, transcript);
  };
}

function createListActiveJobs(repo) {
  return async function listActiveJobs({ userId } = {}) {
    assertUserId(userId);
    const jobs = await repo.listActiveTranscriptJobs({ userId });
    return {
      success: true,
      jobs: jobs.map(mapActiveJob),
      count: jobs.length,
      limit: TRANSCRIPT_MAX_CONCURRENT_JOBS,
    };
  };
}

async function cancelJob(repo, { jobId, userId }) {
  await repo.updateTranscriptJob({
    jobId,
    userId,
    updates: {
      status: JOB_STATUS.CANCELED,
      error: 'Canceled by user (bulk)',
    },
  });
}

function createCancelAllActiveJobs({ repo, logger }) {
  return async function cancelAllActiveJobs({ userId } = {}) {
    assertUserId(userId);
    const jobs = await repo.listActiveTranscriptJobs({ userId });
    const canceled = [];

    for (const job of jobs) {
      try {
        await cancelJob(repo, { jobId: job.id, userId });
        canceled.push(job.id);
      } catch (error) {
        logger.warn({ err: error, jobId: job.id }, '[Transcripts] Failed to cancel job');
      }
    }

    return {
      success: true,
      canceledCount: canceled.length,
      canceledIds: canceled,
    };
  };
}

function createCacheTranscript(cacheService) {
  return async function cacheTranscript({ userId, payload } = {}) {
    const { fingerprint, provider, transcript, meta } = payload || {};
    const cached = await cacheService.cacheExternalTranscript({
      userId,
      fingerprint,
      provider,
      transcript,
      meta,
    });

    return {
      success: true,
      fingerprint: cached?.fingerprint || fingerprint,
      cachedAt: cached?.created_at || null,
    };
  };
}

function createTranscriptJobsQueryService({ repo, cacheService, logger }) {
  return {
    getJob: createGetJob(repo),
    listActiveJobs: createListActiveJobs(repo),
    cancelAllActiveJobs: createCancelAllActiveJobs({ repo, logger }),
    cacheTranscript: createCacheTranscript(cacheService),
  };
}

module.exports = {
  createTranscriptJobsQueryService,
};
