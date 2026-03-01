const { shouldFallback, createStreamErrorChunk } = require('./contracts');
const { logger } = require('../../observability');
const { createRequestBudget, isAbortError, isDeadlineExceededError } = require('./requestBudget');
const { resolveQueueTimeoutMs } = require('./providerChainUtils');

function createBudget(chain, options) {
  return createRequestBudget({
    timeoutMs: options.overallTimeoutMs ?? chain.overallTimeoutMs,
    signal: options.signal,
  });
}

function createStreamTimeoutChunk() {
  return createStreamErrorChunk('TIMEOUT', 'Request deadline exceeded', false);
}

function createNoProvidersAvailableChunk() {
  return createStreamErrorChunk('SERVICE_UNAVAILABLE', 'No providers available', false);
}

function createAllProvidersUnavailableChunk() {
  return createStreamErrorChunk('SERVICE_UNAVAILABLE', 'All providers unavailable', true);
}

function createAllProvidersRateLimitedChunk() {
  return createStreamErrorChunk('RATE_LIMIT', 'All providers rate limited', true);
}

function isStreamBudgetExhausted({ budget, remainingMs, minRemainingMs }) {
  return budget.isExpired() || remainingMs <= minRemainingMs;
}

function resolveQueueTimeoutForProvider({ chain, options, remainingMs, remainingProviders }) {
  return resolveQueueTimeoutMs({
    remainingMs,
    remainingProviders,
    optionsQueueTimeoutMs: options.queueTimeoutMs,
    queueTimeoutMs: chain.queueTimeoutMs,
    minRemainingMs: chain.minRemainingMs,
  });
}

function createQueueScheduleOptions(queueTimeoutMs) {
  if (!Number.isFinite(queueTimeoutMs)) {
    return undefined;
  }
  return { timeout: queueTimeoutMs };
}

async function acquireStreamProviderSlot({ chain, providerName, queueTimeoutMs }) {
  const scheduleOptions = createQueueScheduleOptions(queueTimeoutMs);
  await chain._getRateLimiter().schedule(providerName, async () => true, scheduleOptions);
}

function logStreamProviderSkipped({ providerName, providerIndex, totalProviders }) {
  logger.warn('LLM streaming: provider skipped (circuit open)', {
    provider: providerName,
    providerIndex,
    totalProviders,
  });
}

function logStreamProviderRateLimited({ providerName, providerIndex, error }) {
  logger.warn('LLM streaming: provider rate limited', {
    provider: providerName,
    providerIndex,
    error: error.message,
  });
}

async function tryAcquireProviderSlot({
  chain,
  providerName,
  providerIndex,
  isLastProvider,
  queueTimeoutMs,
  adapter,
}) {
  try {
    await acquireStreamProviderSlot({
      chain,
      providerName,
      queueTimeoutMs,
    });
    return { adapter, providerName };
  } catch (error) {
    logStreamProviderRateLimited({
      providerName,
      providerIndex,
      error,
    });
    if (isLastProvider) {
      return { errorChunk: createAllProvidersRateLimitedChunk() };
    }
    return null;
  }
}

async function selectProviderForStreaming({ chain, options, budget }) {
  for (let index = 0; index < chain.adapters.length; index++) {
    const adapter = chain.adapters[index];
    const providerName = adapter.getProviderName();
    const isLastProvider = index === chain.adapters.length - 1;
    const remainingMs = budget.remainingMs();

    if (isStreamBudgetExhausted({ budget, remainingMs, minRemainingMs: chain.minRemainingMs })) {
      return { errorChunk: createStreamTimeoutChunk() };
    }

    const circuitDecision = await chain._circuitBreaker.canRequest(providerName);
    if (!circuitDecision.allowed) {
      logStreamProviderSkipped({
        providerName,
        providerIndex: index + 1,
        totalProviders: chain.adapters.length,
      });
      if (isLastProvider) {
        return { errorChunk: createAllProvidersUnavailableChunk() };
      }
      continue;
    }

    const queueTimeoutMs = resolveQueueTimeoutForProvider({
      chain,
      options,
      remainingMs,
      remainingProviders: chain.adapters.length - index,
    });

    const slotResult = await tryAcquireProviderSlot({
      chain,
      providerName,
      providerIndex: index + 1,
      isLastProvider,
      queueTimeoutMs,
      adapter,
    });
    if (slotResult) {
      return slotResult;
    }
  }

  return { errorChunk: createNoProvidersAvailableChunk() };
}

