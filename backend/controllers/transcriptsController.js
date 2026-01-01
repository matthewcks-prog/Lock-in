const {
  AppError,
  ValidationError,
  NotFoundError,
} = require("../middleware/errorHandler");
const {
  createTranscriptJob,
  getTranscriptJob,
  updateTranscriptJob,
  getTranscriptByFingerprint,
  countTranscriptJobsSince,
  countActiveTranscriptJobs,
  insertTranscriptJobChunk,
  getTranscriptJobChunkStats,
  listActiveTranscriptJobs,
} = require("../repositories/transcriptsRepository");
const {
  appendTranscriptChunk,
  startTranscriptProcessing,
  cancelTranscriptProcessing,
} = require("../services/transcriptsService");
const {
  TRANSCRIPT_DAILY_JOB_LIMIT,
  TRANSCRIPT_MAX_CONCURRENT_JOBS,
  TRANSCRIPT_MAX_TOTAL_BYTES,
  TRANSCRIPT_MAX_DURATION_MINUTES,
  TRANSCRIPT_UPLOAD_BYTES_PER_MINUTE,
} = require("../config");

const JOB_STATUS = {
  CREATED: "created",
  UPLOADING: "uploading",
  UPLOADED: "uploaded",
  PROCESSING: "processing",
  DONE: "done",
  ERROR: "error",
  CANCELED: "canceled",
};

const ACTIVE_STATUSES = new Set([
  JOB_STATUS.CREATED,
  JOB_STATUS.UPLOADING,
  JOB_STATUS.UPLOADED,
  JOB_STATUS.PROCESSING,
]);

const UPLOADABLE_STATUSES = new Set([JOB_STATUS.CREATED, JOB_STATUS.UPLOADING]);

const UPLOAD_RATE_WINDOWS = new Map();
const UPLOAD_RATE_WINDOW_MS = 60 * 1000;

function sanitizeMediaUrlForStorage(mediaUrl) {
  if (!mediaUrl) return "";
  try {
    const url = new URL(mediaUrl);
    url.hash = "";
    url.search = "";
    const segments = url.pathname.split("/").map((segment) => {
      if (!segment) return segment;
      if (segment.length > 32) return "[redacted]";
      return segment;
    });
    url.pathname = segments.join("/");
    return url.toString();
  } catch {
    return "";
  }
}

function normalizeMediaUrlForStorage(mediaUrl) {
  return sanitizeMediaUrlForStorage(mediaUrl);
}

function coerceNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function getStartOfTodayUTC() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function enforceUploadRateLimit(userId, bytes) {
  if (!userId || !Number.isFinite(TRANSCRIPT_UPLOAD_BYTES_PER_MINUTE)) return;
  const now = Date.now();
  const entry = UPLOAD_RATE_WINDOWS.get(userId);
  const windowEntry =
    entry && now - entry.startedAt < UPLOAD_RATE_WINDOW_MS
      ? entry
      : { startedAt: now, bytes: 0 };

  if (windowEntry.bytes + bytes > TRANSCRIPT_UPLOAD_BYTES_PER_MINUTE) {
    const retryAfterSeconds = Math.ceil(
      (UPLOAD_RATE_WINDOW_MS - (now - windowEntry.startedAt)) / 1000
    );
    throw new AppError(
      "Upload rate limit exceeded. Please wait before uploading more.",
      "TRANSCRIPT_RATE_LIMIT",
      429,
      { retryAfterSeconds }
    );
  }

  windowEntry.bytes += bytes;
  UPLOAD_RATE_WINDOWS.set(userId, windowEntry);
}

function parseExpectedTotalChunks(rawValue) {
  const value = coerceNumber(rawValue);
  if (value === null) return null;
  if (!Number.isInteger(value) || value <= 0) {
    throw new ValidationError(
      "Expected total chunks must be a positive integer",
      "x-total-chunks"
    );
  }
  return value;
}

function ensureValidChunkIndex(chunkIndex) {
  if (!Number.isInteger(chunkIndex) || chunkIndex < 0) {
    throw new ValidationError(
      "Chunk index must be a non-negative integer",
      "x-chunk-index"
    );
  }
}

