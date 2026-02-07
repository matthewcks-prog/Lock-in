import type { Breadcrumb, ErrorEvent, EventHint } from '@sentry/browser';

const SENSITIVE_EXTRA_KEYS =
  /transcript|note|selection|prompt|message|content|chat|caption|text|query|input|output/i;
const MAX_STRING_LENGTH = 500;
const URL_PROTOCOL_PREFIX = 'http';

function stripQueryParams(url: string | undefined): string | undefined {
  if (url === undefined || url.length === 0) return url;
  try {
    const parsed = new URL(url, 'http://placeholder');
    parsed.search = '';
    parsed.hash = '';
    return url.startsWith(URL_PROTOCOL_PREFIX)
      ? parsed.toString().replace(/\/$/, '')
      : parsed.pathname;
  } catch {
    const base = url.split('?')[0] ?? '';
    const withoutHash = base.split('#')[0] ?? '';
    return withoutHash.length > 0 ? withoutHash : base;
  }
}

function redactLongStrings(obj: unknown, maxLen: number = MAX_STRING_LENGTH): unknown {
  if (obj === null || obj === undefined) return obj;

  if (typeof obj === 'string') {
    return obj.length > maxLen ? `[REDACTED: ${obj.length} chars]` : obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => redactLongStrings(item, maxLen));
  }

  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = redactLongStrings(value, maxLen);
    }
    return result;
  }

  return obj;
}

function sanitizeBreadcrumbs(breadcrumbs: Breadcrumb[] | undefined): Breadcrumb[] | undefined {
  if (breadcrumbs === undefined) return undefined;

  return breadcrumbs.map((bc) => {
    const sanitized = { ...bc };
    if (sanitized.data !== undefined) {
      const data = { ...(sanitized.data as Record<string, unknown>) };
      sanitized.data = data;
      delete data['body'];
      delete data['response'];
      delete data['request'];
      delete data['responseBody'];
      delete data['requestBody'];
      if (typeof data['url'] === 'string') {
        data['url'] = stripQueryParams(data['url']);
      }
      if (typeof data['from'] === 'string') {
        data['from'] = stripQueryParams(data['from']);
      }
      if (typeof data['to'] === 'string') {
        data['to'] = stripQueryParams(data['to']);
      }
    }
    return sanitized;
  });
}

function sanitizeRequest(event: ErrorEvent): void {
  if (event.request === undefined) return;

  const requestUrl = event.request.url;
  if (typeof requestUrl === 'string' && requestUrl.length > 0) {
    const sanitizedUrl = stripQueryParams(requestUrl);
    if (sanitizedUrl !== undefined) {
      event.request.url = sanitizedUrl;
    }
  }

  const headers = event.request.headers;
  if (headers !== undefined) {
    delete headers['Authorization'];
    delete headers['authorization'];
    delete headers['Cookie'];
    delete headers['cookie'];
  }

  if (event.request.cookies !== undefined) {
    event.request.cookies = {};
  }
}

function sanitizeTransaction(event: ErrorEvent): void {
  if (typeof event.transaction !== 'string' || event.transaction.length === 0) {
    return;
  }
  const sanitized = stripQueryParams(event.transaction);
  if (sanitized !== undefined && sanitized.length > 0) {
    event.transaction = sanitized;
  }
}

function sanitizeExtras(event: ErrorEvent): void {
  if (event.extra === undefined) return;
  const extra = event.extra as Record<string, unknown>;
  for (const key of Object.keys(extra)) {
    if (SENSITIVE_EXTRA_KEYS.test(key)) {
      extra[key] = '[REDACTED]';
    }
  }
  event.extra = redactLongStrings(extra) as Record<string, unknown>;
}

function sanitizeUser(event: ErrorEvent): void {
  if (event.user === undefined) return;
  delete event.user.id;
  delete event.user.email;
  delete event.user.username;
  delete event.user.ip_address;
}

function sanitizeEventBreadcrumbs(event: ErrorEvent): void {
  const sanitizedBreadcrumbs = sanitizeBreadcrumbs(event.breadcrumbs);
  if (sanitizedBreadcrumbs !== undefined) {
    event.breadcrumbs = sanitizedBreadcrumbs;
  }
}

export function beforeSendScrubber(event: ErrorEvent, _hint: EventHint): ErrorEvent | null {
  sanitizeRequest(event);
  sanitizeTransaction(event);
  sanitizeExtras(event);
  sanitizeUser(event);
  sanitizeEventBreadcrumbs(event);
  return event;
}
