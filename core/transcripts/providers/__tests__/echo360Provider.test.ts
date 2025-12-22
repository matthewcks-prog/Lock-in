/**
 * Echo360 Provider Tests
 */

import { describe, it, expect } from 'vitest';
import {
  isEcho360Domain,
  extractSectionId,
  extractLessonId,
  extractEcho360Context,
  getEcho360PageType,
  parseEcho360Syllabus,
  parseEcho360Transcript,
  Echo360Provider,
  ECHO360_HOSTS,
} from '../echo360Provider';

describe('Echo360 URL Utilities', () => {
  describe('isEcho360Domain', () => {
    it('returns true for valid Echo360 domains', () => {
      expect(isEcho360Domain('echo360.net.au')).toBe(true);
      expect(isEcho360Domain('echo360.org.au')).toBe(true);
      expect(isEcho360Domain('echo360.org')).toBe(true);
      expect(isEcho360Domain('echo360.ca')).toBe(true);
      expect(isEcho360Domain('echo360.org.uk')).toBe(true);
      expect(isEcho360Domain('echo360qa.org')).toBe(true);
      expect(isEcho360Domain('echo360qa.dev')).toBe(true);
    });

    it('returns true for subdomains', () => {
      expect(isEcho360Domain('monash.echo360.net.au')).toBe(true);
      expect(isEcho360Domain('app.echo360.org')).toBe(true);
    });

    it('returns false for non-Echo360 domains', () => {
      expect(isEcho360Domain('echo360.com')).toBe(false);
      expect(isEcho360Domain('example.com')).toBe(false);
    });

    it('is case insensitive', () => {
      expect(isEcho360Domain('ECHO360.NET.AU')).toBe(true);
    });
  });

  describe('extractSectionId', () => {
    it('extracts section ID from URL', () => {
      expect(
        extractSectionId(
          'https://echo360.net.au/section/d3e61b88-d8f7-4829-8e7f-a01d985392e0/home'
        )
      ).toBe('d3e61b88-d8f7-4829-8e7f-a01d985392e0');
    });

    it('returns null when no section ID', () => {
      expect(
        extractSectionId('https://echo360.net.au/lesson/abc/classroom')
      ).toBe(null);
    });
  });

  describe('extractLessonId', () => {
    it('extracts simple lesson ID', () => {
      expect(
        extractLessonId('https://echo360.net.au/lesson/abc123/classroom')
      ).toBe('abc123');
    });

    it('extracts complex compound lesson ID', () => {
      const complexId =
        'G_6f71556b-833c-468e-9aba-89fbc66d6e6f_19bae95c-ee99-44c1-975d-c45f07ca3db7_2025-07-31T13:58:00.000_2025-07-31T15:53:00.000';
      expect(
        extractLessonId(
          `https://echo360.net.au/lesson/${encodeURIComponent(
            complexId
          )}/classroom`
        )
      ).toBe(complexId);
    });

    it('returns null when no lesson ID', () => {
      expect(extractLessonId('https://echo360.net.au/section/abc/home')).toBe(
        null
      );
    });
  });

  describe('extractEcho360Context', () => {
    it('extracts full context from section URL', () => {
      const context = extractEcho360Context(
        'https://echo360.net.au/section/abc123/home'
      );
      expect(context).toEqual({
        echoOrigin: 'https://echo360.net.au',
        sectionId: 'abc123',
        lessonId: undefined,
        mediaId: undefined,
      });
    });

    it('extracts full context from lesson URL', () => {
      const context = extractEcho360Context(
        'https://echo360.net.au/lesson/lesson123/classroom'
      );
      expect(context).toEqual({
        echoOrigin: 'https://echo360.net.au',
        sectionId: undefined,
        lessonId: 'lesson123',
        mediaId: undefined,
      });
    });

    it('extracts mediaId from query params', () => {
      const context = extractEcho360Context(
        'https://echo360.net.au/lesson/abc/classroom?mediaId=media456'
      );
      expect(context?.mediaId).toBe('media456');
    });

    it('extracts IDs from query params as fallback', () => {
      const context = extractEcho360Context(
        'https://echo360.net.au/player?lessonId=lesson123&sectionId=section456'
      );
      expect(context?.lessonId).toBe('lesson123');
      expect(context?.sectionId).toBe('section456');
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

    it('returns unknown when neither lesson nor section', () => {
      expect(getEcho360PageType({ echoOrigin: 'https://echo360.net.au' })).toBe(
        'unknown'
      );
    });
  });
});

describe('parseEcho360Syllabus', () => {
  const echoOrigin = 'https://echo360.net.au';
  const sectionId = 'section123';

  it('parses syllabus with SyllabusLessonType items', () => {
    const data = {
      data: [
        {
          type: 'SyllabusLessonType',
          lesson: {
            lesson: {
              id: 'lesson1',
              name: 'Week 1 Lecture',
            },
            medias: [
              {
                id: 'media1',
                durationMs: 3600000,
                thumbnailUri: 'https://example.com/thumb.jpg',
              },
            ],
          },
        },
      ],
    };

    const videos = parseEcho360Syllabus(data, echoOrigin, sectionId);

    expect(videos).toHaveLength(1);
    expect(videos[0]).toEqual({
      id: 'lesson1_media1',
      provider: 'echo360',
      title: 'Week 1 Lecture',
      embedUrl: 'https://echo360.net.au/lesson/lesson1/classroom',
      echoOrigin,
      sectionId,
      lessonId: 'lesson1',
      mediaId: 'media1',
      durationMs: 3600000,
      thumbnailUrl: 'https://example.com/thumb.jpg',
      recordedAt: undefined,
    });
  });

  it('handles direct array format', () => {
    const data = [
      {
        type: 'SyllabusLessonType',
        lesson: {
          lesson: {
            id: 'lesson1',
            name: 'Direct Array Lesson',
          },
          medias: [{ id: 'media1' }],
        },
      },
    ];

    const videos = parseEcho360Syllabus(data, echoOrigin, sectionId);
    expect(videos).toHaveLength(1);
    expect(videos[0].title).toBe('Direct Array Lesson');
  });

  it('skips non-lesson items', () => {
    const data = {
      data: [
        {
          type: 'SyllabusModuleType',
          name: 'Module 1',
        },
        {
          type: 'SyllabusLessonType',
          lesson: {
            lesson: { id: 'lesson1', name: 'Lesson' },
            medias: [{ id: 'media1' }],
          },
        },
      ],
    };

    const videos = parseEcho360Syllabus(data, echoOrigin, sectionId);
    expect(videos).toHaveLength(1);
  });

  it('skips unavailable media', () => {
    const data = {
      data: [
        {
          type: 'SyllabusLessonType',
          lesson: {
            lesson: { id: 'lesson1', name: 'Lesson' },
            medias: [
              { id: 'media1', isAvailable: true },
              { id: 'media2', isAvailable: false },
            ],
          },
        },
      ],
    };

    const videos = parseEcho360Syllabus(data, echoOrigin, sectionId);
    expect(videos).toHaveLength(1);
    expect(videos[0].mediaId).toBe('media1');
  });

  it('handles lessons without medias array but with hasVideo', () => {
    const data = {
      data: [
        {
          type: 'SyllabusLessonType',
          lesson: {
            lesson: { id: 'lesson1', name: 'No Media Array' },
            hasVideo: true,
          },
        },
      ],
    };

    const videos = parseEcho360Syllabus(data, echoOrigin, sectionId);
    expect(videos).toHaveLength(1);
    expect(videos[0].lessonId).toBe('lesson1');
    expect(videos[0].mediaId).toBeUndefined();
  });

  it('extracts recording date from timing', () => {
    const data = {
      data: [
        {
          type: 'SyllabusLessonType',
          lesson: {
            lesson: {
              id: 'lesson1',
              name: 'Lesson',
              timing: { start: '2024-03-15T10:00:00Z' },
            },
            medias: [{ id: 'media1' }],
          },
        },
      ],
    };

    const videos = parseEcho360Syllabus(data, echoOrigin, sectionId);
    expect(videos[0].recordedAt).toBe('2024-03-15T10:00:00Z');
  });

  it('uses displayName as fallback for title', () => {
    const data = {
      data: [
        {
          type: 'SyllabusLessonType',
          lesson: {
            lesson: { id: 'lesson1', displayName: 'Display Name Title' },
            medias: [{ id: 'media1' }],
          },
        },
      ],
    };

    const videos = parseEcho360Syllabus(data, echoOrigin, sectionId);
    expect(videos[0].title).toBe('Display Name Title');
  });

  it('returns empty array for empty data', () => {
    expect(parseEcho360Syllabus({}, echoOrigin, sectionId)).toHaveLength(0);
    expect(parseEcho360Syllabus({ data: [] }, echoOrigin, sectionId)).toHaveLength(0);
    expect(parseEcho360Syllabus([], echoOrigin, sectionId)).toHaveLength(0);
  });
});

describe('parseEcho360Transcript', () => {
  it('parses transcript with contentJSON.cues', () => {
    const data = {
      data: {
        contentJSON: {
          cues: [
            { startMs: 0, endMs: 5000, content: 'Hello world' },
            { startMs: 5000, endMs: 10000, content: 'This is a test' },
          ],
        },
      },
    };

    const result = parseEcho360Transcript(data);

    expect(result).not.toBe(null);
    expect(result?.segments).toHaveLength(2);
    expect(result?.segments[0]).toEqual({
      startMs: 0,
      endMs: 5000,
      text: 'Hello world',
      speaker: undefined,
    });
    expect(result?.plainText).toBe('Hello world This is a test');
    expect(result?.durationMs).toBe(10000);
  });

  it('handles direct contentJSON format', () => {
    const data = {
      contentJSON: {
        cues: [{ startMs: 0, endMs: 5000, content: 'Direct format' }],
      },
    };

    const result = parseEcho360Transcript(data);
    expect(result?.segments).toHaveLength(1);
  });

  it('handles direct cues array', () => {
    const data = {
      cues: [{ startMs: 0, endMs: 5000, content: 'Direct cues' }],
    };

    const result = parseEcho360Transcript(data);
    expect(result?.segments).toHaveLength(1);
  });

  it('handles cues with text property instead of content', () => {
    const data = {
      cues: [{ startMs: 0, endMs: 5000, text: 'Using text property' }],
    };

    const result = parseEcho360Transcript(data);
    expect(result?.segments[0].text).toBe('Using text property');
  });

  it('handles cues with start/end instead of startMs/endMs', () => {
    const data = {
      cues: [{ start: 0, end: 5000, content: 'Alt timing format' }],
    };

    const result = parseEcho360Transcript(data);
    expect(result?.segments[0].startMs).toBe(0);
    expect(result?.segments[0].endMs).toBe(5000);
  });

  it('includes speaker when present', () => {
    const data = {
      cues: [
        { startMs: 0, endMs: 5000, content: 'Hello', speaker: 'Dr. Smith' },
      ],
    };

    const result = parseEcho360Transcript(data);
    expect(result?.segments[0].speaker).toBe('Dr. Smith');
  });

  it('skips empty cues', () => {
    const data = {
      cues: [
        { startMs: 0, endMs: 5000, content: 'Valid' },
        { startMs: 5000, endMs: 10000, content: '' },
        { startMs: 10000, endMs: 15000, content: '  ' },
        { startMs: 15000, endMs: 20000, content: 'Also valid' },
      ],
    };

    const result = parseEcho360Transcript(data);
    expect(result?.segments).toHaveLength(2);
    expect(result?.plainText).toBe('Valid Also valid');
  });

  it('returns null for empty cues', () => {
    expect(parseEcho360Transcript({ cues: [] })).toBe(null);
    expect(parseEcho360Transcript({})).toBe(null);
    expect(parseEcho360Transcript({ data: {} })).toBe(null);
  });
});

describe('Echo360Provider', () => {
  const provider = new Echo360Provider();

  describe('canHandle', () => {
    it('returns true for Echo360 URLs', () => {
      expect(provider.canHandle('https://echo360.net.au/section/abc/home')).toBe(
        true
      );
      expect(
        provider.canHandle('https://echo360.org.au/lesson/xyz/classroom')
      ).toBe(true);
    });

    it('returns false for non-Echo360 URLs', () => {
      expect(provider.canHandle('https://example.com/page')).toBe(false);
      expect(provider.canHandle('https://panopto.com/embed')).toBe(false);
    });
  });

  describe('requiresAsyncDetection', () => {
    it('returns true for section pages', () => {
      expect(
        provider.requiresAsyncDetection({
          pageUrl: 'https://echo360.net.au/section/abc/home',
          iframes: [],
        })
      ).toBe(true);
    });

    it('returns false for lesson pages', () => {
      expect(
        provider.requiresAsyncDetection({
          pageUrl: 'https://echo360.net.au/lesson/abc/classroom',
          iframes: [],
        })
      ).toBe(false);
    });
  });

  describe('detectVideosSync', () => {
    it('returns single video for lesson pages', () => {
      const videos = provider.detectVideosSync({
        pageUrl: 'https://echo360.net.au/lesson/lesson123/classroom',
        iframes: [],
      });

      expect(videos).toHaveLength(1);
      expect(videos[0].lessonId).toBe('lesson123');
      expect(videos[0].provider).toBe('echo360');
    });

    it('returns empty array for section pages', () => {
      const videos = provider.detectVideosSync({
        pageUrl: 'https://echo360.net.au/section/abc/home',
        iframes: [],
      });

      expect(videos).toHaveLength(0);
    });
  });

  it('has correct provider type', () => {
    expect(provider.provider).toBe('echo360');
  });
});

describe('ECHO360_HOSTS', () => {
  it('exports ECHO360_HOSTS array', () => {
    expect(ECHO360_HOSTS).toBeInstanceOf(Array);
    expect(ECHO360_HOSTS.length).toBeGreaterThan(0);
    expect(ECHO360_HOSTS).toContain('echo360.net.au');
    expect(ECHO360_HOSTS).toContain('echo360.org.au');
  });
});

