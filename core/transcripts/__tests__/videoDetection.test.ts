/**
 * Video Detection Tests
 */

import { describe, it, expect } from 'vitest';
import {
  extractPanoptoInfo,
  isPanoptoUrl,
  detectPanoptoVideosFromIframes,
  detectVideosSync,
} from '../videoDetection';

describe('Panopto Detection', () => {
  describe('extractPanoptoInfo', () => {
    it('extracts from embed URL', () => {
      const info = extractPanoptoInfo(
        'https://monash.au.panopto.com/Panopto/Pages/Embed.aspx?id=abc12345-1234-5678-9abc-def012345678',
      );
      expect(info).toEqual({
        deliveryId: 'abc12345-1234-5678-9abc-def012345678',
        tenant: 'monash.au.panopto.com',
      });
    });

    it('extracts from viewer URL', () => {
      const info = extractPanoptoInfo(
        'https://monash.au.panopto.com/Panopto/Pages/Viewer.aspx?id=abc12345-1234-5678-9abc-def012345678',
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
      expect(isPanoptoUrl('https://monash.au.panopto.com/Panopto/Pages/Embed.aspx?id=abc123')).toBe(
        true,
      );
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
      const [firstVideo] = videos;
      expect(firstVideo).toBeDefined();
      expect(firstVideo).toEqual({
        id: 'abc12345-1234-5678-9abc-def012345678',
        provider: 'panopto',
        title: 'Week 1 Lecture',
        embedUrl:
          'https://monash.au.panopto.com/Panopto/Pages/Embed.aspx?id=abc12345-1234-5678-9abc-def012345678',
        panoptoTenant: 'monash.au.panopto.com',
      });
    });

    it('normalizes viewer URLs to embed URLs', () => {
      const iframes = [
        {
          src: 'https://monash.au.panopto.com/Panopto/Pages/Viewer.aspx?id=abc123',
          title: 'Lecture',
        },
      ];

      const videos = detectPanoptoVideosFromIframes(iframes);

      expect(videos).toHaveLength(1);
      const [firstVideo] = videos;
      expect(firstVideo).toBeDefined();
      expect(firstVideo?.embedUrl).toBe(
        'https://monash.au.panopto.com/Panopto/Pages/Embed.aspx?id=abc123',
      );
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
      const [firstVideo] = videos;
      expect(firstVideo).toBeDefined();
      expect(firstVideo?.title).toBe('Panopto video 1');
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

    it('returns empty for pages with no videos', () => {
      const result = detectVideosSync({
        pageUrl: 'https://example.com/page',
        iframes: [],
      });

      expect(result.provider).toBe(null);
      expect(result.videos).toHaveLength(0);
      expect(result.requiresApiCall).toBe(false);
    });

    it('detects HTML5 videos in the document', () => {
      const doc = document.implementation.createHTMLDocument('test');
      doc.body.innerHTML = `
        <video id="lecture-video" title="Week 2 Lecture">
          <source src="https://cdn.example.com/lecture.mp4" type="video/mp4" />
          <track kind="captions" srclang="en" label="English" src="https://cdn.example.com/lecture.vtt" />
        </video>
      `;

      const result = detectVideosSync({
        pageUrl: 'https://example.com/course',
        iframes: [],
        document: doc,
      });

      expect(result.provider).toBe('html5');
      expect(result.videos).toHaveLength(1);
      const [firstVideo] = result.videos;
      expect(firstVideo).toBeDefined();
      expect(firstVideo?.provider).toBe('html5');
      expect(firstVideo?.title).toBe('Week 2 Lecture');
      expect(firstVideo?.mediaUrl).toBe('https://cdn.example.com/lecture.mp4');
      expect(firstVideo?.domId).toBe('lecture-video');
      expect(firstVideo?.trackUrls).toEqual([
        {
          kind: 'captions',
          label: 'English',
          srclang: 'en',
          src: 'https://cdn.example.com/lecture.vtt',
        },
      ]);
    });

    it('detects Echo360 iframes', () => {
      const result = detectVideosSync({
        pageUrl: 'https://learning.monash.edu/course/123',
        iframes: [
          {
            src: 'https://echo360.net.au/lesson/11111111-2222-3333-4444-555555555555/media/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
            title: 'Echo360 Lecture',
          },
        ],
      });

      expect(result.provider).toBe('echo360');
      expect(result.videos).toHaveLength(1);
      const [firstVideo] = result.videos;
      expect(firstVideo).toBeDefined();
      expect(firstVideo?.provider).toBe('echo360');
      expect(firstVideo?.echoLessonId).toBe('11111111-2222-3333-4444-555555555555');
      expect(firstVideo?.echoMediaId).toBe('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
    });

    it('ignores hidden HTML5 videos', () => {
      const doc = document.implementation.createHTMLDocument('test');
      doc.body.innerHTML = `
        <video id="visible-video">
          <source src="https://cdn.example.com/visible.mp4" type="video/mp4" />
        </video>
        <video id="hidden-video" style="display: none;">
          <source src="https://cdn.example.com/hidden.mp4" type="video/mp4" />
        </video>
        <video id="aria-hidden-video" aria-hidden="true">
          <source src="https://cdn.example.com/hidden2.mp4" type="video/mp4" />
        </video>
      `;

      const result = detectVideosSync({
        pageUrl: 'https://example.com/course',
        iframes: [],
        document: doc,
      });

      expect(result.provider).toBe('html5');
      expect(result.videos).toHaveLength(1);
      const [firstVideo] = result.videos;
      expect(firstVideo).toBeDefined();
      expect(firstVideo?.domId).toBe('visible-video');
    });
  });
});
