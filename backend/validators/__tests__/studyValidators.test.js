const test = require('node:test');
const assert = require('node:assert/strict');

const { generateStudySummarySchema } = require('../studyValidators');

function buildValidPayload(overrides = {}) {
  return {
    transcript: {
      plainText: 'Intro text',
      segments: [{ startMs: 0, endMs: 5000, text: 'Intro text', speaker: 'Professor' }],
      durationMs: 5000,
    },
    ...overrides,
  };
}

test('generateStudySummarySchema accepts minimum valid payload', () => {
  const result = generateStudySummarySchema.safeParse(buildValidPayload());
  assert.equal(result.success, true);
  assert.equal(result.data.depth, 'standard');
  assert.equal(result.data.includeJson, true);
});

test('generateStudySummarySchema accepts explicit depth and focus areas', () => {
  const result = generateStudySummarySchema.safeParse(
    buildValidPayload({
      depth: 'detailed',
      examFocusAreas: ['Past paper topic A', 'Topic B'],
      includeJson: false,
    }),
  );
  assert.equal(result.success, true);
  assert.equal(result.data.depth, 'detailed');
  assert.equal(result.data.includeJson, false);
  assert.equal(result.data.examFocusAreas.length, 2);
});

test('generateStudySummarySchema rejects empty transcript segments', () => {
  const result = generateStudySummarySchema.safeParse(
    buildValidPayload({
      transcript: {
        plainText: 'Empty',
        segments: [],
      },
    }),
  );
  assert.equal(result.success, false);
});

test('generateStudySummarySchema rejects invalid depth', () => {
  const result = generateStudySummarySchema.safeParse(
    buildValidPayload({
      depth: 'very-detailed',
    }),
  );
  assert.equal(result.success, false);
});
