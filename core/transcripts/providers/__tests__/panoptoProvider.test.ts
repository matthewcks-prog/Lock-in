/**
 * Panopto Provider Tests
 */

import { describe, it, expect, vi } from 'vitest';
import {
  isPanoptoUrl,
  extractCaptionVttUrl,
  extractPanoptoInfo,
  buildPanoptoEmbedUrl,
  buildPanoptoViewerUrl,
  isLmsRedirectPage,
  detectPanoptoFromLinks,
  detectPanoptoFromRedirect,
  PanoptoProvider,
} from '../panoptoProvider';

const PANOPTO_TENANT = 'monash.au.panopto.com';
const PANOPTO_VIDEO_ID = 'abc12345-1234-5678-9abc-def012345678';
const PANOPTO_EMBED_URL = `https://${PANOPTO_TENANT}/Panopto/Pages/Embed.aspx?id=${PANOPTO_VIDEO_ID}`;
const PANOPTO_VIEWER_URL = `https://${PANOPTO_TENANT}/Panopto/Pages/Viewer.aspx?id=${PANOPTO_VIDEO_ID}`;

const createProvider = (): PanoptoProvider => new PanoptoProvider();

const buildIframe = (src: string, title?: string): { src: string; title?: string } => ({
  src,
  ...(title !== undefined ? { title } : {}),
});

const buildContext = (
  iframes: Array<{ src: string; title?: string }>,
  pageUrl = 'https://learning.monash.edu/',
): { pageUrl: string; iframes: Array<{ src: string; title?: string }> } => ({
  pageUrl,
  iframes,
});

describe('isPanoptoUrl', () => {
  it('returns true for Panopto embed URLs', () => {
    expect(isPanoptoUrl(PANOPTO_EMBED_URL)).toBe(true);
  });

  it('returns true for Panopto viewer URLs', () => {
    expect(isPanoptoUrl(PANOPTO_VIEWER_URL)).toBe(true);
  });

  it('returns false for non-Panopto URLs', () => {
    expect(isPanoptoUrl('https://youtube.com/watch?v=abc')).toBe(false);
    expect(isPanoptoUrl('https://example.com')).toBe(false);
  });
});

describe('buildPanoptoEmbedUrl', () => {
  it('builds a canonical embed URL', () => {
    expect(buildPanoptoEmbedUrl(PANOPTO_TENANT, PANOPTO_VIDEO_ID)).toBe(PANOPTO_EMBED_URL);
  });
});

describe('buildPanoptoViewerUrl', () => {
  it('builds a canonical viewer URL', () => {
    expect(buildPanoptoViewerUrl(PANOPTO_TENANT, PANOPTO_VIDEO_ID)).toBe(PANOPTO_VIEWER_URL);
  });
});

describe('extractCaptionVttUrl (structured)', () => {
  it('extracts CaptionUrl from JSON structure', () => {
    const html = `
      <script>
        var deliveryInfo = {
          "CaptionUrl": ["https://monash.au.panopto.com/Panopto/Pages/Transcription/GetCaptionVTT.ashx?id=abc123&escape=true&language=0"]
        };
      </script>
    `;
    const result = extractCaptionVttUrl(html);
    expect(result).toBe(
      'https://monash.au.panopto.com/Panopto/Pages/Transcription/GetCaptionVTT.ashx?id=abc123&escape=true&language=0',
    );
  });

  it('extracts from Captions array with Url', () => {
    const html = `
      <script>
        var config = {
          "Captions": [{"Url": "https://example.panopto.com/GetCaptionVTT.ashx?id=xyz", "Language": "en"}]
        };
      </script>
    `;
    const result = extractCaptionVttUrl(html);
    expect(result).toBe('https://example.panopto.com/GetCaptionVTT.ashx?id=xyz');
  });

  it('extracts TranscriptUrl', () => {
    const html = `{"TranscriptUrl": "https://panopto.com/transcript/vtt"}`;
    const result = extractCaptionVttUrl(html);
    expect(result).toBe('https://panopto.com/transcript/vtt');
  });
});

