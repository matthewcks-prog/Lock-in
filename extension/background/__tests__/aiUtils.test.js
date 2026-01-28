import '../transcripts/aiUtils.js';

const { aiUtils } = globalThis.LockInBackground.transcripts;

describe('aiUtils', () => {
  test('normalizeMediaUrl strips tracking params', () => {
    const url = 'https://example.com/video.mp4?utm_source=test&x=1';
    const normalized = aiUtils.normalizeMediaUrl(url);
    expect(normalized).toBe('https://example.com/video.mp4?x=1');
  });

  test('isBlobUrl detects blob scheme', () => {
    expect(aiUtils.isBlobUrl('blob:https://example.com/123')).toBe(true);
    expect(aiUtils.isBlobUrl('https://example.com/video.mp4')).toBe(false);
  });

  test('fallbackHash is deterministic', () => {
    const hash1 = aiUtils.fallbackHash('lockin');
    const hash2 = aiUtils.fallbackHash('lockin');
    expect(hash1).toBe(hash2);
  });
});
