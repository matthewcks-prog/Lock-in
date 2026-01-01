/**
 * Transcript controller job lifecycle tests.
 */

const test = require("node:test");
const assert = require("node:assert/strict");

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
        id: payload.jobId || "job-1",
        user_id: payload.userId,
        fingerprint: payload.fingerprint,
        status: "created",
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
    async cancelTranscriptProcessing() {
      flags.canceled = true;
    },
  };
}

function createRes() {
  return {
    statusCode: 200,
    jsonBody: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.jsonBody = payload;
      return this;
    },
  };
}

function createReq({ userId, jobId, body, headers }) {
  return {
    user: { id: userId },
    params: { id: jobId },
    body: body ?? {},
    headers: headers || {},
  };
}

function loadController({ repo, service }) {
  const repoPath = require.resolve("../../repositories/transcriptsRepository");
  const servicePath = require.resolve("../../services/transcriptsService");
  const controllerPath = require.resolve("../../controllers/transcriptsController");

  const originalRepo = require.cache[repoPath];
  const originalService = require.cache[servicePath];
  const originalController = require.cache[controllerPath];

  require.cache[repoPath] = { exports: repo };
  require.cache[servicePath] = { exports: service };
  delete require.cache[controllerPath];

  const controller = require("../../controllers/transcriptsController");

  return {
    controller,
    restore() {
      if (originalRepo) {
        require.cache[repoPath] = originalRepo;
      } else {
        delete require.cache[repoPath];
      }
      if (originalService) {
        require.cache[servicePath] = originalService;
      } else {
        delete require.cache[servicePath];
      }
      if (originalController) {
        require.cache[controllerPath] = originalController;
      } else {
        delete require.cache[controllerPath];
      }
    },
  };
}

test("accepts out-of-order chunks and marks job uploaded", async () => {
  const state = createRepoState();
  const flags = { started: false, canceled: false };
  const repo = createStubRepo(state);
  const service = createStubService(flags);
  const { controller, restore } = loadController({ repo, service });

  try {
    state.jobs.set("job-1", {
      id: "job-1",
      user_id: "user-1",
      status: "created",
      expected_total_chunks: 2,
      bytes_received: 0,
    });

    const res1 = createRes();
    await controller.uploadChunk(
      createReq({
        userId: "user-1",
        jobId: "job-1",
        body: Buffer.from("a"),
        headers: { "x-chunk-index": "1", "x-total-chunks": "2" },
      }),
      res1
    );

    assert.equal(state.jobs.get("job-1").status, "uploading");

    const res2 = createRes();
    await controller.uploadChunk(
      createReq({
        userId: "user-1",
        jobId: "job-1",
        body: Buffer.from("b"),
        headers: { "x-chunk-index": "0", "x-total-chunks": "2" },
      }),
      res2
    );

    assert.equal(state.jobs.get("job-1").status, "uploaded");
  } finally {
    restore();
  }
});

test("rejects finalize when chunks are missing", async () => {
  const state = createRepoState();
  const flags = { started: false, canceled: false };
  const repo = createStubRepo(state);
  const service = createStubService(flags);
  const { controller, restore } = loadController({ repo, service });

  try {
    state.jobs.set("job-2", {
      id: "job-2",
      user_id: "user-1",
      status: "uploading",
      expected_total_chunks: 2,
      bytes_received: 1,
      fingerprint: "fp-2",
    });
    state.chunks.set("job-2", new Map([[0, 1]]));

    const req = createReq({ userId: "user-1", jobId: "job-2", body: {} });
    const res = createRes();

    await assert.rejects(
      () => controller.finalizeJob(req, res),
      (err) => {
        assert.equal(err.code, "TRANSCRIPT_MISSING_CHUNKS");
        return true;
      }
    );
  } finally {
    restore();
  }
});

test("rejects chunk uploads after cancel", async () => {
  const state = createRepoState();
  const flags = { started: false, canceled: false };
  const repo = createStubRepo(state);
  const service = createStubService(flags);
  const { controller, restore } = loadController({ repo, service });

  try {
    state.jobs.set("job-3", {
      id: "job-3",
      user_id: "user-1",
      status: "uploading",
      expected_total_chunks: 2,
      bytes_received: 1,
    });

    const cancelRes = createRes();
    await controller.cancelJob(
      createReq({ userId: "user-1", jobId: "job-3", body: {} }),
      cancelRes
    );

    assert.equal(state.jobs.get("job-3").status, "canceled");

    const req = createReq({
      userId: "user-1",
      jobId: "job-3",
      body: Buffer.from("c"),
      headers: { "x-chunk-index": "1", "x-total-chunks": "2" },
    });
    const res = createRes();

    await assert.rejects(
      () => controller.uploadChunk(req, res),
      (err) => {
        assert.equal(err.code, "TRANSCRIPT_CANCELED");
        return true;
      }
    );
  } finally {
    restore();
  }
});

test("cancel mid-processing stops job", async () => {
  const state = createRepoState();
  const flags = { started: false, canceled: false };
  const repo = createStubRepo(state);
  const service = createStubService(flags);
  const { controller, restore } = loadController({ repo, service });

  try {
    state.jobs.set("job-4", {
      id: "job-4",
      user_id: "user-1",
      status: "processing",
      expected_total_chunks: 2,
      bytes_received: 2,
    });

    const res = createRes();
    await controller.cancelJob(
      createReq({ userId: "user-1", jobId: "job-4", body: {} }),
      res
    );

    assert.equal(state.jobs.get("job-4").status, "canceled");
    assert.equal(flags.canceled, true);
  } finally {
    restore();
  }
});
