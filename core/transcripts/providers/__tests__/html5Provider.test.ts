import { describe, expect, it, vi } from 'vitest';
import { Html5Provider } from '../html5Provider';

describe('Html5Provider', () => {
  it('extracts transcript from track URLs', async () => {
    const provider = new Html5Provider();
    const fetcher = {
      fetchWithCredentials: vi
        .fn()
        .mockResolvedValueOnce('WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nHello world'),
      fetchJson: vi.fn(),
    };

    const video = {
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
    };

    const result = await provider.extractTranscript(video, fetcher);
    expect(result.success).toBe(true);
    expect(result.transcript?.plainText).toBe('Hello world');
    expect(result.transcript?.segments).toHaveLength(1);
  });

  it('returns auth error when captions require login', async () => {
    const provider = new Html5Provider();
    const fetcher = {
      fetchWithCredentials: vi.fn().mockRejectedValueOnce(new Error('AUTH_REQUIRED')),
      fetchJson: vi.fn(),
    };

    const video = {
      id: 'html5-2',
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
      mediaUrl: 'https://example.com/media.mp4',
    };

    const result = await provider.extractTranscript(video, fetcher);
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('AUTH_REQUIRED');
  });
});
