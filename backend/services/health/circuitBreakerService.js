const { supabaseCircuitBreaker } = require('../../db/supabaseClient');

const SUPPORTED_CIRCUIT_BREAKER_SERVICES = ['supabase'];

function resolveNow(now) {
  if (now instanceof Date) {
    return now;
  }
  if (typeof now === 'function') {
    const value = now();
    return value instanceof Date ? value : new Date(value);
  }
  if (typeof now === 'number') {
    return new Date(now);
  }
  return new Date();
}

async function buildSupabaseStatusAsync({ breaker, now }) {
  if (!breaker) {
    return { state: 'not_configured' };
  }

  const state = await breaker.getState('supabase');
  const status = {
    state: state?.state || 'closed',
    failures: state?.failures || 0,
    openedAt: state?.openedAt ? new Date(state.openedAt).toISOString() : null,
    halfOpenAttempts: state?.halfOpenAttempts || 0,
    config: {
      failureThreshold: breaker.failureThreshold,
      openDurationMs: breaker.openDurationMs,
      halfOpenMaxAttempts: breaker.halfOpenMaxAttempts,
    },
  };

  if (state?.state === 'open' && state.openedAt) {
    const nowValue = resolveNow(now).getTime();
    const elapsed = nowValue - state.openedAt;
    status.timeRemainingMs = Math.max(0, breaker.openDurationMs - elapsed);
  }

  return status;
}

async function getCircuitBreakerStatus({ breaker = supabaseCircuitBreaker, now = Date.now } = {}) {
  const timestamp = resolveNow(now).toISOString();
  const circuitBreakers = {};

  const supabaseStatus = await buildSupabaseStatusAsync({ breaker, now });
  circuitBreakers.supabase = supabaseStatus;

  const allCircuitsClosed = Object.values(circuitBreakers).every(
    (cb) => cb.state === 'closed' || cb.state === 'not_configured',
  );

  return {
    timestamp,
    circuitBreakers,
    healthy: allCircuitsClosed,
  };
}

async function resetCircuitBreaker({
  service,
  breaker = supabaseCircuitBreaker,
  now = Date.now,
} = {}) {
  const timestamp = resolveNow(now).toISOString();
  const results = {};

  if (!service || service === 'supabase' || service === 'all') {
    if (breaker) {
      const beforeState = await breaker.getState('supabase');
      await breaker.reset(service === 'all' ? null : 'supabase');
      const afterState = await breaker.getState('supabase');

      results.supabase = {
        success: true,
        beforeState: beforeState?.state || 'closed',
        afterState: afterState?.state || 'closed',
      };
    } else {
      results.supabase = {
        success: false,
        error: 'Circuit breaker not configured',
      };
    }
  }

  return {
    timestamp,
    service: service || 'all',
    results,
  };
}

module.exports = {
  SUPPORTED_CIRCUIT_BREAKER_SERVICES,
  getCircuitBreakerStatus,
  resetCircuitBreaker,
};
