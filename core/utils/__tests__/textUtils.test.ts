/**
 * Unit tests for textUtils
 *
 * Tests pure utility functions for text manipulation.
 */

import { describe, it, expect } from 'vitest';
import {
  escapeHtml,
  extractCourseCodeFromText,
  formatTimestamp,
  buildFallbackChatTitle,
} from '../textUtils';

describe('textUtils', () => {
  describe('escapeHtml', () => {
    it('should escape HTML special characters', () => {
      expect(escapeHtml("<script>alert('xss')</script>")).toContain('&lt;script&gt;');
      expect(escapeHtml("<script>alert('xss')</script>")).toContain('&lt;/script&gt;');
      expect(escapeHtml('Hello & World')).toBe('Hello &amp; World');
      expect(escapeHtml('Quote "test"')).toBe('Quote &quot;test&quot;');
      expect(escapeHtml("Quote 'test'")).toBe('Quote &#39;test&#39;');
    });

    it('should return empty string for non-string input', () => {
      expect(escapeHtml(null as unknown as string)).toBe('');
      expect(escapeHtml(undefined as unknown as string)).toBe('');
      expect(escapeHtml(123 as unknown as string)).toBe('');
    });

    it('should handle normal text without escaping', () => {
      expect(escapeHtml('Hello World')).toBe('Hello World');
      expect(escapeHtml('FIT1045')).toBe('FIT1045');
    });
  });

  describe('extractCourseCodeFromText', () => {
    it('should extract valid course codes', () => {
      expect(extractCourseCodeFromText('FIT1045')).toBe('FIT1045');
      expect(extractCourseCodeFromText('MAT1830')).toBe('MAT1830');
      expect(extractCourseCodeFromText('Course FIT1045 is great')).toBe('FIT1045');
      expect(extractCourseCodeFromText('FIT1045 and MAT1830')).toBe('FIT1045');
    });

    it('should handle case-insensitive matching', () => {
      expect(extractCourseCodeFromText('fit1045')).toBe('FIT1045');
      expect(extractCourseCodeFromText('Mat1830')).toBe('MAT1830');
    });

    it('should return null for invalid input', () => {
      expect(extractCourseCodeFromText('')).toBe(null);
      expect(extractCourseCodeFromText(null as unknown as string)).toBe(null);
      expect(extractCourseCodeFromText(undefined as unknown as string)).toBe(null);
    });

    it('should return null when no course code found', () => {
      expect(extractCourseCodeFromText('Hello World')).toBe(null);
      expect(extractCourseCodeFromText('FIT104')).toBe(null); // Too short
      expect(extractCourseCodeFromText('FIT10456')).toBe(null); // Too long
    });
  });

  describe('formatTimestamp', () => {
    it("should return 'Just now' for null/undefined", () => {
      expect(formatTimestamp(null)).toBe('Just now');
      expect(formatTimestamp(undefined)).toBe('Just now');
    });

    it("should return 'Just now' for very recent timestamps", () => {
      const now = new Date().toISOString();
      expect(formatTimestamp(now)).toBe('Just now');
    });

    it('should format minutes ago correctly', () => {
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
      expect(formatTimestamp(twoMinutesAgo)).toBe('2 min ago');
    });

    it('should format hours ago correctly', () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      expect(formatTimestamp(twoHoursAgo)).toBe('2 hrs ago');
    });

    it('should format single hour correctly', () => {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      expect(formatTimestamp(oneHourAgo)).toBe('1 hr ago');
    });

    it('should return date string for old timestamps', () => {
      const oldDate = new Date('2020-01-01').toISOString();
      const result = formatTimestamp(oldDate);
      expect(result).toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/); // Date format
    });

    it('should return empty string for invalid dates', () => {
      expect(formatTimestamp('invalid-date')).toBe('');
    });
  });

  describe('buildFallbackChatTitle', () => {
    it("should return 'Untitled chat' for null/undefined", () => {
      expect(buildFallbackChatTitle(null)).toBe('Untitled chat');
      expect(buildFallbackChatTitle(undefined)).toBe('Untitled chat');
    });

    it('should build title from valid timestamp', () => {
      const timestamp = '2024-12-14T10:30:00.000Z';
      expect(buildFallbackChatTitle(timestamp)).toBe('Chat from 2024-12-14');
    });

    it("should return 'Untitled chat' for invalid dates", () => {
      expect(buildFallbackChatTitle('invalid-date')).toBe('Untitled chat');
    });
  });
});
