const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

function loadService(repo) {
  const repoPath = require.resolve('../../repositories/transcriptsRepository');
  const servicePath = require.resolve('../../services/transcripts/transcriptCacheService');

  const originalRepo = require.cache[repoPath];
  const originalService = require.cache[servicePath];

  const repoModule = new Module(repoPath, module);
  repoModule.filename = repoPath;
  repoModule.exports = repo;
  repoModule.loaded = true;

  require.cache[repoPath] = repoModule;
  delete require.cache[servicePath];

  const service = require('../../services/transcripts/transcriptCacheService');

  return {
    service,
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
    },
  };
}

test('cacheExternalTranscript requires fingerprint and transcript', async () => {
  const repo = {
    async upsertTranscriptCache() {
      return null;
    },
  };
  const { service, restore } = loadService(repo);

  try {
    await assert.rejects(
      () =>
        service.cacheExternalTranscript({
          userId: 'user-1',
          provider: 'html5',
          transcript: { plainText: 'Hello', segments: [] },
        }),
      (err) => {
        assert.equal(err.code, 'VALIDATION_ERROR');
        assert.match(err.message, /Fingerprint/);
        return true;
      },
    );

    await assert.rejects(
      () =>
        service.cacheExternalTranscript({
          userId: 'user-1',
          fingerprint: 'fp-1',
          provider: 'html5',
        }),
      (err) => {
        assert.equal(err.code, 'VALIDATION_ERROR');
        assert.match(err.message, /Transcript/);
        return true;
      },
    );
  } finally {
    restore();
  }
});

test('cacheExternalTranscript normalizes transcript payload and URLs', async () => {
  const calls = [];
  const repo = {
    async upsertTranscriptCache(payload) {
      calls.push(payload);
      return {
        fingerprint: payload.fingerprint,
        created_at: '2026-01-25T00:00:00.000Z',
      };
    },
  };
  const { service, restore } = loadService(repo);

  try {
    const result = await service.cacheExternalTranscript({
      userId: 'user-1',
      fingerprint: '  fp-1  ',
      provider: 'html5',
      transcript: {
        plainText: '  Hello world  ',
        segments: [
          { startMs: 0, endMs: 1000, text: 'Hello world' },
          { startMs: 'oops', text: 'skip' },
          { startMs: 2000, text: '   ' },
        ],
        durationMs: 1111,
      },
      meta: {
        mediaUrl:
          'https://example.com/media/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa?token=secret#frag',
        durationMs: 2222,
      },
    });

    assert.equal(result.fingerprint, 'fp-1');
    assert.equal(calls.length, 1);
    const payload = calls[0];

    assert.equal(payload.fingerprint, 'fp-1');
    assert.equal(payload.provider, 'html5');
    assert.equal(payload.durationMs, 2222);
    assert.equal(payload.mediaUrlRedacted, 'https://example.com/media/[redacted]');
    assert.equal(payload.mediaUrlNormalized, 'https://example.com/media/[redacted]');
    assert.equal(payload.transcriptJson.plainText, 'Hello world');
    assert.equal(payload.transcriptJson.segments.length, 1);
  } finally {
    restore();
  }
});

test('cacheExternalTranscript rejects transcripts without valid segments', async () => {
  const repo = {
    async upsertTranscriptCache() {
      return null;
    },
  };
  const { service, restore } = loadService(repo);

  try {
    await assert.rejects(
      () =>
        service.cacheExternalTranscript({
          userId: 'user-1',
          fingerprint: 'fp-1',
          provider: 'html5',
          transcript: {
            plainText: 'Has text but no valid segments',
            segments: [{ startMs: 'oops', text: 'invalid segment' }],
          },
        }),
      (err) => {
        assert.equal(err.code, 'VALIDATION_ERROR');
        assert.match(err.message, /at least one valid segment/i);
        return true;
      },
    );
  } finally {
    restore();
  }
});
