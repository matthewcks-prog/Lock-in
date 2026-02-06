const { ValidationError, NotFoundError } = require('../../errors');
const { TRANSCRIPT_MAX_CONCURRENT_JOBS } = require('../../config');
const { JOB_STATUS } = require('./transcriptJobConstants');

function createTranscriptJobsQueryService({ repo, cacheService, logger }) {
  async function getJob({ userId, jobId } = {}) {
    const job = await repo.getTranscriptJob({ jobId, userId });
    if (!job) {
      throw new NotFoundError('Transcript job', jobId);
    }

    let transcript = null;
    if (job.status === JOB_STATUS.DONE) {
      const cached = await repo.getTranscriptByFingerprint({
        fingerprint: job.fingerprint,
        userId,
      });
      transcript = cached?.transcript_json || null;
    }

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

  async function listActiveJobs({ userId } = {}) {
    if (!userId) {
      throw new ValidationError('User context missing');
    }

    const jobs = await repo.listActiveTranscriptJobs({ userId });
    return {
      success: true,
      jobs: jobs.map((job) => ({
        id: job.id,
        status: job.status,
        fingerprint: job.fingerprint,
        mediaUrl: job.media_url,
        createdAt: job.created_at,
        updatedAt: job.updated_at,
      })),
      count: jobs.length,
      limit: TRANSCRIPT_MAX_CONCURRENT_JOBS,
    };
  }

  async function cancelAllActiveJobs({ userId } = {}) {
    if (!userId) {
      throw new ValidationError('User context missing');
    }

    const jobs = await repo.listActiveTranscriptJobs({ userId });
    const canceled = [];

    for (const job of jobs) {
      try {
        await repo.updateTranscriptJob({
          jobId: job.id,
          userId,
          updates: {
            status: JOB_STATUS.CANCELED,
            error: 'Canceled by user (bulk)',
          },
        });
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
  }

  async function cacheTranscript({ userId, payload } = {}) {
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
  }

  return {
    getJob,
    listActiveJobs,
    cancelAllActiveJobs,
    cacheTranscript,
  };
}

module.exports = {
  createTranscriptJobsQueryService,
};