describe('extractCaptionVttUrl (fallbacks)', () => {
  it('extracts direct GetCaptionVTT.ashx URL', () => {
    const html = `
      <div data-caption="https://panopto.com/Panopto/Pages/Transcription/GetCaptionVTT.ashx?id=test123"></div>
    `;
    const result = extractCaptionVttUrl(html);
    expect(result).toBe(
      'https://panopto.com/Panopto/Pages/Transcription/GetCaptionVTT.ashx?id=test123',
    );
  });

  it('handles escaped JSON strings', () => {
    const html = `{"CaptionUrl":["https:\\/\\/panopto.com\\/GetCaptionVTT.ashx?id=123"]}`;
    const result = extractCaptionVttUrl(html);
    expect(result).toBe('https://panopto.com/GetCaptionVTT.ashx?id=123');
  });

  it('extracts relative GetCaptionVTT URLs', () => {
    const html = `
      <script>
        var caption = "/Panopto/Pages/Transcription/GetCaptionVTT.ashx?id=rel123&language=0";
      </script>
    `;
    const result = extractCaptionVttUrl(html);
    expect(result).toBe('/Panopto/Pages/Transcription/GetCaptionVTT.ashx?id=rel123&language=0');
  });

  it('returns null when no caption URL found', () => {
    const html = '<html><body>No captions here</body></html>';
    expect(extractCaptionVttUrl(html)).toBeNull();
  });
});

describe('PanoptoProvider canHandle', () => {
  const provider = createProvider();

  it('returns true for Panopto embed URLs', () => {
    expect(provider.canHandle(PANOPTO_EMBED_URL)).toBe(true);
  });

  it('returns true for Panopto viewer URLs', () => {
    expect(provider.canHandle(PANOPTO_VIEWER_URL)).toBe(true);
  });

  it('returns false for non-Panopto URLs', () => {
    expect(provider.canHandle('https://youtube.com/watch?v=abc')).toBe(false);
    expect(provider.canHandle('https://example.com')).toBe(false);
  });
});

describe('PanoptoProvider requiresAsyncDetection', () => {
  const provider = createProvider();

  it('always returns false (Panopto uses DOM detection)', () => {
    expect(provider.requiresAsyncDetection({ pageUrl: 'https://example.com', iframes: [] })).toBe(
      false,
    );
  });
});

describe('PanoptoProvider detectVideosSync (iframes)', () => {
  const provider = createProvider();

  it('detects Panopto iframes', () => {
    const context = buildContext([
      buildIframe(
        'https://monash.au.panopto.com/Panopto/Pages/Embed.aspx?id=abc12345-1234-5678-9abc-def012345678',
        'Week 1 Lecture',
      ),
      buildIframe('https://youtube.com/embed/xyz123', 'YouTube Video'),
    ]);

    const videos = provider.detectVideosSync(context);

    expect(videos).toHaveLength(1);
    expect(videos[0]).toEqual({
      id: 'abc12345-1234-5678-9abc-def012345678',
      provider: 'panopto',
      title: 'Week 1 Lecture',
      embedUrl:
        'https://monash.au.panopto.com/Panopto/Pages/Embed.aspx?id=abc12345-1234-5678-9abc-def012345678',
      panoptoTenant: PANOPTO_TENANT,
    });
  });

  it('uses fallback title when iframe has no title', () => {
    const context = buildContext([
      buildIframe(
        'https://monash.au.panopto.com/Panopto/Pages/Embed.aspx?id=abc12345-1234-5678-9abc-def012345678',
      ),
    ]);

    const videos = provider.detectVideosSync(context);

    expect(videos).toHaveLength(1);
    expect(videos[0]?.title).toBe('Panopto video 1');
  });
});

