/**
 * Enhanced Health Check Endpoints
 *
 * Provides:
 * - /health - Basic liveness probe (fast, always returns 200 if server is running)
 * - /health/ready - Readiness probe (checks dependencies)
 * - /health/deep - Deep health check (detailed dependency status)
 *
 * Use /health for Kubernetes/Azure Container Apps liveness probes.
 * Use /health/ready for readiness probes (only route traffic when dependencies are healthy).
 */

const { logger } = require('./index');
const { fetchWithRetry } = require('../utils/networkRetry');
const { FIVE, THOUSAND } = require('../constants/numbers');
const HTTP_STATUS = require('../constants/httpStatus');

const DEFAULT_AZURE_API_VERSION = '2024-02-01';
const AZURE_TIMEOUT_MS = FIVE * THOUSAND;
const AZURE_RETRYABLE_STATUSES = [
  HTTP_STATUS.TOO_MANY_REQUESTS,
  HTTP_STATUS.BAD_GATEWAY,
  HTTP_STATUS.SERVICE_UNAVAILABLE,
  HTTP_STATUS.GATEWAY_TIMEOUT,
];

/**
 * Check if Supabase is reachable.
 *
 * @param {Object} supabase - Supabase client instance
 * @returns {Promise<{status: string, latencyMs: number, error?: string}>}
 */
async function checkSupabase(supabase) {
  const start = Date.now();

  try {
    // Simple health check query - just verify connection works
    // Use a known public table in this project to avoid false negatives
    const { error } = await supabase.from('notes').select('id').limit(1);

    const latencyMs = Date.now() - start;

    if (error) {
      // Some errors are expected (e.g., table doesn't exist) but connection works
      if (error.code === '42P01') {
        // Table doesn't exist, but connection works
        return { status: 'healthy', latencyMs, note: 'Connection OK, notes table not found' };
      }
      return { status: 'degraded', latencyMs, error: error.message };
    }

    return { status: 'healthy', latencyMs };
  } catch (error) {
    const latencyMs = Date.now() - start;
    return { status: 'unhealthy', latencyMs, error: error.message };
  }
}

/**
 * Check if Azure OpenAI is reachable.
 * Uses a minimal API call to verify credentials and connectivity.
 *
 * @param {Object} config - Config object with Azure OpenAI settings
 * @returns {Promise<{status: string, latencyMs: number, error?: string}>}
 */
async function checkAzureOpenAI(config) {
  const start = Date.now();

  const endpoint = config.AZURE_OPENAI_ENDPOINT;
  const apiKey = config.AZURE_OPENAI_API_KEY;

  if (!endpoint || !apiKey) {
    return { status: 'not_configured', latencyMs: 0 };
  }

  try {
    // Just check if the endpoint is reachable (HEAD request or models list)
    const url = `${endpoint.replace(/\/$/, '')}/openai/models?api-version=${
      config.AZURE_OPENAI_API_VERSION || DEFAULT_AZURE_API_VERSION
    }`;

    const response = await fetchWithRetry(
      url,
      {
        method: 'GET',
        headers: {
          'api-key': apiKey,
        },
      },
      {
        maxRetries: 1,
        timeoutMs: AZURE_TIMEOUT_MS,
        retryableStatuses: AZURE_RETRYABLE_STATUSES,
      },
    );
    const latencyMs = Date.now() - start;

    if (response.ok || response.status === HTTP_STATUS.UNAUTHORIZED) {
      // 401 means endpoint is reachable but auth failed (still "reachable")
      return {
        status: response.ok ? 'healthy' : 'auth_error',
        latencyMs,
        httpStatus: response.status,
      };
    }

    return {
      status: 'degraded',
      latencyMs,
      httpStatus: response.status,
    };
  } catch (error) {
    const latencyMs = Date.now() - start;
    return {
      status: 'unhealthy',
      latencyMs,
      error:
        error.name === 'AbortError' || error.code === 'TIMEOUT' ? 'Timeout (5s)' : error.message,
    };
  }
}

function createLivenessHandler() {
  return (_req, res) => {
    res.json({
      status: 'ok',
      message: 'Lock-in API is running',
      timestamp: new Date().toISOString(),
    });
  };
}

function createReadinessHandler({ supabase }) {
  return async (_req, res) => {
    try {
      const supabaseCheck = await checkSupabase(supabase);
      const isReady = supabaseCheck.status === 'healthy';

      res.status(isReady ? HTTP_STATUS.OK : HTTP_STATUS.SERVICE_UNAVAILABLE).json({
        status: isReady ? 'ready' : 'not_ready',
        checks: {
          database: supabaseCheck.status,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Readiness check failed');
      res.status(HTTP_STATUS.SERVICE_UNAVAILABLE).json({
        status: 'not_ready',
        error: 'Health check failed',
        timestamp: new Date().toISOString(),
      });
    }
  };
}

function determineOverallStatus({ supabaseCheck, azureCheck }) {
  const supabaseHealthy = supabaseCheck.status === 'healthy';
  const azureHealthy = azureCheck.status === 'healthy' || azureCheck.status === 'not_configured';

  if (supabaseCheck.status === 'unhealthy' || azureCheck.status === 'unhealthy') {
    return 'unhealthy';
  }

  if (!supabaseHealthy || !azureHealthy) {
    return 'degraded';
  }

  return 'healthy';
}

function createDeepHandler({ supabase, config, limits }) {
  return async (_req, res) => {
    const startTime = Date.now();

    try {
      const [supabaseCheck, azureCheck] = await Promise.all([
        checkSupabase(supabase),
        checkAzureOpenAI(config),
      ]);

      const totalLatency = Date.now() - startTime;
      const overallStatus = determineOverallStatus({ supabaseCheck, azureCheck });
      const statusCode =
        overallStatus === 'unhealthy' ? HTTP_STATUS.SERVICE_UNAVAILABLE : HTTP_STATUS.OK;

      res.status(statusCode).json({
        status: overallStatus,
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        uptime: process.uptime(),
        checks: {
          database: supabaseCheck,
          azureOpenAI: azureCheck,
        },
        limits: limits || {},
        latencyMs: totalLatency,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Deep health check failed');
      res.status(HTTP_STATUS.SERVICE_UNAVAILABLE).json({
        status: 'error',
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  };
}

/**
 * Create health check route handlers.
 *
 * @param {Object} dependencies
 * @param {Object} dependencies.supabase - Supabase client
 * @param {Object} dependencies.config - Config object
 * @param {Object} dependencies.limits - Request limits config
 * @returns {Object} Route handlers
 */
function createHealthRoutes({ supabase, config, limits }) {
  return {
    /**
     * Basic liveness probe.
     * Returns 200 if the server is running. No dependency checks.
     */
    liveness: createLivenessHandler(),

    /**
     * Readiness probe.
     * Returns 200 only if critical dependencies are healthy.
     * Azure Container Apps should route traffic only when this returns 200.
     */
    readiness: createReadinessHandler({ supabase }),

    /**
     * Deep health check with full dependency status.
     * Use for debugging and monitoring dashboards.
     */
    deep: createDeepHandler({ supabase, config, limits }),
  };
}

module.exports = {
  createHealthRoutes,
  checkSupabase,
  checkAzureOpenAI,
};
