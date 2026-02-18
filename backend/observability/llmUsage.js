function normalizeUsagePayload(options) {
  return {
    provider: options.provider,
    operation: options.operation,
    model: options.model,
    promptTokens: options.promptTokens ?? 0,
    completionTokens: options.completionTokens ?? 0,
    totalTokens: options.totalTokens ?? 0,
    userId: options.userId,
    requestId: options.requestId,
    latencyMs: options.latencyMs,
  };
}

function logLlmUsage(logger, payload) {
  logger.info(
    {
      type: 'llm_usage',
      provider: payload.provider,
      operation: payload.operation,
      model: payload.model,
      tokens: {
        prompt: payload.promptTokens,
        completion: payload.completionTokens,
        total: payload.totalTokens,
      },
      userId: payload.userId,
      requestId: payload.requestId,
      latencyMs: payload.latencyMs,
    },
    `LLM ${payload.operation}: ${payload.totalTokens} tokens (${payload.provider}/${payload.model})`,
  );
}

function recordLlmMetrics(trackMetric, trackEvent, payload) {
  trackMetric('llm.tokens.prompt', payload.promptTokens, {
    provider: payload.provider,
    operation: payload.operation,
    model: payload.model,
  });
  trackMetric('llm.tokens.completion', payload.completionTokens, {
    provider: payload.provider,
    operation: payload.operation,
    model: payload.model,
  });
  trackMetric('llm.tokens.total', payload.totalTokens, {
    provider: payload.provider,
    operation: payload.operation,
    model: payload.model,
  });

  if (payload.latencyMs !== undefined) {
    trackMetric('llm.latency.ms', payload.latencyMs, {
      provider: payload.provider,
      operation: payload.operation,
      model: payload.model,
    });
  }

  trackEvent(
    'llm.request',
    {
      provider: payload.provider,
      operation: payload.operation,
      model: payload.model,
      userId: payload.userId || 'anonymous',
      requestId: payload.requestId,
    },
    {
      promptTokens: payload.promptTokens,
      completionTokens: payload.completionTokens,
      totalTokens: payload.totalTokens,
      latencyMs: payload.latencyMs || 0,
    },
  );
}

function createLlmUsageTracker({ logger, trackMetric, trackEvent }) {
  return function trackLlmUsage(options) {
    const payload = normalizeUsagePayload(options);
    logLlmUsage(logger, payload);
    recordLlmMetrics(trackMetric, trackEvent, payload);
  };
}

module.exports = {
  createLlmUsageTracker,
};
