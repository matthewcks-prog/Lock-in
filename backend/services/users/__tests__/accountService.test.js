const test = require('node:test');
const assert = require('node:assert/strict');

const { createAccountService } = require('../accountService');

test('deleteMyAccount delegates to account repository', async () => {
  const calls = [];
  const service = createAccountService({
    accountRepository: {
      async deleteUserAccount(userId) {
        calls.push(userId);
      },
    },
  });

  await service.deleteMyAccount({ userId: 'user-123' });

  assert.deepEqual(calls, ['user-123']);
});

test('deleteMyAccount rejects when userId is missing', async () => {
  const service = createAccountService({
    accountRepository: {
      async deleteUserAccount() {},
    },
  });

  await assert.rejects(
    async () => {
      await service.deleteMyAccount({});
    },
    (error) => {
      assert.equal(error.code, 'AUTH_REQUIRED');
      return true;
    },
  );
});

test('deleteMyAccount maps repository failures to internal error response', async () => {
  const service = createAccountService({
    accountRepository: {
      async deleteUserAccount() {
        throw new Error('db failure');
      },
    },
  });

  await assert.rejects(
    async () => {
      await service.deleteMyAccount({ userId: 'user-123' });
    },
    (error) => {
      assert.equal(error.code, 'INTERNAL_ERROR');
      assert.equal(error.message, 'Failed to delete account');
      return true;
    },
  );
});
