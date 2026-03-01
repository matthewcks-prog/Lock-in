/**
 * Transcript job lifecycle service tests.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { TRANSCRIPT_CHUNK_MAX_BYTES } = require('../../../config');
const { createTranscriptJobsService } = require('../transcriptJobsService');

function createRepoState() {
  return {
    jobs: new Map(),
    chunks: new Map(),
  };
}

function createStubRepo(state) {
  return {
    async createTranscriptJob(payload) {
      const job = {
        id: payload.jobId || 'job-1',
        user_id: payload.userId,
        fingerprint: payload.fingerprint,
        status: 'created',
        error: null,
        bytes_received: 0,
        expected_total_chunks: payload.expectedTotalChunks ?? null,
      };
      state.jobs.set(job.id, job);
      return job;
    },
    async getTranscriptJob({ jobId, userId }) {
      const job = state.jobs.get(jobId);
      if (!job || job.user_id !== userId) return null;
      return { ...job };
    },
    async updateTranscriptJob({ jobId, userId, updates }) {
      const job = state.jobs.get(jobId);
      if (!job || job.user_id !== userId) return null;
      const next = { ...job, ...updates };
      state.jobs.set(jobId, next);
      return next;
    },
    async getTranscriptByFingerprint() {
      return null;
    },
    async countTranscriptJobsSince() {
      return 0;
    },
    async countActiveTranscriptJobs() {
      return 0;
    },
    async insertTranscriptJobChunk({ jobId, chunkIndex, byteSize }) {
      const jobChunks = state.chunks.get(jobId) || new Map();
      if (jobChunks.has(chunkIndex)) {
        return { inserted: false };
      }
      jobChunks.set(chunkIndex, byteSize);
      state.chunks.set(jobId, jobChunks);
      return { inserted: true, data: { job_id: jobId, chunk_index: chunkIndex } };
    },
    async getTranscriptJobChunkStats(jobId) {
      const jobChunks = state.chunks.get(jobId) || new Map();
      const indices = Array.from(jobChunks.keys());
      const count = indices.length;
      const minIndex = count ? Math.min(...indices) : null;
      const maxIndex = count ? Math.max(...indices) : null;
      return { count, minIndex, maxIndex };
    },
    async deleteTranscriptJobChunk() {
      return null;
    },
    async consumeTranscriptUploadBytes() {
      return { allowed: true, remaining: 0, retryAfterSeconds: 0 };
    },
    async listActiveTranscriptJobs() {
      return [];
    },
  };
}

function createStubService(flags) {
  return {
    async appendTranscriptChunk() {
      return null;
    },
    startTranscriptProcessing() {
      flags.started = true;
    },
  };
}

test('accepts out-of-order chunks and marks job uploaded', async () => {
  const state = createRepoState();
  const flags = { started: false };
  const repo = createStubRepo(state);
  const processing = createStubService(flags);
  const service = createTranscriptJobsService({
    transcriptsRepository: repo,
    transcriptsService: processing,
  });

  state.jobs.set('job-1', {
    id: 'job-1',
    user_id: 'user-1',
    status: 'created',
    expected_total_chunks: 2,
    bytes_received: 0,
  });

  await service.uploadChunk({
    userId: 'user-1',
    jobId: 'job-1',
    chunk: Buffer.from('a'),
    headers: { 'x-chunk-index': '1', 'x-total-chunks': '2' },
  });

  assert.equal(state.jobs.get('job-1').status, 'uploading');

  await service.uploadChunk({
    userId: 'user-1',
    jobId: 'job-1',
    chunk: Buffer.from('b'),
    headers: { 'x-chunk-index': '0', 'x-total-chunks': '2' },
  });

  assert.equal(state.jobs.get('job-1').status, 'uploaded');
});

test('rejects finalize when chunks are missing', async () => {
  const state = createRepoState();
  const flags = { started: false };
  const repo = createStubRepo(state);
  const processing = createStubService(flags);
  const service = createTranscriptJobsService({
    transcriptsRepository: repo,
    transcriptsService: processing,
  });

  state.jobs.set('job-2', {
    id: 'job-2',
    user_id: 'user-1',
    status: 'uploading',
    expected_total_chunks: 2,
    bytes_received: 1,
    fingerprint: 'fp-2',
  });
  state.chunks.set('job-2', new Map([[0, 1]]));

  await assert.rejects(
    () => service.finalizeJob({ userId: 'user-1', jobId: 'job-2', payload: {} }),
    (err) => {
      assert.equal(err.code, 'TRANSCRIPT_MISSING_CHUNKS');
      return true;
    },
  );
});

test('rejects chunk uploads after cancel', async () => {
  const state = createRepoState();
  const flags = { started: false };
  const repo = createStubRepo(state);
  const processing = createStubService(flags);
  const service = createTranscriptJobsService({
    transcriptsRepository: repo,
    transcriptsService: processing,
  });

  state.jobs.set('job-3', {
    id: 'job-3',
    user_id: 'user-1',
    status: 'uploading',
    expected_total_chunks: 2,
    bytes_received: 1,
  });

  await service.cancelJob({ userId: 'user-1', jobId: 'job-3' });
  assert.equal(state.jobs.get('job-3').status, 'canceled');

  await assert.rejects(
    () =>
      service.uploadChunk({
        userId: 'user-1',
        jobId: 'job-3',
        chunk: Buffer.from('c'),
        headers: { 'x-chunk-index': '1', 'x-total-chunks': '2' },
      }),
    (err) => {
      assert.equal(err.code, 'TRANSCRIPT_CANCELED');
      return true;
    },
  );
});

test('cancel mid-processing stops job', async () => {
  const state = createRepoState();
  const flags = { started: false };
  const repo = createStubRepo(state);
  const processing = createStubService(flags);
  const service = createTranscriptJobsService({
    transcriptsRepository: repo,
    transcriptsService: processing,
  });

  state.jobs.set('job-4', {
    id: 'job-4',
    user_id: 'user-1',
    status: 'processing',
    expected_total_chunks: 2,
    bytes_received: 2,
  });

  await service.cancelJob({ userId: 'user-1', jobId: 'job-4' });

  assert.equal(state.jobs.get('job-4').status, 'canceled');
});

test('rate limits transcript chunk uploads', async () => {
  const state = createRepoState();
  const flags = { started: false };
  const repo = {
    ...createStubRepo(state),
    async consumeTranscriptUploadBytes() {
      return { allowed: false, remaining: 0, retryAfterSeconds: 12 };
    },
  };
  const processing = createStubService(flags);
  const service = createTranscriptJobsService({
    transcriptsRepository: repo,
    transcriptsService: processing,
  });

  state.jobs.set('job-5', {
    id: 'job-5',
    user_id: 'user-1',
    status: 'created',
    expected_total_chunks: 1,
    bytes_received: 0,
  });

  await assert.rejects(
    () =>
      service.uploadChunk({
        userId: 'user-1',
        jobId: 'job-5',
        chunk: Buffer.from('x'),
        headers: { 'x-chunk-index': '0', 'x-total-chunks': '1' },
      }),
    (err) => {
      assert.equal(err.code, 'TRANSCRIPT_RATE_LIMIT');
      assert.equal(err.statusCode, 429);
      assert.equal(err.details?.retryAfterSeconds, 12);
      return true;
    },
  );
});

test('rejects transcript chunks that exceed the max size', async (t) => {
  if (!Number.isFinite(TRANSCRIPT_CHUNK_MAX_BYTES)) {
    t.skip('TRANSCRIPT_CHUNK_MAX_BYTES is not configured');
    return;
  }
  if (TRANSCRIPT_CHUNK_MAX_BYTES > 32 * 1024 * 1024) {
    t.skip('TRANSCRIPT_CHUNK_MAX_BYTES is too large to allocate safely in unit tests');
    return;
  }

  const state = createRepoState();
  const flags = { started: false };
  const repo = createStubRepo(state);
  const processing = createStubService(flags);
  const service = createTranscriptJobsService({
    transcriptsRepository: repo,
    transcriptsService: processing,
  });

  state.jobs.set('job-6', {
    id: 'job-6',
    user_id: 'user-1',
    status: 'created',
    expected_total_chunks: 1,
    bytes_received: 0,
  });

  const oversizedChunk = Buffer.alloc(TRANSCRIPT_CHUNK_MAX_BYTES + 1, 0);

  await assert.rejects(
    () =>
      service.uploadChunk({
        userId: 'user-1',
        jobId: 'job-6',
        chunk: oversizedChunk,
        headers: { 'x-chunk-index': '0', 'x-total-chunks': '1' },
      }),
    (err) => {
      assert.equal(err.code, 'TRANSCRIPT_CHUNK_TOO_LARGE');
      assert.equal(err.statusCode, 413);
      return true;
    },
  );
});
