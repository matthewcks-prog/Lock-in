const { RATE_LIMITER_CONSTANTS, TOKEN_COSTS } = require('./rateLimiterConfig');

function resolveCosts(provider, model) {
  return (
    TOKEN_COSTS[provider]?.[model] || TOKEN_COSTS[provider]?.default || { input: 0, output: 0 }
  );
}

function roundCost(value) {
  return (
    Math.round(value * RATE_LIMITER_CONSTANTS.costPrecisionScale) /
    RATE_LIMITER_CONSTANTS.costPrecisionScale
  );
}

class UsageTracker {
  constructor() {
    this.stats = new Map();
    this.startTime = Date.now();
  }

  record(provider, model, usage) {
    const key = `${provider}:${model}`;
    const current = this.stats.get(key) || {
      provider,
      model,
      requests: 0,
      inputTokens: 0,
      outputTokens: 0,
      estimatedCost: 0,
    };
    current.requests += 1;

    if (usage) {
      const inputTokens = usage.prompt_tokens || 0;
      const outputTokens = usage.completion_tokens || 0;
      const costs = resolveCosts(provider, model);
      current.inputTokens += inputTokens;
      current.outputTokens += outputTokens;
      current.estimatedCost += inputTokens * costs.input + outputTokens * costs.output;
    }

    this.stats.set(key, current);
  }

  getStats() {
    const models = Array.from(this.stats.values());
    const totalRequests = models.reduce((sum, model) => sum + model.requests, 0);
    const totalTokens = models.reduce(
      (sum, model) => sum + model.inputTokens + model.outputTokens,
      0,
    );
    const totalCost = models.reduce((sum, model) => sum + model.estimatedCost, 0);

    return {
      uptimeMs: Date.now() - this.startTime,
      totalRequests,
      totalTokens,
      totalCostUsd: roundCost(totalCost),
      models: models.map((model) => ({
        ...model,
        estimatedCost: roundCost(model.estimatedCost),
      })),
    };
  }

  reset() {
    this.stats.clear();
    this.startTime = Date.now();
  }
}

module.exports = {
  UsageTracker,
};
