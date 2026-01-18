/**
 * URL Sanitizer Utility
 *
 * Strips sensitive query parameters from URLs before transmission to backend.
 * This ensures privacy compliance and prevents accidental leakage of:
 * - Session tokens (sesskey, sid, token)
 * - Authentication credentials
 * - User-specific identifiers
 *
 * Safe parameters (id, section, week, etc.) are preserved for navigation context.
 */

/**
 * Query parameters that should ALWAYS be stripped from URLs.
 * These may contain sensitive session/auth data.
 */
const SENSITIVE_PARAMS = new Set([
  // Moodle-specific
  'sesskey',
  'token',
  'wstoken',
  'moodlewsrestformat',
  // Generic auth/session
  'sid',
  'sessionid',
  'session_id',
  'session',
  'auth',
  'authtoken',
  'auth_token',
  'access_token',
  'refresh_token',
  'api_key',
  'apikey',
  'key',
  'secret',
  'password',
  'pwd',
  // OAuth/SSO
  'code',
  'state',
  'nonce',
  'oauth_token',
  'oauth_verifier',
  // Analytics/tracking (not sensitive but unnecessary)
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'fbclid',
  'gclid',
  '_ga',
  '_gl',
]);

/**
 * Query parameters that are SAFE to keep (for navigation context).
 * Only params in this allowlist will be preserved.
 */
const SAFE_PARAMS = new Set([
  // Moodle navigation
  'id',
  'section',
  'course',
  'cmid',
  'modname',
  'page',
  'perpage',
  // EdStem navigation
  'slide',
  'lesson',
  // Panopto navigation
  'start',
  'autoplay',
  // Generic navigation
  'tab',
  'view',
  'week',
  'topic',
  'module',
]);

/**
 * Sanitize a URL by removing sensitive query parameters.
 *
 * Uses an allowlist approach: only explicitly safe parameters are kept.
 * This is more secure than a blocklist approach.
 *
 * @param url - The URL to sanitize (can be full URL or just path)
 * @returns Sanitized URL with sensitive params removed, or original if parsing fails
 *
 * @example
 * sanitizeUrl('https://moodle.edu/mod/page/view.php?id=123&sesskey=abc')
 * // Returns: 'https://moodle.edu/mod/page/view.php?id=123'
 */
export function sanitizeUrl(url: string | undefined | null): string {
  if (!url || typeof url !== 'string') {
    return '';
  }

  try {
    const parsed = new URL(url);

    // Get all current params
    const paramsToRemove: string[] = [];
    parsed.searchParams.forEach((_, key) => {
      const lowerKey = key.toLowerCase();
      // Remove if it's in the sensitive list OR not in the safe list
      if (SENSITIVE_PARAMS.has(lowerKey) || !SAFE_PARAMS.has(lowerKey)) {
        paramsToRemove.push(key);
      }
    });

    // Remove identified params
    paramsToRemove.forEach((key) => parsed.searchParams.delete(key));

    return parsed.toString();
  } catch {
    // If URL parsing fails, try to at least strip obvious sensitive params
    // This handles relative URLs or malformed URLs
    return stripSensitiveParamsFromString(url);
  }
}

/**
 * Strips the query string entirely from a URL.
 * Use when you only need the base path, not any parameters.
 *
 * @param url - The URL to strip
 * @returns URL without any query parameters
 */
export function stripQueryParams(url: string | undefined | null): string {
  if (!url || typeof url !== 'string') {
    return '';
  }

  try {
    const parsed = new URL(url);
    parsed.search = '';
    return parsed.toString();
  } catch {
    // Fallback for relative URLs
    const queryIndex = url.indexOf('?');
    return queryIndex >= 0 ? url.substring(0, queryIndex) : url;
  }
}

/**
 * Fallback sanitization for strings that can't be parsed as URLs.
 * Uses regex to strip known sensitive parameter patterns.
 */
function stripSensitiveParamsFromString(urlString: string): string {
  let result = urlString;

  // Create pattern from sensitive params
  const sensitivePattern = Array.from(SENSITIVE_PARAMS).join('|');
  const regex = new RegExp(`([?&])(${sensitivePattern})=[^&]*`, 'gi');

  result = result.replace(regex, (_match, prefix) => {
    // If it's the first param (?), we might need to adjust the next param
    return prefix === '?' ? '?' : '';
  });

  // Clean up malformed query strings (e.g., ?& or &&)
  result = result.replace(/\?&/, '?').replace(/&&+/g, '&').replace(/\?$/, '');

  return result;
}

/**
 * Check if a URL contains any sensitive parameters.
 * Useful for validation/logging without modifying the URL.
 *
 * @param url - The URL to check
 * @returns true if URL contains sensitive params
 */
export function hasSensitiveParams(url: string | undefined | null): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }

  try {
    const parsed = new URL(url);
    for (const key of parsed.searchParams.keys()) {
      if (SENSITIVE_PARAMS.has(key.toLowerCase())) {
        return true;
      }
    }
    return false;
  } catch {
    // Fallback check
    const sensitivePattern = Array.from(SENSITIVE_PARAMS).join('|');
    const regex = new RegExp(`[?&](${sensitivePattern})=`, 'i');
    return regex.test(url);
  }
}