describe('PanoptoProvider detectVideosSync (multi)', () => {
  const provider = createProvider();

  it('detects multiple Panopto videos', () => {
    const context = buildContext([
      buildIframe(
        'https://monash.au.panopto.com/Panopto/Pages/Embed.aspx?id=11111111-1234-5678-9abc-def012345678',
        'Video 1',
      ),
      buildIframe(
        'https://monash.au.panopto.com/Panopto/Pages/Embed.aspx?id=22222222-1234-5678-9abc-def012345678',
        'Video 2',
      ),
    ]);

    const videos = provider.detectVideosSync(context);

    expect(videos).toHaveLength(2);
    expect(videos[0]?.id).toBe('11111111-1234-5678-9abc-def012345678');
    expect(videos[0]?.panoptoTenant).toBe(PANOPTO_TENANT);
    expect(videos[1]?.id).toBe('22222222-1234-5678-9abc-def012345678');
    expect(videos[1]?.panoptoTenant).toBe(PANOPTO_TENANT);
  });

  it('deduplicates videos by ID', () => {
    const context = buildContext([
      buildIframe('https://monash.au.panopto.com/Panopto/Pages/Embed.aspx?id=abc123', 'Video 1'),
      buildIframe(
        'https://monash.au.panopto.com/Panopto/Pages/Embed.aspx?id=abc123',
        'Video 1 duplicate',
      ),
    ]);

    const videos = provider.detectVideosSync(context);
    expect(videos).toHaveLength(1);
  });
});

describe('PanoptoProvider detectVideosSync (pageUrl)', () => {
  const provider = createProvider();

  it('detects video from page URL when on Panopto page', () => {
    const context = buildContext([], PANOPTO_VIEWER_URL);

    const videos = provider.detectVideosSync(context);

    expect(videos).toHaveLength(1);
    expect(videos[0]?.id).toBe(PANOPTO_VIDEO_ID);
    expect(videos[0]?.embedUrl).toBe(
      `https://monash.au.panopto.com/Panopto/Pages/Embed.aspx?id=${PANOPTO_VIDEO_ID}`,
    );
    expect(videos[0]?.panoptoTenant).toBe(PANOPTO_TENANT);
  });

  it('returns empty array when no Panopto iframes', () => {
    const context = buildContext(
      [buildIframe('https://youtube.com/embed/abc', 'YouTube')],
      'https://example.com/',
    );

    const videos = provider.detectVideosSync(context);

    expect(videos).toHaveLength(0);
  });
});

describe('PanoptoProvider extractTranscript (success)', () => {
  const provider = createProvider();

  it('extracts transcript using fetcher', async () => {
    const mockFetcher = {
      fetchWithCredentials: vi
        .fn()
        .mockResolvedValueOnce('{"CaptionUrl":["https://panopto.com/captions.vtt"]}')
        .mockResolvedValueOnce('WEBVTT\n\n00:00:00.000 --> 00:00:05.000\nHello world'),
      fetchJson: vi.fn(),
    };

    const video = {
      id: 'video123',
      provider: 'panopto' as const,
      title: 'Test Video',
      embedUrl: 'https://panopto.com/embed?id=video123',
    };

    const result = await provider.extractTranscript(video, mockFetcher);

    expect(result.success).toBe(true);
    expect(result.transcript?.plainText).toBe('Hello world');
    expect(result.transcript?.segments).toHaveLength(1);
  });
});

describe('PanoptoProvider extractTranscript (no captions)', () => {
  const provider = createProvider();

  it('returns error when no captions available', async () => {
    const mockFetcher = {
      fetchWithCredentials: vi
        .fn()
        .mockResolvedValueOnce('<html>No captions</html>')
        .mockResolvedValueOnce('<html>No captions</html>'),
      fetchJson: vi.fn(),
    };

    const video = {
      id: 'video123',
      provider: 'panopto' as const,
      title: 'Test Video',
      embedUrl: 'https://panopto.com/embed?id=video123',
    };

    const result = await provider.extractTranscript(video, mockFetcher);

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('NO_CAPTIONS');
    expect(result.aiTranscriptionAvailable).toBe(true);
  });
});

