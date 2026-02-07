const DEFAULT_CHAIN_TIMEOUT_MS = 60000;
const MIN_REMAINING_MS = 200;
const { DeadlineExceededError } = require('../../errors');

function resolveTimeoutMs(value, fallback) {
  const parsed = Number(value);
  if (Number.isFinite(parsed) && parsed > 0) return parsed;
  const fallbackParsed = Number(fallback);
  if (Number.isFinite(fallbackParsed) && fallbackParsed > 0) return fallbackParsed;
  return null;
}

function createDeadlineExceededError(timeoutMs, reason) {
  const suffix = Number.isFinite(timeoutMs) ? ` after ${timeoutMs}ms` : '';
  const error = new DeadlineExceededError(`LLM request deadline exceeded${suffix}`, {
    timeoutMs: Number.isFinite(timeoutMs) ? timeoutMs : null,
    reason: reason ?? null,
  });
  error.shouldFallback = false;
  return error;
}

function isAbortError(error) {
  return (
    error?.name === 'AbortError' ||
    error?.code === 'ABORTED' ||
    error?.code === 'ABORT_ERR' ||
    error?.code === 'ERR_ABORTED'
  );
}

function isDeadlineExceededError(error) {
  return error?.code === 'DEADLINE_EXCEEDED' || error?.name === 'DeadlineExceededError';
}

function createRequestBudget({
  timeoutMs,
  signal,
  defaultTimeoutMs = DEFAULT_CHAIN_TIMEOUT_MS,
} = {}) {
  const resolvedTimeoutMs = resolveTimeoutMs(timeoutMs, defaultTimeoutMs);
  const startTime = Date.now();
  const controller = new AbortController();
  let timeoutId;

  const onAbort = () => {
    if (!controller.signal.aborted) {
      controller.abort(signal?.reason);
    }
  };

  if (signal) {
    if (signal.aborted) {
      onAbort();
    } else {
      signal.addEventListener('abort', onAbort, { once: true });
    }
  }

  if (Number.isFinite(resolvedTimeoutMs) && resolvedTimeoutMs > 0) {
    timeoutId = setTimeout(() => {
      controller.abort(createDeadlineExceededError(resolvedTimeoutMs));
    }, resolvedTimeoutMs);
    if (timeoutId.unref) {
      timeoutId.unref();
    }
  }

  const remainingMs = () => {
    if (!Number.isFinite(resolvedTimeoutMs)) return Number.POSITIVE_INFINITY;
    return Math.max(0, resolvedTimeoutMs - (Date.now() - startTime));
  };

  const isExpired = () => controller.signal.aborted || remainingMs() <= 0;

  const dispose = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    if (signal) {
      signal.removeEventListener('abort', onAbort);
    }
  };

  return {
    timeoutMs: resolvedTimeoutMs,
    startTime,
    signal: controller.signal,
    remainingMs,
    isExpired,
    dispose,
  };
}

module.exports = {
  DEFAULT_CHAIN_TIMEOUT_MS,
  MIN_REMAINING_MS,
  resolveTimeoutMs,
  createDeadlineExceededError,
  createRequestBudget,
  isAbortError,
  isDeadlineExceededError,
};
