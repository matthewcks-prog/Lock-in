const { createRequestBudget } = require('./requestBudget');
const { buildDeadlineError } = require('./providerChainUtils');
const { createNoProvidersError } = require('./providerChainErrorHelpers');
const { executeWithRetry } = require('./providerChainRetryExecutor');
const {
  buildSuccessResult,
  handleCircuitOpen,
  handleProviderFailure,
  logProviderSuccess,
} = require('./providerChainChatHelpers');

function createBudget(chain, options) {
  return createRequestBudget({
    timeoutMs: options.overallTimeoutMs ?? chain.overallTimeoutMs,
    signal: options.signal,
  });
}

function isBudgetExhausted({ budget, remainingMs, minRemainingMs }) {
  return budget.isExpired() || remainingMs <= minRemainingMs;
}

async function ensureProviderAvailableForAttempt({
  chain,
  providerName,
  providerIndex,
  isLastProvider,
  remainingMs,
  errors,
  startTime,
}) {
  const circuitDecision = await chain._circuitBreaker.canRequest(providerName);
  if (circuitDecision.allowed) {
    return true;
  }

  await handleCircuitOpen({
    chain,
    providerName,
    providerIndex,
    errors,
    startTime,
    remainingMs,
    circuitDecision,
    isLastProvider,
  });
  return false;
}

async function runProviderCompletion({
  chain,
  adapter,
  providerName,
  providerIndex,
  remainingProviders,
  messages,
  options,
  budget,
  errors,
  startTime,
}) {
  const result = await executeWithRetry({
    chain,
    adapter,
    messages,
    options,
    budget,
    remainingProviders,
  });

  await chain._circuitBreaker.recordSuccess(providerName);
  logProviderSuccess({
    providerName,
    result,
    options,
    startTime,
    providerIndex,
    chain,
    errors,
  });

  return buildSuccessResult({ result, errors, providerIndex });
}

async function performProviderCompletion(context) {
  try {
    return await runProviderCompletion(context);
  } catch (error) {
    await handleProviderFailure({
      ...context,
      error,
    });
    return null;
  }
}

async function tryProviderCompletion(context) {
  const isAvailable = await ensureProviderAvailableForAttempt(context);
  if (!isAvailable) return null;
  return performProviderCompletion(context);
}

async function executeChatCompletion({ chain, messages, options = {} }) {
  const errors = [];
  const startTime = Date.now();
  const budget = createBudget(chain, options);

  try {
    for (let index = 0; index < chain.adapters.length; index++) {
      const adapter = chain.adapters[index];
      const providerName = adapter.getProviderName();
      const remainingMs = budget.remainingMs();

      if (isBudgetExhausted({ budget, remainingMs, minRemainingMs: chain.minRemainingMs })) {
        throw buildDeadlineError(budget, errors, startTime);
      }

      const completion = await tryProviderCompletion({
        chain,
        adapter,
        providerName,
        providerIndex: index,
        isLastProvider: index === chain.adapters.length - 1,
        remainingProviders: chain.adapters.length - index,
        remainingMs,
        messages,
        options,
        budget,
        errors,
        startTime,
      });

      if (completion) {
        return completion;
      }
    }
  } finally {
    budget.dispose();
  }

  throw createNoProvidersError();
}

module.exports = {
  executeChatCompletion,
};
