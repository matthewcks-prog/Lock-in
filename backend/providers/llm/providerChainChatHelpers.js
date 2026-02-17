const { shouldFallback } = require('./contracts');
const { logger } = require('../../observability');
const { isAbortError, isDeadlineExceededError } = require('./requestBudget');
const { attachChainContext, categorizeError, getErrorStatus } = require('./providerChainUtils');
const {
  createAggregatedProviderError,
  createCircuitOpenError,
} = require('./providerChainErrorHelpers');

const RETRYABLE_ERROR_CATEGORIES = new Set([
  'rate_limit',
  'server_error',
  'network_error',
  'timeout',
]);

function buildProviderErrorRecord({ providerName, error, fallbackEligible, abortLike }) {
  return {
    provider: providerName,
    error: error.message,
    shouldFallback: fallbackEligible,
    abortLike,
  };
}

function shouldRecordProviderFailure({ abortLike, fallbackEligible, errorCategory }) {
  if (abortLike) return false;
  if (fallbackEligible) return true;
  return RETRYABLE_ERROR_CATEGORIES.has(errorCategory);
}

async function recordFailureIfNeeded({ chain, providerName, shouldRecord }) {
  if (!shouldRecord) return;
  const breakerState = await chain._circuitBreaker.recordFailure(providerName);
  if (!breakerState.opened) return;

  logger.warn('LLM provider circuit opened', {
    provider: providerName,
    failures: breakerState.failures,
    failureThreshold: chain._circuitBreaker.failureThreshold,
    openDurationMs: chain._circuitBreaker.openDurationMs,
  });
}

function buildSuccessResult({ result, errors, providerIndex }) {
  return {
    ...result,
    fallbackUsed: providerIndex > 0,
    attemptedProviders: errors.map((entry) => entry.provider),
  };
}

function logProviderSuccess({
  providerName,
  result,
  options,
  startTime,
  providerIndex,
  chain,
  errors,
}) {
  logger.info(`LLM request succeeded [${providerName}/${result.model}]`, {
    provider: providerName,
    model: result.model,
    operation: options.operation || 'chatCompletion',
    latencyMs: Date.now() - startTime,
    providerIndex: providerIndex + 1,
    totalProviders: chain.adapters.length,
    fallbackUsed: providerIndex > 0,
    attemptedProviders: errors.map((entry) => entry.provider),
    usage: result.usage,
  });
}

function logProviderFailure({
  providerName,
  adapter,
  providerIndex,
  chain,
  error,
  errorStatus,
  errorCategory,
  fallbackEligible,
  isLastProvider,
  options,
  startTime,
  remainingMs,
}) {
  logger.warn('LLM provider failed, attempting fallback', {
    provider: providerName,
    model: adapter.model,
    providerIndex: providerIndex + 1,
    totalProviders: chain.adapters.length,
    nextProvider: !isLastProvider ? chain.adapters[providerIndex + 1]?.getProviderName() : null,
    error: error.message,
    errorCode: errorStatus || 'UNKNOWN',
    errorCategory,
    shouldFallback: fallbackEligible,
    isLastProvider,
    operation: options.operation || 'chatCompletion',
    latencyMs: Date.now() - startTime,
    remainingBudgetMs: remainingMs,
  });
}

function throwTerminalProviderError({
  error,
  errors,
  startTime,
  isLastProvider,
  abortLike,
  fallbackEligible,
}) {
  if (abortLike || !fallbackEligible) {
    throw attachChainContext(error, errors, startTime);
  }
  if (!isLastProvider) {
    return;
  }

  const aggregatedError = createAggregatedProviderError(errors);
  throw attachChainContext(aggregatedError, errors, startTime);
}

function buildFailureContext({ error, budget }) {
  const abortLike = isAbortError(error) || isDeadlineExceededError(error) || budget.isExpired();
  const errorCategory = categorizeError(error);
  const errorStatus = getErrorStatus(error);
  const fallbackEligible = abortLike ? false : (error.shouldFallback ?? shouldFallback(error));

  return {
    abortLike,
    errorCategory,
    errorStatus,
    fallbackEligible,
  };
}

function buildFailureRecordDetails({ providerName, error, budget }) {
  const failureContext = buildFailureContext({ error, budget });
  const shouldRecord = shouldRecordProviderFailure({
    abortLike: failureContext.abortLike,
    fallbackEligible: failureContext.fallbackEligible,
    errorCategory: failureContext.errorCategory,
  });

  return {
    failureContext,
    shouldRecord,
    record: buildProviderErrorRecord({
      providerName,
      error,
      fallbackEligible: failureContext.fallbackEligible,
      abortLike: failureContext.abortLike,
    }),
  };
}

async function recordAndLogFailure({
  chain,
  providerName,
  adapter,
  providerIndex,
  isLastProvider,
  startTime,
  remainingMs,
  options,
  error,
  failureContext,
  shouldRecord,
}) {
  await recordFailureIfNeeded({
    chain,
    providerName,
    shouldRecord,
  });

  logProviderFailure({
    providerName,
    adapter,
    providerIndex,
    chain,
    error,
    errorStatus: failureContext.errorStatus,
    errorCategory: failureContext.errorCategory,
    fallbackEligible: failureContext.fallbackEligible,
    isLastProvider,
    options,
    startTime,
    remainingMs,
  });
}

async function handleCircuitOpen({
  chain,
  providerName,
  providerIndex,
  errors,
  startTime,
  remainingMs,
  circuitDecision,
  isLastProvider,
}) {
  const circuitError = createCircuitOpenError(providerName, circuitDecision);
  errors.push({
    provider: providerName,
    error: circuitError.message,
    shouldFallback: true,
    abortLike: false,
    circuitOpen: true,
  });

  logger.warn('LLM provider skipped due to open circuit', {
    provider: providerName,
    providerIndex: providerIndex + 1,
    totalProviders: chain.adapters.length,
    retryAfterMs: circuitDecision.retryAfterMs,
    remainingBudgetMs: remainingMs,
  });

  if (isLastProvider) {
    throw attachChainContext(circuitError, errors, startTime);
  }
}

async function handleProviderFailure({
  chain,
  providerName,
  adapter,
  providerIndex,
  isLastProvider,
  errors,
  startTime,
  remainingMs,
  options,
  error,
  budget,
}) {
  const { failureContext, shouldRecord, record } = buildFailureRecordDetails({
    providerName,
    error,
    budget,
  });
  errors.push(record);

  await recordAndLogFailure({
    chain,
    providerName,
    adapter,
    providerIndex,
    isLastProvider,
    startTime,
    remainingMs,
    options,
    error,
    failureContext,
    shouldRecord,
  });

  throwTerminalProviderError({
    error,
    errors,
    startTime,
    isLastProvider,
    abortLike: failureContext.abortLike,
    fallbackEligible: failureContext.fallbackEligible,
  });
}

module.exports = {
  buildSuccessResult,
  handleCircuitOpen,
  handleProviderFailure,
  logProviderSuccess,
};