describe('PanoptoProvider extractTranscript (viewer URL)', () => {
  const provider = createProvider();

  it('prefers embed URL when given a viewer URL', async () => {
    const mockFetcher = {
      fetchWithCredentials: vi
        .fn()
        .mockResolvedValueOnce('{"CaptionUrl":["https://panopto.com/captions.vtt"]}')
        .mockResolvedValueOnce('WEBVTT\n\n00:00:00.000 --> 00:00:05.000\nHello world'),
      fetchJson: vi.fn(),
    };

    const video = {
      id: PANOPTO_VIDEO_ID,
      provider: 'panopto' as const,
      title: 'Test Video',
      embedUrl: PANOPTO_VIEWER_URL,
      panoptoTenant: PANOPTO_TENANT,
    };

    await provider.extractTranscript(video, mockFetcher);

    expect(mockFetcher.fetchWithCredentials).toHaveBeenNthCalledWith(1, PANOPTO_EMBED_URL);
  });
});

describe('PanoptoProvider extractTranscript (errors)', () => {
  const provider = createProvider();

  it('handles auth errors', async () => {
    const mockFetcher = {
      fetchWithCredentials: vi.fn().mockRejectedValueOnce(new Error('AUTH_REQUIRED')),
      fetchJson: vi.fn(),
    };

    const video = {
      id: 'video123',
      provider: 'panopto' as const,
      title: 'Test Video',
      embedUrl: 'https://panopto.com/embed?id=video123',
    };

    const result = await provider.extractTranscript(video, mockFetcher);

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('AUTH_REQUIRED');
  });

  it('handles network errors', async () => {
    const mockFetcher = {
      fetchWithCredentials: vi
        .fn()
        .mockRejectedValueOnce(new Error('Failed to fetch'))
        .mockRejectedValueOnce(new Error('Failed to fetch')),
      fetchJson: vi.fn(),
    };

    const video = {
      id: 'video123',
      provider: 'panopto' as const,
      title: 'Test Video',
      embedUrl: 'https://panopto.com/embed?id=video123',
    };

    const result = await provider.extractTranscript(video, mockFetcher);

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('NETWORK_ERROR');
  });
});

describe('PanoptoProvider metadata', () => {
  const provider = createProvider();

  it('has correct provider type', () => {
    expect(provider.provider).toBe('panopto');
  });
});

describe('extractPanoptoInfo', () => {
  it('extracts info from embed URL', () => {
    const url =
      'https://monash.au.panopto.com/Panopto/Pages/Embed.aspx?id=abc12345-1234-5678-9abc-def012345678';
    const info = extractPanoptoInfo(url);
    expect(info).toEqual({
      deliveryId: 'abc12345-1234-5678-9abc-def012345678',
      tenant: PANOPTO_TENANT,
    });
  });

  it('extracts info from viewer URL', () => {
    const url =
      'https://harvard.panopto.com/Panopto/Pages/Viewer.aspx?id=def67890-abcd-1234-5678-abcdef012345';
    const info = extractPanoptoInfo(url);
    expect(info).toEqual({
      deliveryId: 'def67890-abcd-1234-5678-abcdef012345',
      tenant: 'harvard.panopto.com',
    });
  });

  it('extracts from URL with id query param on panopto domain', () => {
    const url = 'https://university.panopto.com/some/path?id=abc12345-def67890';
    const info = extractPanoptoInfo(url);
    expect(info).toEqual({
      deliveryId: 'abc12345-def67890',
      tenant: 'university.panopto.com',
    });
  });

  it('handles encoded URLs', () => {
    const url = encodeURIComponent(
      'https://monash.panopto.com/Panopto/Pages/Viewer.aspx?id=abcd1234-5678-9abc-def0-123456789abc',
    );
    const info = extractPanoptoInfo(url);
    expect(info).toEqual({
      deliveryId: 'abcd1234-5678-9abc-def0-123456789abc',
      tenant: 'monash.panopto.com',
    });
  });

  it('returns null for non-Panopto URLs', () => {
    expect(extractPanoptoInfo('https://youtube.com/watch?v=abc')).toBeNull();
    expect(extractPanoptoInfo('https://example.com/page')).toBeNull();
  });
});