async function createJob(req, res) {
  const userId = req.user?.id;
  const {
    fingerprint,
    mediaUrl,
    mediaUrlNormalized,
    durationMs,
    provider,
    expectedTotalChunks,
  } = req.body || {};

  if (!userId) {
    throw new ValidationError("User context missing");
  }
  if (!fingerprint || typeof fingerprint !== "string") {
    throw new ValidationError("Fingerprint is required", "fingerprint");
  }
  if (!mediaUrl || typeof mediaUrl !== "string") {
    throw new ValidationError("mediaUrl is required", "mediaUrl");
  }

  const normalized = normalizeMediaUrlForStorage(mediaUrlNormalized || mediaUrl);
  const redactedUrl = sanitizeMediaUrlForStorage(mediaUrl);
  const cached = await getTranscriptByFingerprint({ fingerprint, userId });
  if (cached?.transcript_json) {
    return res.json({
      success: true,
      job: {
        id: null,
        status: JOB_STATUS.DONE,
        transcript: cached.transcript_json,
        cached: true,
      },
    });
  }

  const dailyCount = await countTranscriptJobsSince({
    userId,
    since: getStartOfTodayUTC().toISOString(),
  });
  if (dailyCount >= TRANSCRIPT_DAILY_JOB_LIMIT) {
    throw new AppError(
      "Daily transcription limit reached.",
      "TRANSCRIPT_DAILY_LIMIT",
      429
    );
  }

  const activeCount = await countActiveTranscriptJobs({ userId });
  if (activeCount >= TRANSCRIPT_MAX_CONCURRENT_JOBS) {
    throw new AppError(
      "Too many active transcription jobs.",
      "TRANSCRIPT_CONCURRENT_LIMIT",
      429
    );
  }

  const durationMsValue = coerceNumber(durationMs);
  if (durationMsValue && TRANSCRIPT_MAX_DURATION_MINUTES) {
    const maxMs = TRANSCRIPT_MAX_DURATION_MINUTES * 60 * 1000;
    if (durationMsValue > maxMs) {
      throw new AppError(
        `Video exceeds ${TRANSCRIPT_MAX_DURATION_MINUTES} minute limit.`,
        "TRANSCRIPT_DURATION_LIMIT",
        400
      );
    }
  }

  const expectedChunks = expectedTotalChunks
    ? parseExpectedTotalChunks(expectedTotalChunks)
    : null;

  const job = await createTranscriptJob({
    userId,
    fingerprint,
    mediaUrl: redactedUrl,
    mediaUrlNormalized: normalized,
    durationMs: durationMsValue,
    provider,
    expectedTotalChunks: expectedChunks,
  });

  return res.json({
    success: true,
    job: {
      id: job.id,
      status: job.status,
    },
  });
}

async function uploadChunk(req, res) {
  const userId = req.user?.id;
  const jobId = req.params.id;
  const chunkIndex = coerceNumber(req.headers["x-chunk-index"]);
  const expectedTotalChunks = parseExpectedTotalChunks(
    req.headers["x-total-chunks"]
  );

  if (!jobId) {
    throw new ValidationError("Job ID is required", "id");
  }
  if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
    throw new ValidationError("Chunk payload is required", "chunk");
  }
  if (chunkIndex === null) {
    throw new ValidationError("Chunk index header is required", "x-chunk-index");
  }
  ensureValidChunkIndex(chunkIndex);

  const job = await getTranscriptJob({ jobId, userId });
  if (!job) {
    throw new NotFoundError("Transcript job", jobId);
  }

  if (job.status === JOB_STATUS.CANCELED) {
    throw new AppError(
      "This transcription job has been canceled.",
      "TRANSCRIPT_CANCELED",
      409
    );
  }

  if (!UPLOADABLE_STATUSES.has(job.status)) {
    throw new AppError(
      "Job is no longer accepting chunks.",
      "TRANSCRIPT_INVALID_STATE",
      409
    );
  }

  if (
    job.expected_total_chunks &&
    chunkIndex >= Number(job.expected_total_chunks)
  ) {
    throw new AppError(
      "Chunk index exceeds expected total chunks.",
      "TRANSCRIPT_CHUNK_OUT_OF_RANGE",
      400
    );
  }

  if (
    expectedTotalChunks &&
    job.expected_total_chunks &&
    expectedTotalChunks !== Number(job.expected_total_chunks)
  ) {
    throw new AppError(
      "Expected total chunks header does not match job configuration.",
      "TRANSCRIPT_TOTAL_CHUNKS_MISMATCH",
      409
    );
  }

  const bytesReceived = Number(job.bytes_received || 0);
  if (bytesReceived + req.body.length > TRANSCRIPT_MAX_TOTAL_BYTES) {
    throw new AppError(
      "Upload exceeds maximum allowed size.",
      "TRANSCRIPT_MAX_BYTES",
      413
    );
  }

  enforceUploadRateLimit(userId, req.body.length);

  const insertResult = await insertTranscriptJobChunk({
    jobId,
    chunkIndex,
    byteSize: req.body.length,
  });

  if (!insertResult.inserted) {
    return res.json({ success: true, duplicate: true });
  }

  await appendTranscriptChunk(jobId, req.body, chunkIndex);
  const updates = {
    status: job.status === JOB_STATUS.CREATED ? JOB_STATUS.UPLOADING : job.status,
    error: null,
    bytes_received: bytesReceived + req.body.length,
  };

  if (!job.expected_total_chunks && expectedTotalChunks) {
    updates.expected_total_chunks = expectedTotalChunks;
  }

  const expectedCount = Number(
    updates.expected_total_chunks ?? job.expected_total_chunks
  );
  if (Number.isFinite(expectedCount) && expectedCount > 0) {
    const stats = await getTranscriptJobChunkStats(jobId);
    if (
      stats.count === expectedCount &&
      stats.minIndex === 0 &&
      stats.maxIndex === expectedCount - 1
    ) {
      updates.status = JOB_STATUS.UPLOADED;
    }
  }

  await updateTranscriptJob({ jobId, userId, updates });

  return res.json({ success: true });
}

