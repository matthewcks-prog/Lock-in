const { ValidationError, NotFoundError, AppError } = require('../../errors');
const { logger: baseLogger } = require('../../observability');
const transcriptsRepository = require('../../repositories/transcriptsRepository');
const transcriptsService = require('./transcriptsService');
const HTTP_STATUS = require('../../constants/httpStatus');
const { SIXTY, THOUSAND } = require('../../constants/numbers');
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

const MS_PER_MINUTE = SIXTY * THOUSAND;
const HTTP_STATUS_PAYLOAD_TOO_LARGE = 413;

function resolveServiceDependencies(deps) {
  return {
    repo: deps.transcriptsRepository ?? transcriptsRepository,
    processingService: deps.transcriptsService ?? transcriptsService,
    cacheService: deps.transcriptCacheService ?? { cacheExternalTranscript },
    logger: deps.logger ?? baseLogger,
  };
}

function parseCreateJobPayload(payload = {}) {
  const { fingerprint, mediaUrl, mediaUrlNormalized, durationMs, provider, expectedTotalChunks } =
    payload;
  return {
    fingerprint,
    mediaUrl,
    mediaUrlNormalized,
    durationMs,
    provider,
    expectedTotalChunks,
  };
}

function ensureCreateJobInput({ userId, fingerprint, mediaUrl }) {
  if (!userId) {
    throw new ValidationError('User context missing');
  }
  if (!fingerprint || typeof fingerprint !== 'string') {
    throw new ValidationError('Fingerprint is required', 'fingerprint');
  }
  if (!mediaUrl || typeof mediaUrl !== 'string') {
    throw new ValidationError('mediaUrl is required', 'mediaUrl');
  }
}

function buildCachedJobResponse(transcript) {
  return {
    success: true,
    job: {
      id: null,
      status: JOB_STATUS.DONE,
      transcript,
      cached: true,
    },
  };
}

function ensureDurationWithinLimit(durationMsValue) {
  if (!durationMsValue || !TRANSCRIPT_MAX_DURATION_MINUTES) {
    return;
  }

  const maxDurationMs = TRANSCRIPT_MAX_DURATION_MINUTES * MS_PER_MINUTE;
  if (durationMsValue > maxDurationMs) {
    throw new AppError(
      `Video exceeds ${TRANSCRIPT_MAX_DURATION_MINUTES} minute limit.`,
      'TRANSCRIPT_DURATION_LIMIT',
      HTTP_STATUS.BAD_REQUEST,
    );
  }
}

async function enforceJobCreationLimits({ repo, userId, durationMsValue }) {
  const dailyCount = await repo.countTranscriptJobsSince({
    userId,
    since: getStartOfTodayUTC().toISOString(),
  });
  if (dailyCount >= TRANSCRIPT_DAILY_JOB_LIMIT) {
    throw new AppError(
      'Daily transcription limit reached.',
      'TRANSCRIPT_DAILY_LIMIT',
      HTTP_STATUS.TOO_MANY_REQUESTS,
    );
  }

  const activeCount = await repo.countActiveTranscriptJobs({ userId });
  if (activeCount >= TRANSCRIPT_MAX_CONCURRENT_JOBS) {
    throw new AppError(
      'Too many active transcription jobs.',
      'TRANSCRIPT_CONCURRENT_LIMIT',
      HTTP_STATUS.TOO_MANY_REQUESTS,
    );
  }

  ensureDurationWithinLimit(durationMsValue);
}

function buildJobCreateParams({
  userId,
  fingerprint,
  redactedUrl,
  normalizedUrl,
  durationMsValue,
  provider,
  expectedChunks,
}) {
  return {
    userId,
    fingerprint,
    mediaUrl: redactedUrl,
    mediaUrlNormalized: normalizedUrl,
    durationMs: durationMsValue,
    provider,
    expectedTotalChunks: expectedChunks,
  };
}

async function createJobHandler({ repo }, { userId, payload } = {}) {
  const { fingerprint, mediaUrl, mediaUrlNormalized, durationMs, provider, expectedTotalChunks } =
    parseCreateJobPayload(payload);
  ensureCreateJobInput({ userId, fingerprint, mediaUrl });

  const normalizedUrl = normalizeMediaUrlForStorage(mediaUrlNormalized || mediaUrl);
  const redactedUrl = sanitizeMediaUrlForStorage(mediaUrl);
  const cached = await repo.getTranscriptByFingerprint({ fingerprint, userId });
  if (cached?.transcript_json) {
    return buildCachedJobResponse(cached.transcript_json);
  }

  const durationMsValue = coerceNumber(durationMs);
  await enforceJobCreationLimits({ repo, userId, durationMsValue });

  const expectedChunks = expectedTotalChunks ? parseExpectedTotalChunks(expectedTotalChunks) : null;
  const job = await repo.createTranscriptJob(
    buildJobCreateParams({
      userId,
      fingerprint,
      redactedUrl,
      normalizedUrl,
      durationMsValue,
      provider,
      expectedChunks,
    }),
  );

  return {
    success: true,
    job: { id: job.id, status: job.status },
  };
}

async function uploadChunkHandler(
  { repo, processingService },
  { userId, jobId, chunk, headers } = {},
) {
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
    throw new AppError(
      'Upload exceeds maximum allowed size.',
      'TRANSCRIPT_MAX_BYTES',
      HTTP_STATUS_PAYLOAD_TOO_LARGE,
    );
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

async function finalizeJobHandler({ repo, processingService }, { userId, jobId, payload } = {}) {
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

  const normalizedLanguageHint = typeof languageHint === 'string' ? languageHint : null;
  const normalizedMaxMinutes = coerceNumber(maxMinutes);
  await repo.updateTranscriptJob({
    jobId,
    userId,
    updates: buildProcessingUpdates(expectedChunks, languageHint, maxMinutes),
  });

  processingService.startTranscriptProcessing(
    {
      ...job,
      expected_total_chunks: expectedChunks,
      language_hint: normalizedLanguageHint,
      max_minutes: normalizedMaxMinutes,
    },
    { languageHint: normalizedLanguageHint, maxMinutes: normalizedMaxMinutes },
  );

  return {
    success: true,
    job: { id: job.id, status: JOB_STATUS.PROCESSING },
  };
}

async function cancelJobHandler({ repo }, { userId, jobId } = {}) {
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

function createTranscriptJobsService(deps = {}) {
  const serviceDeps = resolveServiceDependencies(deps);
  const queryService = createTranscriptJobsQueryService({
    repo: serviceDeps.repo,
    cacheService: serviceDeps.cacheService,
    logger: serviceDeps.logger,
  });

  return {
    createJob: (params) => createJobHandler(serviceDeps, params),
    uploadChunk: (params) => uploadChunkHandler(serviceDeps, params),
    finalizeJob: (params) => finalizeJobHandler(serviceDeps, params),
    cancelJob: (params) => cancelJobHandler(serviceDeps, params),
    ...queryService,
  };
}

const transcriptJobsService = createTranscriptJobsService();

module.exports = {
  createTranscriptJobsService,
  transcriptJobsService,
};