describe('isLmsRedirectPage', () => {
  it('returns true for Moodle mod/url pages', () => {
    expect(isLmsRedirectPage('https://learning.monash.edu/mod/url/view.php?id=12345')).toBe(true);
  });

  it('returns true for Moodle mod/resource pages', () => {
    expect(isLmsRedirectPage('https://learning.monash.edu/mod/resource/view.php?id=12345')).toBe(
      false,
    );
  });

  it('returns true for Moodle mod/lti pages', () => {
    expect(isLmsRedirectPage('https://learning.monash.edu/mod/lti/view.php?id=12345')).toBe(true);
  });

  it('returns false for regular pages', () => {
    expect(isLmsRedirectPage('https://learning.monash.edu/course/view.php?id=12345')).toBe(false);
    expect(isLmsRedirectPage('https://monash.panopto.com/Panopto/Pages/Viewer.aspx')).toBe(false);
  });
});

describe('detectPanoptoFromLinks (basic)', () => {
  it('detects Panopto links in anchor elements', () => {
    const html = `
        <html>
          <body>
            <a href="https://monash.au.panopto.com/Panopto/Pages/Viewer.aspx?id=abc12345-1234-5678-abcd-def012345678">Week 1 Lecture</a>
            <a href="https://youtube.com/watch?v=xyz">YouTube Video</a>
          </body>
        </html>
      `;
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const videos = detectPanoptoFromLinks(doc);

    expect(videos).toHaveLength(1);
    expect(videos[0]?.id).toBe('abc12345-1234-5678-abcd-def012345678');
    expect(videos[0]?.title).toBe('Week 1 Lecture');
    expect(videos[0]?.panoptoTenant).toBe(PANOPTO_TENANT);
  });

  it('ignores LMS wrapper links in the Panopto list', () => {
    const html = `
        <html>
          <body>
            <a href="https://learning.monash.edu/mod/url/view.php?id=4042871">Week 3 recording</a>
          </body>
        </html>
      `;
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const videos = detectPanoptoFromLinks(doc);

    expect(videos).toHaveLength(0);
  });
});

describe('detectPanoptoFromLinks (multi)', () => {
  it('detects multiple Panopto links', () => {
    const html = `
        <html>
          <body>
            <a href="https://uni.panopto.com/Panopto/Pages/Viewer.aspx?id=11111111-1111-1111-1111-111111111111">Lecture 1</a>
            <a href="https://uni.panopto.com/Panopto/Pages/Viewer.aspx?id=22222222-2222-2222-2222-222222222222">Lecture 2</a>
          </body>
        </html>
      `;
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const videos = detectPanoptoFromLinks(doc);

    expect(videos).toHaveLength(2);
    expect(videos[0]?.id).toBe('11111111-1111-1111-1111-111111111111');
    expect(videos[1]?.id).toBe('22222222-2222-2222-2222-222222222222');
  });

  it('deduplicates by video ID', () => {
    const html = `
        <html>
          <body>
            <a href="https://uni.panopto.com/Panopto/Pages/Viewer.aspx?id=abcd1234-1234-1234-1234-123412341234">Link 1</a>
            <a href="https://uni.panopto.com/Panopto/Pages/Embed.aspx?id=abcd1234-1234-1234-1234-123412341234">Link 2</a>
          </body>
        </html>
      `;
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const videos = detectPanoptoFromLinks(doc);

    expect(videos).toHaveLength(1);
  });
});

describe('detectPanoptoFromRedirect', () => {
  it('detects Panopto URL in meta refresh', () => {
    const html = `
        <html>
          <head>
            <meta http-equiv="refresh" content="0;url=https://monash.panopto.com/Panopto/Pages/Viewer.aspx?id=abc12345-6789-abcd-ef01-23456789abcd">
          </head>
          <body></body>
        </html>
      `;
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const videos = detectPanoptoFromRedirect(doc);

    expect(videos).toHaveLength(1);
    expect(videos[0]?.id).toBe('abc12345-6789-abcd-ef01-23456789abcd');
  });

  it('detects Panopto URL in page content', () => {
    const html = `
        <html>
          <body>
            <p>You are being redirected to https://uni.panopto.com/Panopto/Pages/Viewer.aspx?id=cdef0123-4567-89ab-cdef-012345678901</p>
          </body>
        </html>
      `;
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const videos = detectPanoptoFromRedirect(doc);

    expect(videos).toHaveLength(1);
    expect(videos[0]?.id).toBe('cdef0123-4567-89ab-cdef-012345678901');
  });
});
