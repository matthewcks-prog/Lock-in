const test = require('node:test');
const assert = require('node:assert/strict');

const {
  jobIdParamSchema,
  createJobSchema,
  finalizeJobSchema,
  cacheTranscriptSchema,
} = require('../transcriptValidators');

test('jobIdParamSchema accepts a valid UUID', () => {
  const result = jobIdParamSchema.safeParse({ id: '550e8400-e29b-41d4-a716-446655440000' });
  assert.equal(result.success, true);
});

test('jobIdParamSchema rejects an invalid UUID', () => {
  const result = jobIdParamSchema.safeParse({ id: 'invalid-id' });
  assert.equal(result.success, false);
});

test('createJobSchema accepts canonical transcript-job payload', () => {
  const result = createJobSchema.safeParse({
    fingerprint: 'fp-123',
    mediaUrl: 'https://example.com/media/video.mp4',
  });

  assert.equal(result.success, true);
  assert.equal(result.data.provider, 'unknown');
});

test('createJobSchema accepts optional fields and coerces numbers', () => {
  const result = createJobSchema.safeParse({
    fingerprint: 'fp-123',
    mediaUrl: 'https://example.com/media/video.mp4',
    mediaUrlNormalized: 'https://example.com/media/video.mp4',
    durationMs: '120000',
    provider: 'html5',
    expectedTotalChunks: '12',
  });

  assert.equal(result.success, true);
  assert.equal(result.data.durationMs, 120000);
  assert.equal(result.data.expectedTotalChunks, 12);
});

test('createJobSchema rejects missing fingerprint', () => {
  const result = createJobSchema.safeParse({
    mediaUrl: 'https://example.com/media/video.mp4',
  });
  assert.equal(result.success, false);
});

test('createJobSchema rejects invalid mediaUrl', () => {
  const result = createJobSchema.safeParse({
    fingerprint: 'fp-123',
    mediaUrl: 'not-a-url',
  });
  assert.equal(result.success, false);
});

test('createJobSchema rejects invalid expectedTotalChunks', () => {
  const result = createJobSchema.safeParse({
    fingerprint: 'fp-123',
    mediaUrl: 'https://example.com/media/video.mp4',
    expectedTotalChunks: 0,
  });
  assert.equal(result.success, false);
});

test('createJobSchema rejects legacy payload keys', () => {
  const result = createJobSchema.safeParse({
    videoId: 'legacy-id',
    videoUrl: 'https://example.com/video/legacy',
  });
  assert.equal(result.success, false);
});

test('finalizeJobSchema accepts expectedTotalChunks', () => {
  const result = finalizeJobSchema.safeParse({ expectedTotalChunks: 5 });
  assert.equal(result.success, true);
  assert.equal(result.data.expectedTotalChunks, 5);
});

test('finalizeJobSchema maps legacy totalChunks to expectedTotalChunks', () => {
  const result = finalizeJobSchema.safeParse({ totalChunks: 3 });
  assert.equal(result.success, true);
  assert.equal(result.data.expectedTotalChunks, 3);
});

test('finalizeJobSchema accepts languageHint and maxMinutes', () => {
  const result = finalizeJobSchema.safeParse({
    expectedTotalChunks: 4,
    languageHint: 'en',
    maxMinutes: 90,
  });
  assert.equal(result.success, true);
  assert.equal(result.data.languageHint, 'en');
  assert.equal(result.data.maxMinutes, 90);
});

test('finalizeJobSchema rejects invalid chunk counts', () => {
  const result = finalizeJobSchema.safeParse({ expectedTotalChunks: 0 });
  assert.equal(result.success, false);
});

function buildValidCachePayload(overrides = {}) {
  return {
    fingerprint: 'fp-123',
    provider: 'html5',
    transcript: {
      plainText: 'Hello world',
      segments: [{ startMs: 0, endMs: 1000, text: 'Hello world', speaker: 'Lecturer' }],
      durationMs: 1000,
    },
    ...overrides,
  };
}

test('cacheTranscriptSchema accepts canonical transcript cache payload', () => {
  const result = cacheTranscriptSchema.safeParse(
    buildValidCachePayload({
      meta: {
        mediaUrl: 'https://example.com/media/video.mp4',
        mediaUrlNormalized: 'https://example.com/media/video.mp4',
        etag: 'etag-1',
      },
    }),
  );

  assert.equal(result.success, true);
});

test('cacheTranscriptSchema trims transcript text fields', () => {
  const result = cacheTranscriptSchema.safeParse(
    buildValidCachePayload({
      transcript: {
        plainText: '  Hello world  ',
        segments: [{ startMs: 0, endMs: 1000, text: '  Hello world  ', speaker: '  Lecturer  ' }],
      },
    }),
  );

  assert.equal(result.success, true);
  assert.equal(result.data.transcript.plainText, 'Hello world');
  assert.equal(result.data.transcript.segments[0].text, 'Hello world');
  assert.equal(result.data.transcript.segments[0].speaker, 'Lecturer');
});

test('cacheTranscriptSchema rejects missing fingerprint', () => {
  const result = cacheTranscriptSchema.safeParse(
    buildValidCachePayload({
      fingerprint: undefined,
    }),
  );
  assert.equal(result.success, false);
});

test('cacheTranscriptSchema rejects empty segment list', () => {
  const result = cacheTranscriptSchema.safeParse(
    buildValidCachePayload({
      transcript: {
        plainText: 'Hello world',
        segments: [],
      },
    }),
  );
  assert.equal(result.success, false);
});

test('cacheTranscriptSchema rejects empty segment text after trim', () => {
  const result = cacheTranscriptSchema.safeParse(
    buildValidCachePayload({
      transcript: {
        plainText: 'Hello world',
        segments: [{ startMs: 0, endMs: 1000, text: '   ' }],
      },
    }),
  );
  assert.equal(result.success, false);
});

test('cacheTranscriptSchema rejects segments where endMs < startMs', () => {
  const result = cacheTranscriptSchema.safeParse(
    buildValidCachePayload({
      transcript: {
        plainText: 'Hello world',
        segments: [{ startMs: 1000, endMs: 999, text: 'Hello' }],
      },
    }),
  );
  assert.equal(result.success, false);
});
