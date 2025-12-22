/**
 * Video Detection Tests
 */

import { describe, it, expect } from 'vitest';
import {
  isEcho360Domain,
  isEcho360Url,
  extractEcho360Context,
  getEcho360PageType,
  extractPanoptoInfo,
  isPanoptoUrl,
  detectPanoptoVideosFromIframes,
  detectVideosSync,
  ECHO360_HOSTS,
} from '../videoDetection';

describe('Echo360 Detection', () => {
  describe('isEcho360Domain', () => {
    it('returns true for valid Echo360 domains', () => {
      expect(isEcho360Domain('echo360.net.au')).toBe(true);
      expect(isEcho360Domain('echo360.org.au')).toBe(true);
      expect(isEcho360Domain('echo360.org')).toBe(true);
      expect(isEcho360Domain('echo360.ca')).toBe(true);
      expect(isEcho360Domain('echo360.org.uk')).toBe(true);
      expect(isEcho360Domain('echo360qa.org')).toBe(true);
    });

    it('returns true for subdomains of Echo360 domains', () => {
      expect(isEcho360Domain('monash.echo360.net.au')).toBe(true);
      expect(isEcho360Domain('university.echo360.org')).toBe(true);
    });

    it('returns false for non-Echo360 domains', () => {
      expect(isEcho360Domain('echo360.com')).toBe(false);
      expect(isEcho360Domain('example.com')).toBe(false);
      expect(isEcho360Domain('notecho360.net.au')).toBe(false);
    });

    it('is case insensitive', () => {
      expect(isEcho360Domain('ECHO360.NET.AU')).toBe(true);
      expect(isEcho360Domain('Echo360.Org.Au')).toBe(true);
    });
  });

  describe('isEcho360Url', () => {
    it('returns true for Echo360 URLs', () => {
      expect(isEcho360Url('https://echo360.net.au/section/abc123/home')).toBe(
        true
      );
      expect(
        isEcho360Url('https://echo360.org.au/lesson/xyz789/classroom')
      ).toBe(true);
    });

    it('returns false for non-Echo360 URLs', () => {
      expect(isEcho360Url('https://example.com/page')).toBe(false);
      expect(isEcho360Url('https://panopto.com/embed')).toBe(false);
    });

    it('returns false for invalid URLs', () => {
      expect(isEcho360Url('not-a-url')).toBe(false);
      expect(isEcho360Url('')).toBe(false);
    });
  });

  describe('extractEcho360Context', () => {
    it('extracts context from section URL', () => {
      const context = extractEcho360Context(
        'https://echo360.net.au/section/d3e61b88-d8f7-4829-8e7f-a01d985392e0/home'
      );
      expect(context).toEqual({
        echoOrigin: 'https://echo360.net.au',
        sectionId: 'd3e61b88-d8f7-4829-8e7f-a01d985392e0',
        lessonId: undefined,
        mediaId: undefined,
      });
    });

    it('extracts context from lesson URL', () => {
      const context = extractEcho360Context(
        'https://echo360.net.au/lesson/abc12345-1234-5678-9abc-def012345678/classroom'
      );
      expect(context).toEqual({
        echoOrigin: 'https://echo360.net.au',
        sectionId: undefined,
        lessonId: 'abc12345-1234-5678-9abc-def012345678',
        mediaId: undefined,
      });
    });

    it('extracts complex lesson IDs', () => {
      const complexId =
        'G_6f71556b-833c-468e-9aba-89fbc66d6e6f_19bae95c-ee99-44c1-975d-c45f07ca3db7_2025-07-31T13:58:00.000_2025-07-31T15:53:00.000';
      const context = extractEcho360Context(
        `https://echo360.net.au/lesson/${encodeURIComponent(
          complexId
        )}/classroom`
      );
      expect(context?.lessonId).toBe(complexId);
    });

    it('extracts mediaId from query params', () => {
      const context = extractEcho360Context(
        'https://echo360.net.au/lesson/lesson123/classroom?mediaId=media456'
      );
      expect(context?.mediaId).toBe('media456');
    });

    it('extracts lessonId from query params as fallback', () => {
      const context = extractEcho360Context(
        'https://echo360.net.au/player?lessonId=lesson123'
      );
      expect(context?.lessonId).toBe('lesson123');
    });

    it('returns null for non-Echo360 URLs', () => {
      expect(extractEcho360Context('https://example.com/page')).toBe(null);
    });
  });

  describe('getEcho360PageType', () => {
    it('returns lesson for lesson pages', () => {
      const context = extractEcho360Context(
        'https://echo360.net.au/lesson/abc/classroom'
      );
      expect(getEcho360PageType(context)).toBe('lesson');
    });

    it('returns section for section pages', () => {
      const context = extractEcho360Context(
        'https://echo360.net.au/section/abc/home'
      );
      expect(getEcho360PageType(context)).toBe('section');
    });

    it('returns unknown for null context', () => {
      expect(getEcho360PageType(null)).toBe('unknown');
    });
  });
});

