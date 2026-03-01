import { describe, expect, it } from 'vitest';
import type { ErrorEvent } from '@sentry/browser';
import { beforeSendScrubber } from '../privacy';

function createBaseEvent(): ErrorEvent {
  return {
    event_id: 'evt_1',
    request: {
      url: 'https://api.example.com/endpoint?token=abc123',
      headers: {
        Authorization: 'Bearer secret',
        Cookie: 'session=secret',
      },
      cookies: 'session=secret',
    },
    transaction: 'https://app.example.com/page?sig=123',
    extra: {
      transcriptChunk: 'raw transcript content',
      promptText: 'raw prompt',
      safeValue: 'ok',
      longValue: 'x'.repeat(900),
    },
    user: {
      id: 'user-id',
      email: 'user@example.com',
      username: 'user',
      ip_address: '127.0.0.1',
    },
    breadcrumbs: [
      {
        category: 'fetch',
        data: {
          url: 'https://service.example.com/resource?apikey=123',
          requestBody: '{"prompt":"secret"}',
          responseBody: '{"content":"secret"}',
        },
      },
    ],
  } as unknown as ErrorEvent;
}

describe('beforeSendScrubber', () => {
  it('redacts sensitive fields and strips query params', () => {
    const event = createBaseEvent();
    const sanitized = beforeSendScrubber(event, {} as never);

    expect(sanitized).not.toBeNull();
    expect(sanitized?.request?.url).toBe('https://api.example.com/endpoint');
    expect(sanitized?.transaction).toBe('https://app.example.com/page');
    expect(sanitized?.request?.headers?.['Authorization']).toBeUndefined();
    expect(sanitized?.request?.headers?.['Cookie']).toBeUndefined();
    expect(sanitized?.request?.cookies).toEqual({});

    const extra = sanitized?.extra as Record<string, unknown>;
    expect(extra['transcriptChunk']).toBe('[REDACTED]');
    expect(extra['promptText']).toBe('[REDACTED]');
    expect(extra['safeValue']).toBe('ok');
    expect(extra['longValue']).toBe('[REDACTED: 900 chars]');

    const breadcrumbData = sanitized?.breadcrumbs?.[0]?.data as Record<string, unknown>;
    expect(breadcrumbData['url']).toBe('https://service.example.com/resource');
    expect(breadcrumbData['requestBody']).toBeUndefined();
    expect(breadcrumbData['responseBody']).toBeUndefined();

    expect(sanitized?.user?.id).toBeUndefined();
    expect(sanitized?.user?.email).toBeUndefined();
  });
});
