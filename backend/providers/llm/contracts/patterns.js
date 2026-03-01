const FALLBACK_ERROR_PATTERNS = [
  'rate limit',
  'rate_limit',
  'ratelimit',
  'quota',
  '429',
  'too many requests',
  'resource exhausted',
  'resource_exhausted',
  'capacity',
  'overloaded',
  'timeout',
  'timed out',
  'econnreset',
  'econnrefused',
  'socket hang up',
  'network error',
  'service unavailable',
  '503',
  '502',
  '500',
];

const NO_FALLBACK_ERROR_PATTERNS = [
  'invalid api key',
  'invalid_api_key',
  'authentication failed',
  'content policy',
  'safety',
  'blocked',
  'invalid request',
];

module.exports = {
  FALLBACK_ERROR_PATTERNS,
  NO_FALLBACK_ERROR_PATTERNS,
};
