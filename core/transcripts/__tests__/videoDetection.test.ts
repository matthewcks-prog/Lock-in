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
      expect(videos[0].embedUrl).toBe(
        'https://monash.au.panopto.com/Panopto/Pages/Embed.aspx?id=abc123'
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
      expect(result.videos[0].provider).toBe('html5');
      expect(result.videos[0].title).toBe('Week 2 Lecture');
      expect(result.videos[0].mediaUrl).toBe('https://cdn.example.com/lecture.mp4');
      expect(result.videos[0].domId).toBe('lecture-video');
      expect(result.videos[0].trackUrls).toEqual([
        {
          kind: 'captions',
          label: 'English',
          srclang: 'en',
          src: 'https://cdn.example.com/lecture.vtt',
        },
      ]);
    });
  });
});

