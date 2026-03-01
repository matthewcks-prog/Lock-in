const test = require('node:test');
const assert = require('node:assert/strict');
const { createLlmUsageTracker } = require('../llmUsage');

test('trackLlmUsage logs and emits metrics/events', () => {
  const calls = {
    info: [],
    metrics: [],
    events: [],
  };

  const logger = {
    info(payload, message) {
      calls.info.push({ payload, message });
    },
  };
  const trackMetric = (name, value, properties) => {
    calls.metrics.push({ name, value, properties });
  };
  const trackEvent = (name, properties, measurements) => {
    calls.events.push({ name, properties, measurements });
  };

  const trackLlmUsage = createLlmUsageTracker({ logger, trackMetric, trackEvent });
  trackLlmUsage({
    provider: 'gemini',
    operation: 'chat',
    model: 'gemini-2.0-flash',
    promptTokens: 10,
    completionTokens: 20,
    totalTokens: 30,
    userId: 'user-1',
    requestId: 'req-1',
    latencyMs: 150,
  });

  assert.equal(calls.info.length, 1);
  assert.equal(calls.metrics.length, 4);
  assert.equal(calls.events.length, 1);
  assert.equal(calls.events[0].name, 'llm.request');
  assert.equal(calls.events[0].measurements.totalTokens, 30);
});
