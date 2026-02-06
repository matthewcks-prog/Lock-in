const { ValidationError, NotFoundError, AppError } = require('../../errors');
const { logger: baseLogger } = require('../../observability');
const transcriptsRepository = require('../../repositories/transcriptsRepository');
const transcriptsService = require('./transcriptsService');
const { cacheExternalTranscript } = require('./transcriptCacheService');
const {
  coerceNumber,
  getStartOfTodayUTC,
  normalizeMediaUrlForStorage,
  sanitizeMediaUrlForStorage,
} = require('./transcriptJobUtils');
const {
  TRANSCRIPT_DAILY_JOB_LIMIT,
  TRANSCRIPT_MAX_CONCURRENT_JOBS,
  TRANSCRIPT_MAX_TOTAL_BYTES,
  TRANSCRIPT_MAX_DURATION_MINUTES,
} = require('../../config');
const { JOB_STATUS } = require('./transcriptJobConstants');
const { enforceUploadRateLimit } = require('./transcriptJobRateLimit');
const {
  parseChunkHeaders,
  ensureValidUploadPayload,
  ensureJobUploadable,
  ensureChunkIndexInRange,
  parseExpectedTotalChunks,
} = require('./transcriptJobValidation');
const {
  updateJobUploadState,
  resolveFinalizeResponse,
  resolveExpectedChunks,
  ensureAllChunksPresent,
  buildProcessingUpdates,
} = require('./transcriptJobState');
const { createTranscriptJobsQueryService } = require('./transcriptJobsQueryService');