describe('Panopto Detection', () => {
  describe('extractPanoptoInfo', () => {
    it('extracts from embed URL', () => {
      const info = extractPanoptoInfo(
        'https://monash.au.panopto.com/Panopto/Pages/Embed.aspx?id=abc12345-1234-5678-9abc-def012345678'
      );
      expect(info).toEqual({
        deliveryId: 'abc12345-1234-5678-9abc-def012345678',
        tenant: 'monash.au.panopto.com',
      });
    });

    it('extracts from viewer URL', () => {
      const info = extractPanoptoInfo(
        'https://monash.au.panopto.com/Panopto/Pages/Viewer.aspx?id=abc12345-1234-5678-9abc-def012345678'
      );
      expect(info).toEqual({
        deliveryId: 'abc12345-1234-5678-9abc-def012345678',
        tenant: 'monash.au.panopto.com',
      });
    });

    it('returns null for non-Panopto URLs', () => {
      expect(extractPanoptoInfo('https://youtube.com/watch?v=abc')).toBeNull();
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

    it('returns false for non-Panopto URLs', () => {
      expect(isPanoptoUrl('https://youtube.com/watch?v=abc')).toBe(false);
    });
  });

  describe('detectPanoptoVideosFromIframes', () => {
    it('detects Panopto iframes', () => {
      const iframes = [
        {
          src: 'https://monash.au.panopto.com/Panopto/Pages/Embed.aspx?id=abc12345-1234-5678-9abc-def012345678',
          title: 'Week 1 Lecture',
        },
        {
          src: 'https://youtube.com/embed/xyz',
          title: 'YouTube',
        },
      ];

      const videos = detectPanoptoVideosFromIframes(iframes);

      expect(videos).toHaveLength(1);
      expect(videos[0]).toEqual({
        id: 'abc12345-1234-5678-9abc-def012345678',
        provider: 'panopto',
        title: 'Week 1 Lecture',
        embedUrl:
          'https://monash.au.panopto.com/Panopto/Pages/Embed.aspx?id=abc12345-1234-5678-9abc-def012345678',
      });
    });

    it('deduplicates videos by ID', () => {
      const iframes = [
        {
          src: 'https://monash.au.panopto.com/Panopto/Pages/Embed.aspx?id=abc123',
          title: 'Video 1',
        },
        {
          src: 'https://monash.au.panopto.com/Panopto/Pages/Embed.aspx?id=abc123',
          title: 'Video 1 again',
        },
      ];

      const videos = detectPanoptoVideosFromIframes(iframes);
      expect(videos).toHaveLength(1);
    });

    it('uses fallback title when none provided', () => {
      const iframes = [
        {
          src: 'https://monash.au.panopto.com/Panopto/Pages/Embed.aspx?id=abc123',
        },
      ];

      const videos = detectPanoptoVideosFromIframes(iframes);
      expect(videos[0].title).toBe('Panopto video 1');
    });
  });
});

describe('Unified Detection', () => {
  describe('detectVideosSync', () => {
    it('detects Panopto iframes', () => {
      const result = detectVideosSync({
        pageUrl: 'https://learning.monash.edu/course/123',
        iframes: [
          {
            src: 'https://monash.au.panopto.com/Panopto/Pages/Embed.aspx?id=abc123',
            title: 'Lecture',
          },
        ],
      });

      expect(result.provider).toBe('panopto');
      expect(result.videos).toHaveLength(1);
      expect(result.requiresApiCall).toBe(false);
    });

    it('returns requiresApiCall=true for Echo360 section pages', () => {
      const result = detectVideosSync({
        pageUrl:
          'https://echo360.net.au/section/d3e61b88-d8f7-4829-8e7f-a01d985392e0/home',
        iframes: [],
      });

      expect(result.provider).toBe('echo360');
      expect(result.videos).toHaveLength(0);
      expect(result.requiresApiCall).toBe(true);
      expect(result.echo360Context?.sectionId).toBe(
        'd3e61b88-d8f7-4829-8e7f-a01d985392e0'
      );
    });

    it('returns single video for Echo360 lesson pages', () => {
      const result = detectVideosSync({
        pageUrl: 'https://echo360.net.au/lesson/lesson123/classroom',
        iframes: [],
      });

      expect(result.provider).toBe('echo360');
      expect(result.videos).toHaveLength(1);
      expect(result.requiresApiCall).toBe(false);
      expect(result.videos[0].lessonId).toBe('lesson123');
    });

    it('returns empty for pages with no videos', () => {
      const result = detectVideosSync({
        pageUrl: 'https://example.com/page',
        iframes: [],
      });

      expect(result.provider).toBe(null);
      expect(result.videos).toHaveLength(0);
      expect(result.requiresApiCall).toBe(false);
    });

    it('prefers Echo360 detection over Panopto when on Echo360 page', () => {
      const result = detectVideosSync({
        pageUrl: 'https://echo360.net.au/lesson/abc/classroom',
        iframes: [
          {
            src: 'https://monash.au.panopto.com/Panopto/Pages/Embed.aspx?id=xyz',
          },
        ],
      });

      // Echo360 should win when we're on an Echo360 page
      expect(result.provider).toBe('echo360');
    });
  });
});

describe('ECHO360_HOSTS constant', () => {
  it('exports ECHO360_HOSTS', () => {
    expect(ECHO360_HOSTS).toBeInstanceOf(Array);
    expect(ECHO360_HOSTS.length).toBeGreaterThan(0);
    expect(ECHO360_HOSTS).toContain('echo360.net.au');
  });
});

