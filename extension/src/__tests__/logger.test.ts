import { describe, expect, it } from 'vitest';
import { sanitizeForLogging } from '../logger';

describe('logger sanitization', () => {
  it('redacts sensitive payload keys and strips URL query params', () => {
    const [sanitized] = sanitizeForLogging([
      {
        transcriptChunk: 'secret transcript data',
        mediaUrl: 'https://example.com/video.mp4?token=abc123&x=1#frag',
        nested: {
          prompt: 'what is the answer',
          url: 'https://api.example.com/path?access_token=123',
        },
      },
    ]) as [Record<string, unknown>];

    expect(sanitized['transcriptChunk']).toBe('[REDACTED]');
    expect(sanitized['mediaUrl']).toBe('https://example.com/video.mp4');
    expect((sanitized['nested'] as Record<string, unknown>)['prompt']).toBe('[REDACTED]');
    expect((sanitized['nested'] as Record<string, unknown>)['url']).toBe(
      'https://api.example.com/path',
    );
  });

  it('normalizes error objects to safe metadata', () => {
    const error = new Error('Request failed for https://example.com/path?token=abc');
    (error as Error & { code?: string }).code = 'FAIL_TEST';

    const [sanitized] = sanitizeForLogging([error]) as [Record<string, unknown>];
    expect(sanitized).toMatchObject({
      name: 'Error',
      code: 'FAIL_TEST',
    });
    expect(typeof sanitized['message']).toBe('string');
    expect((sanitized['message'] as string).includes('token=abc')).toBe(false);
  });
});