function createTranscriptJobsService(deps = {}) {
  const repo = deps.transcriptsRepository ?? transcriptsRepository;
  const processingService = deps.transcriptsService ?? transcriptsService;
  const cacheService = deps.transcriptCacheService ?? { cacheExternalTranscript };
  const logger = deps.logger ?? baseLogger;
  const queryService = createTranscriptJobsQueryService({ repo, cacheService, logger });

  async function createJob({ userId, payload } = {}) {
    const { fingerprint, mediaUrl, mediaUrlNormalized, durationMs, provider, expectedTotalChunks } =
      payload || {};

    if (!userId) {
      throw new ValidationError('User context missing');
    }
    if (!fingerprint || typeof fingerprint !== 'string') {
      throw new ValidationError('Fingerprint is required', 'fingerprint');
    }
    if (!mediaUrl || typeof mediaUrl !== 'string') {
      throw new ValidationError('mediaUrl is required', 'mediaUrl');
    }

    const normalized = normalizeMediaUrlForStorage(mediaUrlNormalized || mediaUrl);
    const redactedUrl = sanitizeMediaUrlForStorage(mediaUrl);
    const cached = await repo.getTranscriptByFingerprint({ fingerprint, userId });
    if (cached?.transcript_json) {
      return {
        success: true,
        job: {
          id: null,
          status: JOB_STATUS.DONE,
          transcript: cached.transcript_json,
          cached: true,
        },
      };
    }

    const dailyCount = await repo.countTranscriptJobsSince({
      userId,
      since: getStartOfTodayUTC().toISOString(),
    });
    if (dailyCount >= TRANSCRIPT_DAILY_JOB_LIMIT) {
      throw new AppError('Daily transcription limit reached.', 'TRANSCRIPT_DAILY_LIMIT', 429);
    }

    const activeCount = await repo.countActiveTranscriptJobs({ userId });
    if (activeCount >= TRANSCRIPT_MAX_CONCURRENT_JOBS) {
      throw new AppError('Too many active transcription jobs.', 'TRANSCRIPT_CONCURRENT_LIMIT', 429);
    }

    const durationMsValue = coerceNumber(durationMs);
    if (durationMsValue && TRANSCRIPT_MAX_DURATION_MINUTES) {
      const maxMs = TRANSCRIPT_MAX_DURATION_MINUTES * 60 * 1000;
      if (durationMsValue > maxMs) {
        throw new AppError(
          `Video exceeds ${TRANSCRIPT_MAX_DURATION_MINUTES} minute limit.`,
          'TRANSCRIPT_DURATION_LIMIT',
          400,
        );
      }
    }

    const expectedChunks = expectedTotalChunks
      ? parseExpectedTotalChunks(expectedTotalChunks)
      : null;

    const job = await repo.createTranscriptJob({
      userId,
      fingerprint,
      mediaUrl: redactedUrl,
      mediaUrlNormalized: normalized,
      durationMs: durationMsValue,
      provider,
      expectedTotalChunks: expectedChunks,
    });

    return {
      success: true,
      job: {
        id: job.id,
        status: job.status,
      },
    };
  }

  async function uploadChunk({ userId, jobId, chunk, headers } = {}) {
    const { chunkIndex, expectedTotalChunks } = parseChunkHeaders(headers);

    ensureValidUploadPayload(jobId, chunk, chunkIndex);

    const job = await repo.getTranscriptJob({ jobId, userId });
    if (!job) {
      throw new NotFoundError('Transcript job', jobId);
    }

    ensureJobUploadable(job);
    ensureChunkIndexInRange(job, chunkIndex, expectedTotalChunks);

    const bytesReceived = Number(job.bytes_received || 0);
    if (bytesReceived + chunk.length > TRANSCRIPT_MAX_TOTAL_BYTES) {
      throw new AppError('Upload exceeds maximum allowed size.', 'TRANSCRIPT_MAX_BYTES', 413);
    }

    await enforceUploadRateLimit(repo, userId, chunk.length);

    const insertResult = await repo.insertTranscriptJobChunk({
      jobId,
      chunkIndex,
      byteSize: chunk.length,
    });

    if (!insertResult.inserted) {
      return { success: true, duplicate: true };
    }

    try {
      await processingService.appendTranscriptChunk({ jobId, userId, chunk, chunkIndex });
    } catch (error) {
      await repo.deleteTranscriptJobChunk({ jobId, chunkIndex });
      throw error;
    }
    await updateJobUploadState({
      repo,
      job,
      jobId,
      userId,
      chunkLength: chunk.length,
      expectedTotalChunks,
    });

    return { success: true };
  }

  async function finalizeJob({ userId, jobId, payload } = {}) {
    const { languageHint, maxMinutes, expectedTotalChunks } = payload || {};

    const job = await repo.getTranscriptJob({ jobId, userId });
    if (!job) {
      throw new NotFoundError('Transcript job', jobId);
    }

    const earlyResponse = await resolveFinalizeResponse(repo, job, userId);
    if (earlyResponse) {
      return earlyResponse;
    }

    const expectedChunks = resolveExpectedChunks(job, expectedTotalChunks);
    await ensureAllChunksPresent(repo, jobId, expectedChunks);

    await repo.updateTranscriptJob({
      jobId,
      userId,
      updates: buildProcessingUpdates(expectedChunks, languageHint, maxMinutes),
    });

    processingService.startTranscriptProcessing(
      {
        ...job,
        expected_total_chunks: expectedChunks,
        language_hint: typeof languageHint === 'string' ? languageHint : null,
        max_minutes: coerceNumber(maxMinutes),
      },
      {
        languageHint: typeof languageHint === 'string' ? languageHint : null,
        maxMinutes: coerceNumber(maxMinutes),
      },
    );

    return {
      success: true,
      job: { id: job.id, status: JOB_STATUS.PROCESSING },
    };
  }

  async function cancelJob({ userId, jobId } = {}) {
    const job = await repo.getTranscriptJob({ jobId, userId });
    if (!job) {
      throw new NotFoundError('Transcript job', jobId);
    }

    if (job.status === JOB_STATUS.DONE || job.status === JOB_STATUS.ERROR) {
      return {
        success: true,
        job: { id: job.id, status: job.status, error: job.error || null },
      };
    }

    await repo.updateTranscriptJob({
      jobId,
      userId,
      updates: { status: JOB_STATUS.CANCELED, error: 'Canceled' },
    });

    return {
      success: true,
      job: { id: job.id, status: JOB_STATUS.CANCELED },
    };
  }

  return {
    createJob,
    uploadChunk,
    finalizeJob,
    cancelJob,
    ...queryService,
  };
}

const transcriptJobsService = createTranscriptJobsService();

module.exports = {
  createTranscriptJobsService,
  transcriptJobsService,
};
