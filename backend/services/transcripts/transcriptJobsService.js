const { AppError, ValidationError, NotFoundError } = require('../../errors');
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
  TRANSCRIPT_CHUNK_MAX_BYTES,
  TRANSCRIPT_MAX_CONCURRENT_JOBS,
  TRANSCRIPT_MAX_TOTAL_BYTES,
  TRANSCRIPT_MAX_DURATION_MINUTES,
  TRANSCRIPT_UPLOAD_BYTES_PER_MINUTE,
  TRANSCRIPT_PROCESSING_STALE_MINUTES,
} = require('../../config');

const JOB_STATUS = {
  CREATED: 'created',
  UPLOADING: 'uploading',
  UPLOADED: 'uploaded',
  PROCESSING: 'processing',
  DONE: 'done',
  ERROR: 'error',
  CANCELED: 'canceled',
};

const UPLOADABLE_STATUSES = new Set([JOB_STATUS.CREATED, JOB_STATUS.UPLOADING]);

async function enforceUploadRateLimit(repo, userId, bytes) {
  if (!userId || !Number.isFinite(TRANSCRIPT_UPLOAD_BYTES_PER_MINUTE)) return;
  const limit =
    Number.isFinite(TRANSCRIPT_UPLOAD_BYTES_PER_MINUTE) && TRANSCRIPT_UPLOAD_BYTES_PER_MINUTE > 0
      ? TRANSCRIPT_UPLOAD_BYTES_PER_MINUTE
      : null;
  if (!limit) return;

  const result = await repo.consumeTranscriptUploadBytes({ userId, bytes, limit });
  if (!result.allowed) {
    throw new AppError(
      'Upload rate limit exceeded. Please wait before uploading more.',
      'TRANSCRIPT_RATE_LIMIT',
      429,
      { retryAfterSeconds: result.retryAfterSeconds },
    );
  }
}

function parseExpectedTotalChunks(rawValue) {
  const value = coerceNumber(rawValue);
  if (value === null) return null;
  if (!Number.isInteger(value) || value <= 0) {
    throw new ValidationError('Expected total chunks must be a positive integer', 'x-total-chunks');
  }
  return value;
}

function ensureValidChunkIndex(chunkIndex) {
  if (!Number.isInteger(chunkIndex) || chunkIndex < 0) {
    throw new ValidationError('Chunk index must be a non-negative integer', 'x-chunk-index');
  }
}

function parseChunkHeaders(headers) {
  return {
    chunkIndex: coerceNumber(headers?.['x-chunk-index']),
    expectedTotalChunks: parseExpectedTotalChunks(headers?.['x-total-chunks']),
  };
}

function ensureValidUploadPayload(jobId, chunk, chunkIndex) {
  if (!jobId) {
    throw new ValidationError('Job ID is required', 'id');
  }
  if (!Buffer.isBuffer(chunk) || chunk.length === 0) {
    throw new ValidationError('Chunk payload is required', 'chunk');
  }
  if (Number.isFinite(TRANSCRIPT_CHUNK_MAX_BYTES) && chunk.length > TRANSCRIPT_CHUNK_MAX_BYTES) {
    throw new AppError('Chunk exceeds maximum allowed size.', 'TRANSCRIPT_CHUNK_TOO_LARGE', 413, {
      maxBytes: TRANSCRIPT_CHUNK_MAX_BYTES,
    });
  }
  if (chunkIndex === null) {
    throw new ValidationError('Chunk index header is required', 'x-chunk-index');
  }
  ensureValidChunkIndex(chunkIndex);
}

function ensureJobUploadable(job) {
  if (job.status === JOB_STATUS.CANCELED) {
    throw new AppError('This transcription job has been canceled.', 'TRANSCRIPT_CANCELED', 409);
  }
  if (!UPLOADABLE_STATUSES.has(job.status)) {
    throw new AppError('Job is no longer accepting chunks.', 'TRANSCRIPT_INVALID_STATE', 409);
  }
}

function ensureChunkIndexInRange(job, chunkIndex, expectedTotalChunks) {
  if (job.expected_total_chunks && chunkIndex >= Number(job.expected_total_chunks)) {
    throw new AppError(
      'Chunk index exceeds expected total chunks.',
      'TRANSCRIPT_CHUNK_OUT_OF_RANGE',
      400,
    );
  }
  if (
    expectedTotalChunks &&
    job.expected_total_chunks &&
    expectedTotalChunks !== Number(job.expected_total_chunks)
  ) {
    throw new AppError(
      'Expected total chunks header does not match job configuration.',
      'TRANSCRIPT_TOTAL_CHUNKS_MISMATCH',
      409,
    );
  }
}

