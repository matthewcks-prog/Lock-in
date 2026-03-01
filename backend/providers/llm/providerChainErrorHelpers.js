const { AppError } = require('../../errors');
const HTTP_STATUS = require('../../constants/httpStatus');

function createCircuitOpenError(providerName, decision) {
  const error = new AppError(
    `LLM provider ${providerName} temporarily unavailable (circuit open)`,
    'SERVICE_UNAVAILABLE',
    HTTP_STATUS.SERVICE_UNAVAILABLE,
    {
      provider: providerName,
      retryAfterMs: decision.retryAfterMs,
      circuitState: decision.state,
    },
  );
  error.name = 'CircuitOpenError';
  error.shouldFallback = true;
  return error;
}

function createNoProvidersError() {
  return new AppError(
    'No LLM providers available',
    'SERVICE_UNAVAILABLE',
    HTTP_STATUS.SERVICE_UNAVAILABLE,
  );
}

function createAggregatedProviderError(errors) {
  return new AppError(
    `All LLM providers failed: ${errors.map((e) => `${e.provider}: ${e.error}`).join('; ')}`,
    'SERVICE_UNAVAILABLE',
    HTTP_STATUS.SERVICE_UNAVAILABLE,
  );
}

module.exports = {
  createAggregatedProviderError,
  createCircuitOpenError,
  createNoProvidersError,
};
