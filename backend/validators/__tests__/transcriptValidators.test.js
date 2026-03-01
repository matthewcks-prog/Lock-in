// backend/validators/__tests__/transcriptValidators.test.js

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  jobIdParamSchema,
  createJobSchema,
  finalizeJobSchema,
  cacheTranscriptSchema,
} = require('../transcriptValidators');

// jobIdParamSchema tests
test('jobIdParamSchema - valid UUID', () => {
  const validData = {
    id: '550e8400-e29b-41d4-a716-446655440000',
  };

  const result = jobIdParamSchema.safeParse(validData);
  assert.equal(result.success, true);
});

test('jobIdParamSchema - reject invalid UUID', () => {
  const invalidData = {
    id: 'invalid-uuid',
  };

  const result = jobIdParamSchema.safeParse(invalidData);
  assert.equal(result.success, false);
});

test('jobIdParamSchema - reject missing id', () => {
  const invalidData = {};

  const result = jobIdParamSchema.safeParse(invalidData);
  assert.equal(result.success, false);
});

// createJobSchema tests
test('createJobSchema - valid minimal job', () => {
  const validData = {
    videoId: 'abc123',
    videoUrl: 'https://example.com/video/abc123',
  };

  const result = createJobSchema.safeParse(validData);
  assert.equal(result.success, true);
  assert.equal(result.data.provider, 'custom'); // Default value
});

test('createJobSchema - valid with provider', () => {
  const validData = {
    videoId: 'abc123',
    videoUrl: 'https://panopto.example.com/video/abc123',
    provider: 'panopto',
  };

  const result = createJobSchema.safeParse(validData);
  assert.equal(result.success, true);
  assert.equal(result.data.provider, 'panopto');
});

test('createJobSchema - valid with metadata', () => {
  const validData = {
    videoId: 'abc123',
    videoUrl: 'https://example.com/video/abc123',
    metadata: {
      title: 'Lecture 1: Introduction',
      duration: 3600,
    },
  };

  const result = createJobSchema.safeParse(validData);
  assert.equal(result.success, true);
});

test('createJobSchema - reject missing videoId', () => {
  const invalidData = {
    videoUrl: 'https://example.com/video/abc123',
  };

  const result = createJobSchema.safeParse(invalidData);
  assert.equal(result.success, false);
});

test('createJobSchema - reject empty videoId', () => {
  const invalidData = {
    videoId: '',
    videoUrl: 'https://example.com/video/abc123',
  };

  const result = createJobSchema.safeParse(invalidData);
  assert.equal(result.success, false);
});

test('createJobSchema - reject invalid videoUrl', () => {
  const invalidData = {
    videoId: 'abc123',
    videoUrl: 'not-a-valid-url',
  };

  const result = createJobSchema.safeParse(invalidData);
  assert.equal(result.success, false);
});

test('createJobSchema - reject invalid provider', () => {
  const invalidData = {
    videoId: 'abc123',
    videoUrl: 'https://example.com/video/abc123',
    provider: 'invalid_provider',
  };

  const result = createJobSchema.safeParse(invalidData);
  assert.equal(result.success, false);
});

// finalizeJobSchema tests
test('finalizeJobSchema - valid with totalChunks', () => {
  const validData = {
    totalChunks: 5,
  };

  const result = finalizeJobSchema.safeParse(validData);
  assert.equal(result.success, true);
});

test('finalizeJobSchema - valid with checksum', () => {
  const validData = {
    totalChunks: 3,
    checksum: 'abc123def456',
  };

  const result = finalizeJobSchema.safeParse(validData);
  assert.equal(result.success, true);
});

test('finalizeJobSchema - coerce string totalChunks', () => {
  const validData = {
    totalChunks: '10',
  };

  const result = finalizeJobSchema.safeParse(validData);
  assert.equal(result.success, true);
  assert.equal(result.data.totalChunks, 10);
});

test('finalizeJobSchema - reject zero totalChunks', () => {
  const invalidData = {
    totalChunks: 0,
  };

  const result = finalizeJobSchema.safeParse(invalidData);
  assert.equal(result.success, false);
});

test('finalizeJobSchema - reject negative totalChunks', () => {
  const invalidData = {
    totalChunks: -1,
  };

  const result = finalizeJobSchema.safeParse(invalidData);
  assert.equal(result.success, false);
});

// cacheTranscriptSchema tests
test('cacheTranscriptSchema - valid transcript', () => {
  const validData = {
    videoId: 'abc123',
    videoUrl: 'https://example.com/video/abc123',
    transcript: {
      segments: [
        { start: 0, end: 5, text: 'Hello world' },
        { start: 5, end: 10, text: 'This is a test' },
      ],
    },
  };

  const result = cacheTranscriptSchema.safeParse(validData);
  assert.equal(result.success, true);
});

test('cacheTranscriptSchema - valid with optional fields', () => {
  const validData = {
    videoId: 'abc123',
    videoUrl: 'https://example.com/video/abc123',
    transcript: {
      segments: [{ start: 0, end: 5, text: 'Hello' }],
      language: 'en',
      source: 'manual',
    },
    provider: 'youtube',
  };

  const result = cacheTranscriptSchema.safeParse(validData);
  assert.equal(result.success, true);
});

test('cacheTranscriptSchema - reject empty segments', () => {
  const invalidData = {
    videoId: 'abc123',
    videoUrl: 'https://example.com/video/abc123',
    transcript: {
      segments: [],
    },
  };

  const result = cacheTranscriptSchema.safeParse(invalidData);
  assert.equal(result.success, false);
});

test('cacheTranscriptSchema - reject missing transcript', () => {
  const invalidData = {
    videoId: 'abc123',
    videoUrl: 'https://example.com/video/abc123',
  };

  const result = cacheTranscriptSchema.safeParse(invalidData);
  assert.equal(result.success, false);
});

test('cacheTranscriptSchema - reject segment with negative start time', () => {
  const invalidData = {
    videoId: 'abc123',
    videoUrl: 'https://example.com/video/abc123',
    transcript: {
      segments: [{ start: -1, end: 5, text: 'Hello' }],
    },
  };

  const result = cacheTranscriptSchema.safeParse(invalidData);
  assert.equal(result.success, false);
});

test('cacheTranscriptSchema - reject invalid videoUrl', () => {
  const invalidData = {
    videoId: 'abc123',
    videoUrl: 'not-a-url',
    transcript: {
      segments: [{ start: 0, end: 5, text: 'Hello' }],
    },
  };

  const result = cacheTranscriptSchema.safeParse(invalidData);
  assert.equal(result.success, false);
});
