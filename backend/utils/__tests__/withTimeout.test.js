const test = require('node:test');
const assert = require('node:assert/strict');

const { withTimeout } = require('../withTimeout');

const FAST_DELAY_MS = 5;
const SLOW_DELAY_MS = 80;
const TIMEOUT_MS = 30;

test('withTimeout resolves when promise settles before timeout', async () => {
  const result = await withTimeout(Promise.resolve('ok'), TIMEOUT_MS, 'Resolve case');
  assert.equal(result, 'ok');
});

test('withTimeout preserves the original rejection when promise rejects first', async () => {
  const expectedError = new Error('original failure');

  await assert.rejects(
    () => withTimeout(Promise.reject(expectedError), TIMEOUT_MS, 'Reject case'),
    (error) => error === expectedError,
  );
});

test('withTimeout rejects when operation exceeds deadline', async () => {
  const slowPromise = new Promise((resolve) => {
    setTimeout(() => resolve('late'), SLOW_DELAY_MS);
  });

  await assert.rejects(
    () => withTimeout(slowPromise, FAST_DELAY_MS, 'Slow operation'),
    (error) => {
      assert.match(error.message, /Slow operation timed out after/);
      return true;
    },
  );
});