async function updateJobUploadState({
  repo,
  job,
  jobId,
  userId,
  chunkLength,
  expectedTotalChunks,
}) {
  const bytesReceived = Number(job.bytes_received || 0);
  const updates = {
    status: job.status === JOB_STATUS.CREATED ? JOB_STATUS.UPLOADING : job.status,
    error: null,
    bytes_received: bytesReceived + chunkLength,
  };

  if (!job.expected_total_chunks && expectedTotalChunks) {
    updates.expected_total_chunks = expectedTotalChunks;
  }

  const expectedCount = Number(updates.expected_total_chunks ?? job.expected_total_chunks);
  if (Number.isFinite(expectedCount) && expectedCount > 0) {
    const stats = await repo.getTranscriptJobChunkStats(jobId);
    if (
      stats.count === expectedCount &&
      stats.minIndex === 0 &&
      stats.maxIndex === expectedCount - 1
    ) {
      updates.status = JOB_STATUS.UPLOADED;
    }
  }

  await repo.updateTranscriptJob({ jobId, userId, updates });
}

async function resolveFinalizeResponse(repo, job, userId) {
  if (job.status === JOB_STATUS.DONE) {
    const cached = await repo.getTranscriptByFingerprint({
      fingerprint: job.fingerprint,
      userId,
    });
    return {
      success: true,
      job: {
        id: job.id,
        status: JOB_STATUS.DONE,
        transcript: cached?.transcript_json || null,
      },
    };
  }

  if (job.status === JOB_STATUS.CANCELED) {
    return {
      success: true,
      job: { id: job.id, status: JOB_STATUS.CANCELED },
    };
  }

  if (job.status === JOB_STATUS.ERROR) {
    return {
      success: true,
      job: { id: job.id, status: JOB_STATUS.ERROR, error: job.error || null },
    };
  }

  if (job.status === JOB_STATUS.PROCESSING && !isProcessingStale(job)) {
    return {
      success: true,
      job: { id: job.id, status: JOB_STATUS.PROCESSING },
    };
  }

  return null;
}

function resolveExpectedChunks(job, expectedTotalChunks) {
  return (
    job.expected_total_chunks ??
    (expectedTotalChunks ? parseExpectedTotalChunks(expectedTotalChunks) : null)
  );
}

async function ensureAllChunksPresent(repo, jobId, expectedChunks) {
  if (!expectedChunks) {
    throw new AppError(
      'Expected total chunks not provided.',
      'TRANSCRIPT_TOTAL_CHUNKS_REQUIRED',
      400,
    );
  }

  const stats = await repo.getTranscriptJobChunkStats(jobId);
  if (
    stats.count !== expectedChunks ||
    stats.minIndex !== 0 ||
    stats.maxIndex !== expectedChunks - 1
  ) {
    throw new AppError('Upload incomplete: missing chunks.', 'TRANSCRIPT_MISSING_CHUNKS', 400, {
      expectedTotalChunks: expectedChunks,
      receivedChunks: stats.count,
    });
  }
}

function buildProcessingUpdates(expectedChunks, languageHint, maxMinutes) {
  return {
    status: JOB_STATUS.PROCESSING,
    error: null,
    expected_total_chunks: expectedChunks,
    language_hint: typeof languageHint === 'string' ? languageHint : null,
    max_minutes: coerceNumber(maxMinutes),
  };
}

function isProcessingStale(job) {
  if (!TRANSCRIPT_PROCESSING_STALE_MINUTES || !job) return false;
  const cutoff = Date.now() - TRANSCRIPT_PROCESSING_STALE_MINUTES * 60 * 1000;
  const heartbeat = job.processing_heartbeat_at
    ? new Date(job.processing_heartbeat_at).getTime()
    : null;
  const started = job.processing_started_at ? new Date(job.processing_started_at).getTime() : null;
  const reference = heartbeat ?? started;
  return reference !== null && Number.isFinite(reference) && reference < cutoff;
}

function createTranscriptJobsService(deps = {}) {
  const repo = deps.transcriptsRepository ?? transcriptsRepository;
  const processingService = deps.transcriptsService ?? transcriptsService;
  const cacheService = deps.transcriptCacheService ?? { cacheExternalTranscript };

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
        console.warn(`[Transcripts] Failed to cancel job ${job.id}:`, error);
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
    createJob,
    uploadChunk,
    finalizeJob,
    cancelJob,
    getJob,
    listActiveJobs,
    cancelAllActiveJobs,
    cacheTranscript,
  };
}

const transcriptJobsService = createTranscriptJobsService();

module.exports = {
  createTranscriptJobsService,
  transcriptJobsService,
};
