const { createClient } = require('@supabase/supabase-js');
const { AppError } = require('../errors');
const { CircuitBreaker } = require('../utils/circuitBreaker');
const config = require('../config');

// Use environment-aware configuration from centralized config
const SUPABASE_URL = config.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = config.SUPABASE_SERVICE_ROLE_KEY;

// Check if we're in a test environment (tests set these vars before requiring)
const IS_TEST = process.env.NODE_ENV === 'test' || process.argv.some((arg) => arg.includes('test'));

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  if (!IS_TEST) {
    console.error(
      `CRITICAL: Supabase credentials missing for ${config.NODE_ENV} environment.`,
      'Backend will not function correctly.',
      `Environment: ${config.SUPABASE_CONFIG.environment}`,
    );
  }
}

const DEFAULT_CIRCUIT_BREAKER_OPTIONS = {
  failureThreshold: 3,
  openDurationMs: 30000,
  halfOpenMaxAttempts: 1,
};

function isNetworkError(error) {
  if (!error) return false;
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes('Failed to fetch') ||
    message.includes('NetworkError') ||
    message.includes('Network request failed') ||
    message.includes('ERR_NETWORK') ||
    message.includes('ECONNRESET') ||
    message.includes('ETIMEDOUT') ||
    message.includes('EAI_AGAIN')
  );
}

function shouldRecordFailureFromStatus(status) {
  if (typeof status !== 'number') return false;
  return status === 429 || status >= 500;
}

function createCircuitOpenError(retryAfterMs) {
  const error = new AppError(
    'Supabase temporarily unavailable (circuit open)',
    'SERVICE_UNAVAILABLE',
    503,
    { retryAfterMs },
  );
  error.name = 'CircuitOpenError';
  return error;
}

function createSupabaseFetch(fetcher, circuitBreaker) {
  return async (input, init) => {
    const decision = await circuitBreaker.canRequest('supabase');
    if (!decision.allowed) {
      throw createCircuitOpenError(decision.retryAfterMs);
    }

    try {
      const response = await fetcher(input, init);
      if (shouldRecordFailureFromStatus(response.status)) {
        await circuitBreaker.recordFailure('supabase');
      } else {
        await circuitBreaker.recordSuccess('supabase');
      }
      return response;
    } catch (error) {
      if (isNetworkError(error)) {
        await circuitBreaker.recordFailure('supabase');
      }
      throw error;
    }
  };
}

function createSupabaseClient({
  supabaseUrl,
  supabaseKey,
  fetcher = globalThis.fetch,
  circuitBreaker = new CircuitBreaker(DEFAULT_CIRCUIT_BREAKER_OPTIONS),
} = {}) {
  if (typeof fetcher !== 'function') {
    throw new Error('Fetch implementation is required for Supabase client.');
  }

  const fetchWithBreaker = createSupabaseFetch(fetcher, circuitBreaker);
  const client = createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      fetch: fetchWithBreaker,
    },
  });

  return { client, circuitBreaker };
}

// Create client only if we have valid credentials, otherwise create a dummy
// that will fail gracefully when accessed (for test environments)
let supabase;
let supabaseCircuitBreaker = null;
if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
  const { client, circuitBreaker } = createSupabaseClient({
    supabaseUrl: SUPABASE_URL,
    supabaseKey: SUPABASE_SERVICE_ROLE_KEY,
  });
  supabase = client;
  supabaseCircuitBreaker = circuitBreaker;
} else {
  // Placeholder for tests - will be mocked by tests that need it
  supabase = {
    from: () => {
      throw new Error(
        'Supabase not configured. Set SUPABASE_URL_DEV and SUPABASE_SERVICE_ROLE_KEY_DEV.',
      );
    },
  };
}

module.exports = {
  supabase,
  createSupabaseClient,
  supabaseCircuitBreaker,
};
