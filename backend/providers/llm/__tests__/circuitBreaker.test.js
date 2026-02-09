const { test, describe } = require('node:test');
const assert = require('node:assert');
const { CircuitBreaker } = require('../circuitBreaker');

describe('CircuitBreaker', () => {
  test('opens after failure threshold and blocks requests', async () => {
    const now = 1000;
    const breaker = new CircuitBreaker({
      failureThreshold: 2,
      openDurationMs: 30000,
      now: () => now,
    });

    await breaker.recordFailure('gemini');
    let decision = await breaker.canRequest('gemini');
    assert.equal(decision.allowed, true);

    await breaker.recordFailure('gemini');
    decision = await breaker.canRequest('gemini');
    assert.equal(decision.allowed, false);
    assert.equal(decision.state, 'open');
  });

  test('transitions to half-open after open duration', async () => {
    let now = 0;
    const breaker = new CircuitBreaker({
      failureThreshold: 1,
      openDurationMs: 1000,
      halfOpenMaxAttempts: 1,
      now: () => now,
    });

    await breaker.recordFailure('openai');
    let decision = await breaker.canRequest('openai');
    assert.equal(decision.allowed, false);

    now += 1000;
    decision = await breaker.canRequest('openai');
    assert.equal(decision.allowed, true);
    assert.equal(decision.state, 'half_open');

    decision = await breaker.canRequest('openai');
    assert.equal(decision.allowed, false);
  });

  test('closes on success after half-open', async () => {
    let now = 0;
    const breaker = new CircuitBreaker({
      failureThreshold: 1,
      openDurationMs: 1000,
      halfOpenMaxAttempts: 1,
      now: () => now,
    });

    await breaker.recordFailure('groq');
    now += 1000;
    let decision = await breaker.canRequest('groq');
    assert.equal(decision.allowed, true);
    assert.equal(decision.state, 'half_open');

    await breaker.recordSuccess('groq');
    decision = await breaker.canRequest('groq');
    assert.equal(decision.allowed, true);
    assert.equal(decision.state, 'closed');
  });
});
