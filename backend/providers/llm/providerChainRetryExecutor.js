const { shouldFallback, parseRetryAfter } = require('./contracts');
const { logger } = require('../../observability');
const { THOUSAND } = require('../../constants/numbers');
const {
  createDeadlineExceededError,
  isAbortError,
  isDeadlineExceededError,
} = require('./requestBudget');
const {
  getErrorStatus,
  resolveAttemptTimeoutMs,
  resolveQueueTimeoutMs,
} = require('./providerChainUtils');

const RETRY_AFTER_TO_MS = THOUSAND;
const RETRY_DELAY_JITTER_FLOOR = 0.5;
const RETRY_DELAY_JITTER_RANGE = 0.5;

function ensureBudgetAvailable({ budget, minRemainingMs }) {
  if (budget.isExpired()) {
    throw createDeadlineExceededError(budget.timeoutMs, budget.signal?.reason);
  }

  const remainingMs = budget.remainingMs();
  if (Number.isFinite(remainingMs) && remainingMs <= minRemainingMs) {
    throw createDeadlineExceededError(budget.timeoutMs, budget.signal?.reason);
  }

  return remainingMs;
}

function resolveTimeouts({
  remainingMs,
  remainingProviders,
  options,
  attemptTimeoutMs,
  queueTimeoutMs,
  minRemainingMs,
}) {
  return {
    attemptTimeoutMs: resolveAttemptTimeoutMs({
      remainingMs,
      remainingProviders,
      optionsTimeoutMs: options.timeoutMs,
      attemptTimeoutMs,
      minRemainingMs,
    }),
    queueTimeoutMs: resolveQueueTimeoutMs({
      remainingMs,
      remainingProviders,
      optionsQueueTimeoutMs: options.queueTimeoutMs,
      queueTimeoutMs,
      minRemainingMs,
    }),
  };
}

function createRequestOptions({ options, budget, attemptTimeoutMs }) {
  const requestOptions = { ...options, signal: budget.signal };
  if (Number.isFinite(attemptTimeoutMs)) {
    requestOptions.timeoutMs = attemptTimeoutMs;
  }
  return requestOptions;
}

function createScheduleOptions(queueTimeoutMs) {
  if (!Number.isFinite(queueTimeoutMs)) {
    return undefined;
  }
  return { timeout: queueTimeoutMs };
}

function logAttemptStart({
  providerName,
  model,
  attempt,
  maxRetries,
  operation,
  attemptTimeoutMs,
  queueTimeoutMs,
}) {
  logger.info(`LLM attempt [${providerName}/${model}] attempt=${attempt}/${maxRetries}`, {
    provider: providerName,
    model,
    attempt,
    maxRetries,
    operation,
    attemptTimeoutMs,
    queueTimeoutMs,
  });
}

function logAttemptFailure({ providerName, model, attempt, maxRetries, error, operation, budget }) {
  const errorStatus = getErrorStatus(error);
  const willRetry = shouldFallback(error) && attempt < maxRetries;

  logger.warn(
    `LLM attempt FAILED [${providerName}/${model}] attempt=${attempt}/${maxRetries} status=${errorStatus || 'UNKNOWN'}`,
    {
      provider: providerName,
      model,
      attempt,
      maxRetries,
      errorMessage: error.message,
      errorStatus: errorStatus || 'UNKNOWN',
      willRetry,
      operation,
      remainingBudgetMs: budget.remainingMs(),
    },
  );
}

async function runScheduledAttempt({
  rateLimiter,
  providerName,
  adapter,
  messages,
  requestOptions,
  scheduleOptions,
}) {
  const result = await rateLimiter.schedule(
    providerName,
    async () => adapter.chatCompletion(messages, requestOptions),
    scheduleOptions,
  );

  if (result.usage) {
    rateLimiter.recordUsage(providerName, result.model, result.usage);
  }

  return result;
}

function computeRetryDelayMs({ retryAfterSeconds, retryDelayMs, attempt }) {
  const baseDelayMs = retryAfterSeconds
    ? retryAfterSeconds * RETRY_AFTER_TO_MS
    : retryDelayMs * Math.pow(2, attempt - 1);

  return baseDelayMs * (RETRY_DELAY_JITTER_FLOOR + Math.random() * RETRY_DELAY_JITTER_RANGE);
}

