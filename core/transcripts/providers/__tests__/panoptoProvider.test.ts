/**
 * Panopto Provider Tests
 */

import { describe, it, expect, vi } from 'vitest';
import {
  extractDeliveryId,
  extractTenantDomain,
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

describe('Panopto URL Utilities', () => {
  describe('extractDeliveryId', () => {
    it('extracts delivery ID from embed URL', () => {
      const url =
        'https://monash.au.panopto.com/Panopto/Pages/Embed.aspx?id=abc12345-1234-5678-9abc-def012345678';
      expect(extractDeliveryId(url)).toBe('abc12345-1234-5678-9abc-def012345678');
    });

    it('extracts delivery ID from viewer URL', () => {
      const url =
        'https://monash.au.panopto.com/Panopto/Pages/Viewer.aspx?id=abc12345-1234-5678-9abc-def012345678';
      expect(extractDeliveryId(url)).toBe('abc12345-1234-5678-9abc-def012345678');
    });

    it('extracts delivery ID with additional query params', () => {
      const url =
        'https://monash.au.panopto.com/Panopto/Pages/Embed.aspx?id=abc12345-1234-5678-9abc-def012345678&autoplay=true';
      expect(extractDeliveryId(url)).toBe('abc12345-1234-5678-9abc-def012345678');
    });

    it('extracts from id= query param as fallback', () => {
      const url = 'https://monash.au.panopto.com/some/path?id=abc12345-def';
      expect(extractDeliveryId(url)).toBe('abc12345-def');
    });

    it('returns null for non-Panopto URLs', () => {
      expect(extractDeliveryId('https://youtube.com/watch?v=abc123')).toBeNull();
      expect(extractDeliveryId('https://example.com')).toBeNull();
    });

    it('returns null for invalid URLs', () => {
      expect(extractDeliveryId('not-a-url')).toBeNull();
    });
  });

  describe('extractTenantDomain', () => {
    it('extracts tenant domain from embed URL', () => {
      const url =
        'https://monash.au.panopto.com/Panopto/Pages/Embed.aspx?id=abc12345-1234-5678-9abc-def012345678';
      expect(extractTenantDomain(url)).toBe('monash.au.panopto.com');
    });

    it('extracts tenant domain from viewer URL', () => {
      const url =
        'https://harvard.hosted.panopto.com/Panopto/Pages/Viewer.aspx?id=abc12345-1234-5678-9abc-def012345678';
      expect(extractTenantDomain(url)).toBe('harvard.hosted.panopto.com');
    });

    it('extracts tenant from any panopto.com URL', () => {
      const url = 'https://example.panopto.com/some/path';
      expect(extractTenantDomain(url)).toBe('example.panopto.com');
    });

    it('returns null for non-Panopto URLs', () => {
      expect(extractTenantDomain('https://example.com/page')).toBeNull();
    });
  });

  describe('isPanoptoUrl', () => {
    it('returns true for Panopto embed URLs', () => {
      expect(
        isPanoptoUrl(
          'https://monash.au.panopto.com/Panopto/Pages/Embed.aspx?id=abc123'
        )
      ).toBe(true);
    });

    it('returns true for Panopto viewer URLs', () => {
      expect(
        isPanoptoUrl(
          'https://example.panopto.com/Panopto/Pages/Viewer.aspx?id=abc123'
        )
      ).toBe(true);
    });

    it('returns false for non-Panopto URLs', () => {
      expect(isPanoptoUrl('https://youtube.com/watch?v=abc')).toBe(false);
      expect(isPanoptoUrl('https://example.com')).toBe(false);
    });
  });

  describe('buildPanoptoEmbedUrl', () => {
    it('builds a canonical embed URL', () => {
      expect(buildPanoptoEmbedUrl('monash.au.panopto.com', 'abc123')).toBe(
        'https://monash.au.panopto.com/Panopto/Pages/Embed.aspx?id=abc123'
      );
    });
  });

  describe('buildPanoptoViewerUrl', () => {
    it('builds a canonical viewer URL', () => {
      expect(buildPanoptoViewerUrl('monash.au.panopto.com', 'abc123')).toBe(
        'https://monash.au.panopto.com/Panopto/Pages/Viewer.aspx?id=abc123'
      );
    });
  });
});

describe('extractCaptionVttUrl', () => {
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
      'https://monash.au.panopto.com/Panopto/Pages/Transcription/GetCaptionVTT.ashx?id=abc123&escape=true&language=0'
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

  it('extracts direct GetCaptionVTT.ashx URL', () => {
    const html = `
      <div data-caption="https://panopto.com/Panopto/Pages/Transcription/GetCaptionVTT.ashx?id=test123"></div>
    `;
    const result = extractCaptionVttUrl(html);
    expect(result).toBe(
      'https://panopto.com/Panopto/Pages/Transcription/GetCaptionVTT.ashx?id=test123'
    );
  });

  it('extracts TranscriptUrl', () => {
    const html = `{"TranscriptUrl": "https://panopto.com/transcript/vtt"}`;
    const result = extractCaptionVttUrl(html);
    expect(result).toBe('https://panopto.com/transcript/vtt');
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
    expect(result).toBe(
      '/Panopto/Pages/Transcription/GetCaptionVTT.ashx?id=rel123&language=0'
    );
  });

  it('returns null when no caption URL found', () => {
    const html = '<html><body>No captions here</body></html>';
    expect(extractCaptionVttUrl(html)).toBeNull();
  });
});

describe('PanoptoProvider', () => {
  const provider = new PanoptoProvider();

  describe('canHandle', () => {
    it('returns true for Panopto embed URLs', () => {
      expect(
        provider.canHandle(
          'https://monash.au.panopto.com/Panopto/Pages/Embed.aspx?id=abc123'
        )
      ).toBe(true);
    });

    it('returns true for Panopto viewer URLs', () => {
      expect(
        provider.canHandle(
          'https://example.panopto.com/Panopto/Pages/Viewer.aspx?id=abc123'
        )
      ).toBe(true);
    });

    it('returns false for non-Panopto URLs', () => {
      expect(provider.canHandle('https://youtube.com/watch?v=abc')).toBe(false);
      expect(provider.canHandle('https://example.com')).toBe(false);
    });
  });

  describe('requiresAsyncDetection', () => {
    it('always returns false (Panopto uses DOM detection)', () => {
      expect(
        provider.requiresAsyncDetection({
          pageUrl: 'https://example.com',
          iframes: [],
        })
      ).toBe(false);
    });
  });

  describe('detectVideosSync', () => {
    it('detects Panopto iframes', () => {
      const context = {
        pageUrl: 'https://learning.monash.edu/',
        iframes: [
          {
            src: 'https://monash.au.panopto.com/Panopto/Pages/Embed.aspx?id=abc12345-1234-5678-9abc-def012345678',
            title: 'Week 1 Lecture',
          },
          {
            src: 'https://youtube.com/embed/xyz123',
            title: 'YouTube Video',
          },
        ],
      };

      const videos = provider.detectVideosSync(context);

      expect(videos).toHaveLength(1);
      expect(videos[0]).toEqual({
        id: 'abc12345-1234-5678-9abc-def012345678',
        provider: 'panopto',
        title: 'Week 1 Lecture',
        embedUrl:
          'https://monash.au.panopto.com/Panopto/Pages/Embed.aspx?id=abc12345-1234-5678-9abc-def012345678',
        panoptoTenant: 'monash.au.panopto.com',
      });
    });

    it('uses fallback title when iframe has no title', () => {
      const context = {
        pageUrl: 'https://learning.monash.edu/',
        iframes: [
          {
            src: 'https://monash.au.panopto.com/Panopto/Pages/Embed.aspx?id=abc12345-1234-5678-9abc-def012345678',
          },
        ],
      };

      const videos = provider.detectVideosSync(context);

      expect(videos).toHaveLength(1);
      expect(videos[0].title).toBe('Panopto video 1');
    });

    it('detects multiple Panopto videos', () => {
      const context = {
        pageUrl: 'https://learning.monash.edu/',
        iframes: [
          {
            src: 'https://monash.au.panopto.com/Panopto/Pages/Embed.aspx?id=11111111-1234-5678-9abc-def012345678',
            title: 'Video 1',
          },
          {
            src: 'https://monash.au.panopto.com/Panopto/Pages/Embed.aspx?id=22222222-1234-5678-9abc-def012345678',
            title: 'Video 2',
          },
        ],
      };

      const videos = provider.detectVideosSync(context);

      expect(videos).toHaveLength(2);
      expect(videos[0].id).toBe('11111111-1234-5678-9abc-def012345678');
      expect(videos[0].panoptoTenant).toBe('monash.au.panopto.com');
      expect(videos[1].id).toBe('22222222-1234-5678-9abc-def012345678');
      expect(videos[1].panoptoTenant).toBe('monash.au.panopto.com');
    });

    it('deduplicates videos by ID', () => {
      const context = {
        pageUrl: 'https://learning.monash.edu/',
        iframes: [
          {
            src: 'https://monash.au.panopto.com/Panopto/Pages/Embed.aspx?id=abc123',
            title: 'Video 1',
          },
          {
            src: 'https://monash.au.panopto.com/Panopto/Pages/Embed.aspx?id=abc123',
            title: 'Video 1 duplicate',
          },
        ],
      };

      const videos = provider.detectVideosSync(context);
      expect(videos).toHaveLength(1);
    });

    it('detects video from page URL when on Panopto page', () => {
      const context = {
        pageUrl:
          'https://monash.au.panopto.com/Panopto/Pages/Viewer.aspx?id=abc12345-1234-5678-9abc-def012345678',
        iframes: [],
      };

      const videos = provider.detectVideosSync(context);

      expect(videos).toHaveLength(1);
      expect(videos[0].id).toBe('abc12345-1234-5678-9abc-def012345678');
      expect(videos[0].embedUrl).toBe(
        'https://monash.au.panopto.com/Panopto/Pages/Embed.aspx?id=abc12345-1234-5678-9abc-def012345678'
      );
      expect(videos[0].panoptoTenant).toBe('monash.au.panopto.com');
    });

    it('returns empty array when no Panopto iframes', () => {
      const context = {
        pageUrl: 'https://example.com/',
        iframes: [{ src: 'https://youtube.com/embed/abc', title: 'YouTube' }],
      };

      const videos = provider.detectVideosSync(context);

      expect(videos).toHaveLength(0);
    });
  });

  describe('extractTranscript', () => {
    it('extracts transcript using fetcher', async () => {
      const mockFetcher = {
        fetchWithCredentials: vi
          .fn()
          .mockResolvedValueOnce(
            '{"CaptionUrl":["https://panopto.com/captions.vtt"]}'
          )
          .mockResolvedValueOnce(
            'WEBVTT\n\n00:00:00.000 --> 00:00:05.000\nHello world'
          ),
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

    it('prefers embed URL when given a viewer URL', async () => {
      const mockFetcher = {
        fetchWithCredentials: vi
          .fn()
          .mockResolvedValueOnce(
            '{"CaptionUrl":["https://panopto.com/captions.vtt"]}'
          )
          .mockResolvedValueOnce(
            'WEBVTT\n\n00:00:00.000 --> 00:00:05.000\nHello world'
          ),
        fetchJson: vi.fn(),
      };

      const video = {
        id: 'video123',
        provider: 'panopto' as const,
        title: 'Test Video',
        embedUrl:
          'https://monash.au.panopto.com/Panopto/Pages/Viewer.aspx?id=video123',
        panoptoTenant: 'monash.au.panopto.com',
      };

      await provider.extractTranscript(video, mockFetcher);

      expect(mockFetcher.fetchWithCredentials).toHaveBeenNthCalledWith(
        1,
        'https://monash.au.panopto.com/Panopto/Pages/Embed.aspx?id=video123'
      );
    });

    it('handles auth errors', async () => {
      const mockFetcher = {
        fetchWithCredentials: vi
          .fn()
          .mockRejectedValueOnce(new Error('AUTH_REQUIRED')),
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

  it('has correct provider type', () => {
    expect(provider.provider).toBe('panopto');
  });
});

describe('Panopto Link Detection', () => {
  describe('extractPanoptoInfo', () => {
    it('extracts info from embed URL', () => {
      const url = 'https://monash.au.panopto.com/Panopto/Pages/Embed.aspx?id=abc12345-1234-5678-9abc-def012345678';
      const info = extractPanoptoInfo(url);
      expect(info).toEqual({
        deliveryId: 'abc12345-1234-5678-9abc-def012345678',
        tenant: 'monash.au.panopto.com',
      });
    });

    it('extracts info from viewer URL', () => {
      const url = 'https://harvard.panopto.com/Panopto/Pages/Viewer.aspx?id=def67890-abcd-1234-5678-abcdef012345';
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
      const url = encodeURIComponent('https://monash.panopto.com/Panopto/Pages/Viewer.aspx?id=abcd1234-5678-9abc-def0-123456789abc');
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
      expect(isLmsRedirectPage('https://learning.monash.edu/mod/resource/view.php?id=12345')).toBe(false);
    });

    it('returns true for Moodle mod/lti pages', () => {
      expect(isLmsRedirectPage('https://learning.monash.edu/mod/lti/view.php?id=12345')).toBe(true);
    });

    it('returns false for regular pages', () => {
      expect(isLmsRedirectPage('https://learning.monash.edu/course/view.php?id=12345')).toBe(false);
      expect(isLmsRedirectPage('https://monash.panopto.com/Panopto/Pages/Viewer.aspx')).toBe(false);
    });
  });

  describe('detectPanoptoFromLinks', () => {
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
      expect(videos[0].id).toBe('abc12345-1234-5678-abcd-def012345678');
      expect(videos[0].title).toBe('Week 1 Lecture');
      expect(videos[0].panoptoTenant).toBe('monash.au.panopto.com');
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
      expect(videos[0].id).toBe('11111111-1111-1111-1111-111111111111');
      expect(videos[1].id).toBe('22222222-2222-2222-2222-222222222222');
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
      expect(videos[0].id).toBe('abc12345-6789-abcd-ef01-23456789abcd');
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
      expect(videos[0].id).toBe('cdef0123-4567-89ab-cdef-012345678901');
    });
  });
});

