const { AppError } = require('../../errors');
const accountRepository = require('../../repositories/userAccountRepository');

function createAccountService(deps = {}) {
  const repository = deps.accountRepository ?? accountRepository;

  async function deleteMyAccount({ userId } = {}) {
    if (typeof userId !== 'string' || userId.length === 0) {
      throw new AppError('Authenticated user is required', 'AUTH_REQUIRED');
    }
    try {
      await repository.deleteUserAccount(userId);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to delete account', 'INTERNAL_ERROR');
    }
  }

  return {
    deleteMyAccount,
  };
}

const accountService = createAccountService();

module.exports = {
  createAccountService,
  accountService,
};