function createStreamOptions({ options, budget }) {
  return {
    ...options,
    signal: budget.signal,
    timeoutMs: options.timeoutMs ?? budget.remainingMs(),
  };
}

function recordFinalChunkUsage({ chain, providerName, model, chunk }) {
  if (chunk.type !== 'final' || !chunk.usage) {
    return;
  }
  chain._getRateLimiter().recordUsage(providerName, model, chunk.usage);
}

function logStreamStart({ providerName, adapter, options }) {
  logger.info(`LLM streaming started [${providerName}]`, {
    provider: providerName,
    model: adapter.model,
    operation: options.operation || 'chatCompletionStream',
  });
}

function logStreamCompleted({ providerName, adapter, chunkCount, startTime }) {
  logger.info(`LLM streaming completed [${providerName}]`, {
    provider: providerName,
    model: adapter.model,
    chunkCount,
    latencyMs: Date.now() - startTime,
  });
}

function logStreamFailed({ providerName, adapter, error, chunkCount, startTime, isAbort }) {
  logger.error(`LLM streaming failed [${providerName}]`, {
    provider: providerName,
    model: adapter.model,
    error: error.message,
    chunkCount,
    latencyMs: Date.now() - startTime,
    isAbort,
  });
}

async function* streamProviderChunks({ chain, adapter, providerName, messages, streamOptions }) {
  let chunkCount = 0;
  let errorOccurred = false;

  for await (const chunk of adapter.chatCompletionStream(messages, streamOptions)) {
    chunkCount += 1;

    if (chunk.type === 'error') {
      errorOccurred = true;
      await chain._circuitBreaker.recordFailure(providerName);
      yield chunk;
      break;
    }

    recordFinalChunkUsage({
      chain,
      providerName,
      model: adapter.model,
      chunk,
    });
    yield chunk;
  }

  return { chunkCount, errorOccurred };
}

async function* streamFromProvider({
  chain,
  adapter,
  providerName,
  messages,
  options,
  startTime,
  budget,
}) {
  logStreamStart({ providerName, adapter, options });

  const streamOptions = createStreamOptions({ options, budget });

  try {
    const { chunkCount, errorOccurred } = await (yield* streamProviderChunks({
      chain,
      adapter,
      providerName,
      messages,
      streamOptions,
    }));
    if (errorOccurred) {
      return;
    }

    await chain._circuitBreaker.recordSuccess(providerName);
    logStreamCompleted({ providerName, adapter, chunkCount, startTime });
  } catch (error) {
    await chain._circuitBreaker.recordFailure(providerName);

    const isAbort = isAbortError(error) || isDeadlineExceededError(error);
    const errorCode = isAbort ? 'ABORTED' : 'UPSTREAM_ERROR';
    const retryable = !isAbort && shouldFallback(error);

    logStreamFailed({ providerName, adapter, error, chunkCount: 0, startTime, isAbort });
    yield createStreamErrorChunk(errorCode, error.message, retryable);
  }
}

async function* executeChatCompletionStream({ chain, messages, options = {} }) {
  const startTime = Date.now();
  const budget = createBudget(chain, options);

  try {
    const selected = await selectProviderForStreaming({ chain, options, budget });
    if (selected.errorChunk) {
      yield selected.errorChunk;
      return;
    }

    yield* streamFromProvider({
      chain,
      adapter: selected.adapter,
      providerName: selected.providerName,
      messages,
      options,
      startTime,
      budget,
    });
  } finally {
    budget.dispose();
  }
}

module.exports = {
  executeChatCompletionStream,
};
