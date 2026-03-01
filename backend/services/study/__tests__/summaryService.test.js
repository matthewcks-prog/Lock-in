const test = require('node:test');
const assert = require('node:assert/strict');

const { createSummaryService } = require('../summaryService');

function createPayload(overrides = {}) {
  return {
    transcript: {
      plainText: 'Intro text',
      segments: [{ startMs: 0, endMs: 2000, text: 'Intro text', speaker: 'Professor' }],
      durationMs: 2000,
    },
    depth: 'standard',
    includeJson: true,
    ...overrides,
  };
}

function createService(overrides = {}) {
  const createChatCompletion = async () => ({
    choices: [{ message: { content: '# Study pack' } }],
  });
  const checkDailyLimit = async () => ({ allowed: true });
  const logger = {
    error: () => {},
  };

  return createSummaryService({
    llmClient: { createChatCompletion, ...overrides.llmClient },
    rateLimitService: { checkDailyLimit, ...overrides.rateLimitService },
    logger: { ...logger, ...overrides.logger },
  });
}

test('generateStudySummary returns markdown for direct mode', async () => {
  const calls = [];
  const service = createService({
    llmClient: {
      createChatCompletion: async (request) => {
        calls.push(request.operation);
        return {
          choices: [{ message: { content: '## Final summary' } }],
        };
      },
    },
  });

  const response = await service.generateStudySummary({
    userId: 'user-1',
    payload: createPayload({ depth: 'brief' }),
  });

  assert.equal(response.success, true);
  assert.equal(response.data.depth, 'brief');
  assert.equal(response.data.chunked, false);
  assert.equal(response.data.chunkCount, 1);
  assert.equal(response.data.markdown, '## Final summary');
  assert.deepEqual(calls, ['study.summary.generate']);
});

test('generateStudySummary chunks long transcripts before final synthesis', async () => {
  const calls = [];
  const longText = 'A'.repeat(400);
  const longSegments = Array.from({ length: 320 }, (_, index) => ({
    startMs: index * 1000,
    endMs: index * 1000 + 900,
    text: longText,
    speaker: 'Lecturer',
  }));

  const service = createService({
    llmClient: {
      createChatCompletion: async (request) => {
        calls.push(request.operation);
        if (String(request.operation).startsWith('study.summary.chunk.')) {
          return {
            choices: [{ message: { content: '- chunk digest (evidence: "A" @ 00:00)' } }],
          };
        }
        return {
          choices: [{ message: { content: '# Synthesized summary' } }],
        };
      },
    },
  });

  const response = await service.generateStudySummary({
    userId: 'user-1',
    payload: createPayload({
      transcript: {
        plainText: longSegments.map((segment) => segment.text).join(' '),
        segments: longSegments,
      },
    }),
  });

  assert.equal(response.success, true);
  assert.equal(response.data.chunked, true);
  assert.ok(response.data.chunkCount > 1);
  assert.equal(calls[calls.length - 1], 'study.summary.generate');
  assert.ok(calls.some((operation) => operation.startsWith('study.summary.chunk.')));
});

test('generateStudySummary rejects when userId is missing', async () => {
  const service = createService();
  await assert.rejects(
    () =>
      service.generateStudySummary({
        userId: '',
        payload: createPayload(),
      }),
    (error) => error?.status === 500,
  );
});

test('generateStudySummary enforces daily request limits', async () => {
  const service = createService({
    rateLimitService: {
      checkDailyLimit: async () => ({ allowed: false }),
    },
  });

  await assert.rejects(
    () =>
      service.generateStudySummary({
        userId: 'user-1',
        payload: createPayload(),
      }),
    (error) => error?.status === 429,
  );
});