async function finalizeJob(req, res) {
  const userId = req.user?.id;
  const jobId = req.params.id;
  const { languageHint, maxMinutes, expectedTotalChunks } = req.body || {};

  const job = await getTranscriptJob({ jobId, userId });
  if (!job) {
    throw new NotFoundError("Transcript job", jobId);
  }

  if (job.status === JOB_STATUS.DONE) {
    const cached = await getTranscriptByFingerprint({ fingerprint: job.fingerprint, userId });
    return res.json({
      success: true,
      job: {
        id: job.id,
        status: JOB_STATUS.DONE,
        transcript: cached?.transcript_json || null,
      },
    });
  }

  if (job.status === JOB_STATUS.CANCELED) {
    return res.json({
      success: true,
      job: { id: job.id, status: JOB_STATUS.CANCELED },
    });
  }

  if (job.status === JOB_STATUS.ERROR) {
    return res.json({
      success: true,
      job: { id: job.id, status: JOB_STATUS.ERROR, error: job.error || null },
    });
  }

  const expectedChunks =
    job.expected_total_chunks ??
    (expectedTotalChunks ? parseExpectedTotalChunks(expectedTotalChunks) : null);

  if (!expectedChunks) {
    throw new AppError(
      "Expected total chunks not provided.",
      "TRANSCRIPT_TOTAL_CHUNKS_REQUIRED",
      400
    );
  }

  const stats = await getTranscriptJobChunkStats(jobId);
  if (
    stats.count !== expectedChunks ||
    stats.minIndex !== 0 ||
    stats.maxIndex !== expectedChunks - 1
  ) {
    throw new AppError(
      "Upload incomplete: missing chunks.",
      "TRANSCRIPT_MISSING_CHUNKS",
      400,
      {
        expectedTotalChunks: expectedChunks,
        receivedChunks: stats.count,
      }
    );
  }

  await updateTranscriptJob({
    jobId,
    userId,
    updates: {
      status: JOB_STATUS.PROCESSING,
      error: null,
      expected_total_chunks: expectedChunks,
    },
  });

  startTranscriptProcessing(
    { ...job, expected_total_chunks: expectedChunks },
    {
      languageHint: typeof languageHint === "string" ? languageHint : null,
      maxMinutes: coerceNumber(maxMinutes),
    }
  );

  return res.json({
    success: true,
    job: { id: job.id, status: JOB_STATUS.PROCESSING },
  });
}

async function cancelJob(req, res) {
  const userId = req.user?.id;
  const jobId = req.params.id;

  const job = await getTranscriptJob({ jobId, userId });
  if (!job) {
    throw new NotFoundError("Transcript job", jobId);
  }

  if (job.status === JOB_STATUS.DONE || job.status === JOB_STATUS.ERROR) {
    return res.json({
      success: true,
      job: { id: job.id, status: job.status, error: job.error || null },
    });
  }

  await cancelTranscriptProcessing(jobId);
  await updateTranscriptJob({
    jobId,
    userId,
    updates: { status: JOB_STATUS.CANCELED, error: "Canceled" },
  });

  return res.json({
    success: true,
    job: { id: job.id, status: JOB_STATUS.CANCELED },
  });
}

async function getJob(req, res) {
  const userId = req.user?.id;
  const jobId = req.params.id;

  const job = await getTranscriptJob({ jobId, userId });
  if (!job) {
    throw new NotFoundError("Transcript job", jobId);
  }

  let transcript = null;
  if (job.status === JOB_STATUS.DONE) {
    const cached = await getTranscriptByFingerprint({ fingerprint: job.fingerprint, userId });
    transcript = cached?.transcript_json || null;
  }

  return res.json({
    success: true,
    job: {
      id: job.id,
      status: job.status,
      error: job.error || null,
      transcript,
    },
  });
}

async function listActiveJobs(req, res) {
  const userId = req.user?.id;
  if (!userId) {
    throw new ValidationError("User context missing");
  }

  const jobs = await listActiveTranscriptJobs({ userId });
  return res.json({
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
  });
}

async function cancelAllActiveJobs(req, res) {
  const userId = req.user?.id;
  if (!userId) {
    throw new ValidationError("User context missing");
  }

  const jobs = await listActiveTranscriptJobs({ userId });
  const canceled = [];

  for (const job of jobs) {
    try {
      await cancelTranscriptProcessing(job.id);
      await updateTranscriptJob({
        jobId: job.id,
        userId,
        updates: { status: JOB_STATUS.CANCELED, error: "Canceled by user (bulk)" },
      });
      canceled.push(job.id);
    } catch (error) {
      console.warn(`[Transcripts] Failed to cancel job ${job.id}:`, error);
    }
  }

  return res.json({
    success: true,
    canceledCount: canceled.length,
    canceledIds: canceled,
  });
}

module.exports = {
  createJob,
  uploadChunk,
  finalizeJob,
  cancelJob,
  getJob,
  listActiveJobs,
  cancelAllActiveJobs,
};