function ensureDelayWithinBudget({ budget, delayMs, minRemainingMs }) {
  const remainingMsAfterDelay = budget.remainingMs() - delayMs;
  if (Number.isFinite(remainingMsAfterDelay) && remainingMsAfterDelay <= minRemainingMs) {
    throw createDeadlineExceededError(budget.timeoutMs, budget.signal?.reason);
  }
}

async function waitBeforeRetry({
  error,
  attempt,
  maxRetries,
  retryDelayMs,
  rateLimiter,
  providerName,
  sleep,
  budget,
  minRemainingMs,
}) {
  if (!shouldFallback(error)) {
    throw error;
  }

  if (attempt >= maxRetries) {
    return false;
  }

  const retryAfterSeconds = parseRetryAfter(error);
  if (retryAfterSeconds && retryAfterSeconds > 0) {
    await rateLimiter.pauseProvider(providerName, retryAfterSeconds * RETRY_AFTER_TO_MS);
  }

  const delayMs = computeRetryDelayMs({ retryAfterSeconds, retryDelayMs, attempt });
  ensureDelayWithinBudget({ budget, delayMs, minRemainingMs });
  await sleep(delayMs);
  return true;
}

async function runRetryAttempt({
  chain,
  adapter,
  messages,
  options,
  budget,
  remainingProviders,
  attempt,
  providerName,
  model,
  operation,
  rateLimiter,
}) {
  const remainingMs = ensureBudgetAvailable({
    budget,
    minRemainingMs: chain.minRemainingMs,
  });
  const { attemptTimeoutMs, queueTimeoutMs } = resolveTimeouts({
    remainingMs,
    remainingProviders,
    options,
    attemptTimeoutMs: chain.attemptTimeoutMs,
    queueTimeoutMs: chain.queueTimeoutMs,
    minRemainingMs: chain.minRemainingMs,
  });

  logAttemptStart({
    providerName,
    model,
    attempt,
    maxRetries: chain.maxRetries,
    operation,
    attemptTimeoutMs,
    queueTimeoutMs,
  });

  const requestOptions = createRequestOptions({ options, budget, attemptTimeoutMs });
  const scheduleOptions = createScheduleOptions(queueTimeoutMs);
  return runScheduledAttempt({
    rateLimiter,
    providerName,
    adapter,
    messages,
    requestOptions,
    scheduleOptions,
  });
}

async function handleRetryAttemptFailure({
  error,
  providerName,
  model,
  attempt,
  chain,
  operation,
  budget,
  rateLimiter,
  sleep,
}) {
  if (isAbortError(error) || isDeadlineExceededError(error)) {
    error.shouldFallback = false;
    throw error;
  }

  logAttemptFailure({
    providerName,
    model,
    attempt,
    maxRetries: chain.maxRetries,
    error,
    operation,
    budget,
  });

  return waitBeforeRetry({
    error,
    attempt,
    maxRetries: chain.maxRetries,
    retryDelayMs: chain.retryDelayMs,
    rateLimiter,
    providerName,
    sleep,
    budget,
    minRemainingMs: chain.minRemainingMs,
  });
}

async function executeWithRetry({ chain, adapter, messages, options, budget, remainingProviders }) {
  const providerName = adapter.getProviderName();
  const model = adapter.model;
  const rateLimiter = chain._getRateLimiter();
  const operation = options.operation || 'chatCompletion';
  let lastError;

  for (let attempt = 1; attempt <= chain.maxRetries; attempt++) {
    try {
      return await runRetryAttempt({
        chain,
        adapter,
        messages,
        options,
        budget,
        remainingProviders,
        attempt,
        providerName,
        model,
        operation,
        rateLimiter,
      });
    } catch (error) {
      lastError = error;
      const shouldContinue = await handleRetryAttemptFailure({
        error,
        providerName,
        model,
        attempt,
        chain,
        operation,
        budget,
        rateLimiter,
        sleep: chain._sleep,
      });
      if (!shouldContinue) {
        break;
      }
    }
  }

  throw lastError;
}

module.exports = {
  executeWithRetry,
};
