import { describe, expect, it, vi } from 'vitest';
import type { AsyncFetcher } from '../../fetchers/types';
import type { DetectedVideo } from '../../types';
import { Html5Provider } from '../html5Provider';

const createProvider = (): Html5Provider => new Html5Provider();

const createFetcher = (handler: (url: string) => Promise<string>): AsyncFetcher => ({
  fetchWithCredentials: vi.fn(handler) as unknown as AsyncFetcher['fetchWithCredentials'],
  fetchJson: vi.fn() as unknown as AsyncFetcher['fetchJson'],
});

const buildVideo = (overrides: Partial<DetectedVideo>): DetectedVideo => ({
  id: 'html5-1',
  provider: 'html5' as const,
  title: 'HTML5 Video',
  embedUrl: 'https://example.com/video',
  trackUrls: [
    {
      kind: 'subtitles',
      label: 'English',
      src: 'https://example.com/captions.vtt',
    },
  ],
  ...overrides,
});

describe('Html5Provider', () => {
  it('extracts transcript from track URLs', async () => {
    const provider = createProvider();
    const fetcher = createFetcher(
      async (_url: string) => 'WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nHello world',
    );

    const video = buildVideo({ id: 'html5-1' });

    const result = await provider.extractTranscript(video, fetcher);
    expect(result.success).toBe(true);
    expect(result.transcript?.plainText).toBe('Hello world');
    expect(result.transcript?.segments).toHaveLength(1);
  });

  it('returns auth error when captions require login', async () => {
    const provider = createProvider();
    const fetcher = createFetcher(async (_url: string) => {
      throw new Error('AUTH_REQUIRED');
    });

    const video = buildVideo({
      id: 'html5-2',
      mediaUrl: 'https://example.com/media.mp4',
    });

    const result = await provider.extractTranscript(video, fetcher);
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('AUTH_REQUIRED');
  });
});
