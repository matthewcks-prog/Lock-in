import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('transcriptLogger', () => {
  const previousLogLevel = process.env['LOCKIN_TRANSCRIPT_LOG_LEVEL'];

  beforeEach(() => {
    process.env['LOCKIN_TRANSCRIPT_LOG_LEVEL'] = 'warn';
    vi.resetModules();
  });

  afterEach(() => {
    if (previousLogLevel === undefined) {
      delete process.env['LOCKIN_TRANSCRIPT_LOG_LEVEL'];
    } else {
      process.env['LOCKIN_TRANSCRIPT_LOG_LEVEL'] = previousLogLevel;
    }
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('redacts sensitive metadata and strips URL query params', async () => {
    const { logWithPrefix } = await import('../transcriptLogger');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    logWithPrefix('[Test]', 'warn', 'Transcript fetch failed for https://x.test/vtt?token=abc', {
      transcriptChunk: 'raw chunk text',
      mediaUrl: 'https://media.example/video.mp4?sig=123#frag',
      nested: {
        prompt: 'explain this transcript',
      },
    });

    expect(warnSpy).toHaveBeenCalledTimes(1);
    const [message, meta] = warnSpy.mock.calls[0] as [string, Record<string, unknown>];
    expect(message).toBe('[Test] Transcript fetch failed for https://x.test/vtt');
    expect(meta['transcriptChunk']).toBe('[REDACTED]');
    expect(meta['mediaUrl']).toBe('https://media.example/video.mp4');
    expect((meta['nested'] as Record<string, unknown>)['prompt']).toBe('[REDACTED]');
  });
});
