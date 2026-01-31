/**
 * Unit tests for LLM contracts
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');
const {
  shouldFallback,
  createProviderError,
  parseRetryAfter,
  FALLBACK_ERROR_PATTERNS,
  NO_FALLBACK_ERROR_PATTERNS,
} = require('../contracts');

describe('shouldFallback', () => {
  describe('rate limiting errors', () => {
    test('should fallback on 429 status', () => {
      const error = new Error('Request failed');
      error.status = 429;
      assert.equal(shouldFallback(error), true);
    });

    test('should fallback on "rate limit" message', () => {
      const error = new Error('Rate limit exceeded');
      assert.equal(shouldFallback(error), true);
    });

    test('should fallback on "quota" message', () => {
      const error = new Error('Quota exceeded for project');
      assert.equal(shouldFallback(error), true);
    });

    test('should fallback on "too many requests" message', () => {
      const error = new Error('Too many requests');
      assert.equal(shouldFallback(error), true);
    });
  });

  describe('server errors', () => {
    test('should fallback on 500 status', () => {
      const error = new Error('Internal server error');
      error.status = 500;
      assert.equal(shouldFallback(error), true);
    });

    test('should fallback on 503 status', () => {
      const error = new Error('Service unavailable');
      error.status = 503;
      assert.equal(shouldFallback(error), true);
    });
  });

  describe('network errors', () => {
    test('should fallback on timeout', () => {
      const error = new Error('Request timed out');
      assert.equal(shouldFallback(error), true);
    });

    test('should fallback on connection reset', () => {
      const error = new Error('ECONNRESET');
      assert.equal(shouldFallback(error), true);
    });

    test('should fallback on socket hang up', () => {
      const error = new Error('socket hang up');
      assert.equal(shouldFallback(error), true);
    });
  });

  describe('authentication errors (should NOT fallback)', () => {
    test('should NOT fallback on invalid API key', () => {
      const error = new Error('Invalid API key provided');
      assert.equal(shouldFallback(error), false);
    });

    test('should NOT fallback on 401 status', () => {
      const error = new Error('Unauthorized');
      error.status = 401;
      assert.equal(shouldFallback(error), false);
    });

    test('should NOT fallback on 403 status', () => {
      const error = new Error('Forbidden');
      error.status = 403;
      assert.equal(shouldFallback(error), false);
    });

    test('should NOT fallback on authentication failed', () => {
      const error = new Error('Authentication failed');
      assert.equal(shouldFallback(error), false);
    });
  });

  describe('bad request errors (should NOT fallback)', () => {
    test('should NOT fallback on 400 status', () => {
      const error = new Error('Bad request: invalid parameter');
      error.status = 400;
      assert.equal(shouldFallback(error), false);
    });

    test('should NOT fallback on content policy violation', () => {
      const error = new Error('Content policy violation blocked');
      assert.equal(shouldFallback(error), false);
    });
  });

  describe('unknown errors', () => {
    test('should NOT fallback on unknown errors by default', () => {
      const error = new Error('Something unexpected happened');
      assert.equal(shouldFallback(error), false);
    });
  });
});

describe('createProviderError', () => {
  test('should create error with provider metadata', () => {
    const original = new Error('API failed');
    original.status = 500;

    const wrapped = createProviderError('gemini', 'chatCompletion', original);

    assert.equal(wrapped.provider, 'gemini');
    assert.equal(wrapped.operation, 'chatCompletion');
    assert.equal(wrapped.originalError, original);
    assert.equal(wrapped.status, 500);
    assert.ok(wrapped.message.includes('[gemini]'));
    assert.ok(wrapped.message.includes('chatCompletion'));
    assert.ok(wrapped.message.includes('API failed'));
  });

  test('should set shouldFallback property', () => {
    const rateLimit = new Error('Rate limit exceeded');
    const invalidRequest = new Error('Invalid request format');
    invalidRequest.status = 400;

    const rateLimitWrapped = createProviderError('openai', 'chat', rateLimit);
    const invalidRequestWrapped = createProviderError('openai', 'chat', invalidRequest);

    assert.equal(rateLimitWrapped.shouldFallback, true);
    assert.equal(invalidRequestWrapped.shouldFallback, false);
  });
});

describe('error pattern constants', () => {
  test('FALLBACK_ERROR_PATTERNS should contain expected patterns', () => {
    assert.ok(FALLBACK_ERROR_PATTERNS.includes('rate limit'));
    assert.ok(FALLBACK_ERROR_PATTERNS.includes('quota'));
    assert.ok(FALLBACK_ERROR_PATTERNS.includes('timeout'));
    assert.ok(FALLBACK_ERROR_PATTERNS.includes('503'));
  });

  test('NO_FALLBACK_ERROR_PATTERNS should contain expected patterns', () => {
    assert.ok(NO_FALLBACK_ERROR_PATTERNS.includes('invalid api key'));
    assert.ok(NO_FALLBACK_ERROR_PATTERNS.includes('authentication failed'));
  });
});

describe('parseRetryAfter', () => {
  test('should return null for error without retry info', () => {
    const error = new Error('Something went wrong');
    assert.equal(parseRetryAfter(error), null);
  });

  test('should parse numeric header value', () => {
    const error = new Error('Rate limited');
    error.headers = { 'retry-after': '30' };
    assert.equal(parseRetryAfter(error), 30);
  });

  test('should parse "retry after X seconds" pattern', () => {
    const error = new Error('Please retry after 60 seconds');
    assert.equal(parseRetryAfter(error), 60);
  });

  test('should parse "retry in Xs" pattern', () => {
    const error = new Error('Rate limited. Retry in 30s');
    assert.equal(parseRetryAfter(error), 30);
  });

  test('should parse "wait X seconds" pattern', () => {
    const error = new Error('Too many requests. Wait 15 seconds.');
    assert.equal(parseRetryAfter(error), 15);
  });

  test('should parse Gemini "Retry after X" pattern', () => {
    const error = new Error('Resource exhausted. Retry after 120');
    assert.equal(parseRetryAfter(error), 120);
  });

  test('should handle headers.get() method (fetch API style)', () => {
    const error = new Error('Rate limited');
    error.headers = {
      get: (name) => (name.toLowerCase() === 'retry-after' ? '45' : null),
    };
    assert.equal(parseRetryAfter(error), 45);
  });

  test('should return null for invalid header value', () => {
    const error = new Error('Rate limited');
    error.headers = { 'retry-after': 'invalid' };
    assert.equal(parseRetryAfter(error), null);
  });
});
