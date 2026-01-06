/**
 * Echo360 Provider Tests
 */

import { describe, it, expect, vi } from 'vitest';
import echoTranscriptFixture from './fixtures/echo360Transcript.json';
import {
  Echo360Provider,
  detectEcho360Videos,
  extractEcho360Info,
  extractSectionId,
  isEcho360SectionPage,
  normalizeEcho360TranscriptJson,
} from '../echo360Provider';

describe('Echo360 URL utilities', () => {
  it('extracts lesson and media IDs from Echo360 URL', () => {
    const url =
      'https://echo360.net.au/lesson/11111111-2222-3333-4444-555555555555/media/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    const info = extractEcho360Info(url);
    expect(info).toEqual({
      lessonId: '11111111-2222-3333-4444-555555555555',
      mediaId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      baseUrl: 'https://echo360.net.au',
    });
  });

  it('extracts IDs from encoded LTI URLs', () => {
    const echoUrl =
      'https://echo360.net.au/lesson/99999999-8888-7777-6666-555555555555/media/ffffffff-eeee-dddd-cccc-bbbbbbbbbbbb';
    const ltiUrl = `https://learning.monash.edu/mod/lti/launch.php?url=${encodeURIComponent(
      echoUrl
    )}`;
    const info = extractEcho360Info(ltiUrl);
    expect(info?.lessonId).toBe('99999999-8888-7777-6666-555555555555');
    expect(info?.mediaId).toBe('ffffffff-eeee-dddd-cccc-bbbbbbbbbbbb');
    expect(info?.baseUrl).toBe('https://echo360.net.au');
  });
});

describe('normalizeEcho360TranscriptJson', () => {
  it('normalizes cues from JSON payload', () => {
    const transcript = normalizeEcho360TranscriptJson(echoTranscriptFixture);
    expect(transcript).not.toBeNull();
    expect(transcript?.segments).toHaveLength(2);
    expect(transcript?.segments[0]).toMatchObject({
      startMs: 1000,
      endMs: 2000,
      text: 'Hello world',
      speaker: 'Speaker',
      confidence: 0.92,
    });
    expect(transcript?.segments[1]).toMatchObject({
      startMs: 2100,
      endMs: 3200,
      text: 'Second cue',
      speaker: 'Dr. Smith',
      confidence: 0.75,
    });
    expect(transcript?.plainText).toBe('Hello world Second cue');
  });
});

describe('detectEcho360Videos', () => {
  it('skips section listing pages without lesson/media IDs', () => {
    const videos = detectEcho360Videos({
      pageUrl: 'https://echo360.net.au/section/11111111-2222-3333-4444-555555555555/home',
      iframes: [],
    });

    expect(videos).toHaveLength(0);
  });

  it('detects lesson URLs and iframe videos', () => {
    const lessonUrl =
      'https://echo360.net.au/lesson/11111111-2222-3333-4444-555555555555/classroom';
    const iframeUrl =
      'https://echo360.net.au/lesson/99999999-8888-7777-6666-555555555555/media/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

    const videos = detectEcho360Videos({
      pageUrl: lessonUrl,
      iframes: [{ src: iframeUrl, title: 'Week 1 Lecture' }],
    });

    expect(videos).toHaveLength(2);
    expect(videos[0].echoLessonId).toBe('11111111-2222-3333-4444-555555555555');
    expect(videos[1].echoMediaId).toBe('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
  });
});

describe('Echo360Provider', () => {
  it('falls back to VTT when JSON transcript is missing', async () => {
    const provider = new Echo360Provider();
    const fetcher = {
      fetchJson: vi.fn().mockRejectedValueOnce(new Error('HTTP 404: Not Found')),
      fetchWithCredentials: vi
        .fn()
        .mockResolvedValueOnce(
          'WEBVTT\n\n00:00:00.000 --> 00:00:04.000\nHello Echo'
        ),
    };

    const video = {
      id: 'echo_test',
      provider: 'echo360' as const,
      title: 'Echo Lecture',
      embedUrl:
        'https://echo360.net.au/lesson/11111111-2222-3333-4444-555555555555/media/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      echoLessonId: '11111111-2222-3333-4444-555555555555',
      echoMediaId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      echoBaseUrl: 'https://echo360.net.au',
    };

    const result = await provider.extractTranscript(video, fetcher);
    expect(result.success).toBe(true);
    expect(result.transcript?.plainText).toBe('Hello Echo');
    expect(result.transcript?.segments).toHaveLength(1);
    expect(fetcher.fetchWithCredentials).toHaveBeenCalledTimes(1);
  });

  it('detects videos and resolves mediaId from classroom HTML', async () => {
    const provider = new Echo360Provider();
    
    // Mock fetcher that simulates classroom HTML with mediaId
    const fetcher = {
      fetchJson: vi.fn(),
      fetchWithCredentials: vi.fn().mockResolvedValue(`
        <html>
          <script>
            window.__data = {"mediaId": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"};
          </script>
        </html>
      `),
      fetchHtmlWithRedirectInfo: vi.fn().mockResolvedValue({
        html: `<script>{"mediaId": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"}</script>`,
        finalUrl: 'https://echo360.net.au/lesson/11111111-2222-3333-4444-555555555555/classroom'
      }),
    };

    const context = {
      pageUrl:
        'https://echo360.net.au/lesson/11111111-2222-3333-4444-555555555555/classroom',
      iframes: [],
    };

    const videos = await provider.detectVideosAsync!(context, fetcher);
    expect(videos).toHaveLength(1);
    expect(videos[0]).toMatchObject({
      echoLessonId: '11111111-2222-3333-4444-555555555555',
      echoMediaId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      echoBaseUrl: 'https://echo360.net.au',
    });
  });

  it('resolves mediaId from lesson API when HTML extraction fails', async () => {
    const provider = new Echo360Provider();
    
    // Mock fetcher that simulates classroom HTML without mediaId,
    // but lesson API returns the medias array
    const fetcher = {
      fetchJson: vi.fn().mockResolvedValue({
        data: {
          medias: [
            { id: 'cdb84b16-ea4c-4990-8967-1184eba549de', type: 'video' }
          ]
        }
      }),
      fetchWithCredentials: vi.fn().mockResolvedValue(`
        <html><body>No media id here</body></html>
      `),
      fetchHtmlWithRedirectInfo: vi.fn().mockResolvedValue({
        html: `<html><body>No media id here</body></html>`,
        finalUrl: 'https://echo360.net.au/lesson/G_6f71556b-833c-468e-9aba-89fbc66d6e6f/classroom'
      }),
    };

    const context = {
      pageUrl:
        'https://echo360.net.au/lesson/G_6f71556b-833c-468e-9aba-89fbc66d6e6f/classroom',
      iframes: [],
    };

    const videos = await provider.detectVideosAsync!(context, fetcher);
    expect(videos).toHaveLength(1);
    expect(videos[0]).toMatchObject({
      echoLessonId: 'G_6f71556b-833c-468e-9aba-89fbc66d6e6f',
      echoMediaId: 'cdb84b16-ea4c-4990-8967-1184eba549de',
      echoBaseUrl: 'https://echo360.net.au',
    });
    
    // Verify the lesson API was called
    expect(fetcher.fetchJson).toHaveBeenCalledWith(
      expect.stringContaining('/api/ui/echoplayer/lessons/')
    );
  });

  it('detects all videos from syllabus API on section pages', async () => {
    const provider = new Echo360Provider();
    
    // Mock syllabus API response with multiple lessons
    const syllabusResponse = {
      status: 'ok',
      message: '',
      data: [
        {
          lesson: {
            lesson: {
              id: 'G_6f71556b-833c-468e-9aba-89fbc66d6e6f_19bae95c-ee99-44c1-975d-c45f07ca3db7_2025-07-31T13:58:00.000_2025-07-31T15:53:00.000',
              name: 'FIT2100_CL_S2/Class/01_OnCampus/Operating systems',
              displayName: 'FIT2100_CL_S2/Class/01_OnCampus/Operating systems',
              timing: {
                start: '2025-07-31T13:58:00.000',
                end: '2025-07-31T15:53:00.000',
              },
            },
            medias: [
              {
                id: 'cdb84b16-ea4c-4990-8967-1184eba549de',
                mediaType: 'Video',
                title: 'FIT2100_CL_S2/Class/01_OnCampus/Operating systems',
                isAvailable: true,
              },
            ],
          },
        },
        {
          lesson: {
            id: 'G_6f71556b-833c-468e-9aba-89fbc66d6e6f_19bae95c-ee99-44c1-975d-c45f07ca3db7_2025-08-07T13:58:00.000_2025-08-07T15:53:00.000',
            name: 'FIT2100_CL_S2/Class/01_OnCampus/Operating systems',
            displayName: 'FIT2100_CL_S2/Class/01_OnCampus/Operating systems',
            timing: {
              start: '2025-08-07T13:58:00.000',
              end: '2025-08-07T15:53:00.000',
            },
          },
          medias: [
            {
              mediaId: '{AABBCCDD-1111-2222-3333-444455556666}',
              mediaType: 'Video',
              title: 'FIT2100_CL_S2/Class/01_OnCampus/Operating systems',
              isAvailable: true,
            },
          ],
        },
        {
          lesson: {
            lesson: {
              id: 'G_6f71556b-833c-468e-9aba-89fbc66d6e6f_19bae95c-ee99-44c1-975d-c45f07ca3db7_2025-08-14T13:58:00.000_2025-08-14T15:53:00.000',
              name: 'FIT2100_CL_S2/Class/01_OnCampus/Operating systems',
              displayName: 'FIT2100_CL_S2/Class/01_OnCampus/Operating systems',
              timing: {
                start: '2025-08-14T13:58:00.000',
                end: '2025-08-14T15:53:00.000',
              },
            },
          },
          media: {
            id: 'deadbeef-cafe-babe-face-123456789abc',
            mediaType: 'Video',
            title: 'FIT2100_CL_S2/Class/01_OnCampus/Operating systems',
            isAvailable: true,
          },
        },
      ],
    };

    const fetcher = {
      fetchJson: vi.fn().mockResolvedValue(syllabusResponse),
      fetchWithCredentials: vi.fn(),
      fetchHtmlWithRedirectInfo: vi.fn(),
    };

    const context = {
      pageUrl: 'https://echo360.net.au/section/19bae95c-ee99-44c1-975d-c45f07ca3db7/syllabus',
      iframes: [],
    };

    const videos = await provider.detectVideosAsync!(context, fetcher);
    
    // Should detect all 3 videos from syllabus
    expect(videos).toHaveLength(3);
    
    // Verify first video
    expect(videos[0]).toMatchObject({
      id: 'cdb84b16-ea4c-4990-8967-1184eba549de',
      provider: 'echo360',
      echoMediaId: 'cdb84b16-ea4c-4990-8967-1184eba549de',
      echoBaseUrl: 'https://echo360.net.au',
    });
    // Title should not include the date (date display was removed from UI)
    expect(videos[0].title).toBe('FIT2100_CL_S2/Class/01_OnCampus/Operating systems');
    
    // Verify second video
    expect(videos[1]).toMatchObject({
      id: 'aabbccdd-1111-2222-3333-444455556666',
      provider: 'echo360',
      echoMediaId: 'aabbccdd-1111-2222-3333-444455556666',
    });
    
    // Verify third video
    expect(videos[2]).toMatchObject({
      id: 'deadbeef-cafe-babe-face-123456789abc',
      provider: 'echo360',
      echoMediaId: 'deadbeef-cafe-babe-face-123456789abc',
    });
    
    // Verify syllabus API was called with correct URL
    expect(fetcher.fetchJson).toHaveBeenCalledWith(
      'https://echo360.net.au/section/19bae95c-ee99-44c1-975d-c45f07ca3db7/syllabus'
    );
  });

  it('skips unavailable media in syllabus response', async () => {
    const provider = new Echo360Provider();
    
    const syllabusResponse = {
      status: 'ok',
      data: [
        {
          lesson: { id: 'lesson-1', displayName: 'Lecture 1' },
          medias: [
            { id: 'available-media', isAvailable: true },
            { id: 'unavailable-media', isAvailable: false },
          ],
        },
      ],
    };

    const fetcher = {
      fetchJson: vi.fn().mockResolvedValue(syllabusResponse),
      fetchWithCredentials: vi.fn(),
    };

    const context = {
      pageUrl: 'https://echo360.net.au/section/11111111-2222-3333-4444-555555555555/home',
      iframes: [],
    };

    const videos = await provider.detectVideosAsync!(context, fetcher);
    
    // Should only include the available media
    expect(videos).toHaveLength(1);
    expect(videos[0].echoMediaId).toBe('available-media');
  });

  it('skips non-video media types in syllabus response', async () => {
    const provider = new Echo360Provider();

    const syllabusResponse = {
      status: 'ok',
      data: [
        {
          lesson: { id: 'lesson-1', displayName: 'Week 1' },
          medias: [
            { id: 'doc-media', mediaType: 'Document', isAvailable: true },
            { id: 'video-media', mediaType: 'Video', isAvailable: true },
          ],
        },
      ],
    };

    const fetcher = {
      fetchJson: vi.fn().mockResolvedValue(syllabusResponse),
      fetchWithCredentials: vi.fn(),
    };

    const context = {
      pageUrl: 'https://echo360.net.au/section/22222222-3333-4444-5555-666666666666/home',
      iframes: [],
    };

    const videos = await provider.detectVideosAsync!(context, fetcher);

    expect(videos).toHaveLength(1);
    expect(videos[0].echoMediaId).toBe('video-media');
  });

  it('includes audio-only media in syllabus response', async () => {
    const provider = new Echo360Provider();

    const syllabusResponse = {
      status: 'ok',
      data: [
        {
          lesson: { id: 'lesson-audio', displayName: 'Week 2' },
          medias: [
            {
              id: 'audio-only-media',
              mediaType: 'Presentation',
              isAudioOnly: true,
              isAvailable: true,
            },
          ],
        },
      ],
    };

    const fetcher = {
      fetchJson: vi.fn().mockResolvedValue(syllabusResponse),
      fetchWithCredentials: vi.fn(),
    };

    const context = {
      pageUrl: 'https://echo360.net.au/section/33333333-4444-5555-6666-777777777777/home',
      iframes: [],
    };

    const videos = await provider.detectVideosAsync!(context, fetcher);

    expect(videos).toHaveLength(1);
    expect(videos[0].echoMediaId).toBe('audio-only-media');
  });

  it('includes audio media types in syllabus response', async () => {
    const provider = new Echo360Provider();

    const syllabusResponse = {
      status: 'ok',
      data: [
        {
          lesson: { id: 'lesson-audio-type', displayName: 'Week 3' },
          medias: [
            { id: 'audio-media', mediaType: 'Audio', isAvailable: true },
            { id: 'audio-mime', mediaType: 'audio/mpeg', isAvailable: true },
          ],
        },
      ],
    };

    const fetcher = {
      fetchJson: vi.fn().mockResolvedValue(syllabusResponse),
      fetchWithCredentials: vi.fn(),
    };

    const context = {
      pageUrl: 'https://echo360.net.au/section/44444444-5555-6666-7777-888888888888/home',
      iframes: [],
    };

    const videos = await provider.detectVideosAsync!(context, fetcher);

    expect(videos).toHaveLength(2);
    expect(videos.map(video => video.echoMediaId)).toEqual([
      'audio-media',
      'audio-mime',
    ]);
  });

  it('includes media when mediaType is missing', async () => {
    const provider = new Echo360Provider();

    const syllabusResponse = {
      status: 'ok',
      data: [
        {
          lesson: { id: 'lesson-missing-type', displayName: 'Week 4' },
          medias: [{ id: 'unknown-type-media', isAvailable: true }],
        },
      ],
    };

    const fetcher = {
      fetchJson: vi.fn().mockResolvedValue(syllabusResponse),
      fetchWithCredentials: vi.fn(),
    };

    const context = {
      pageUrl: 'https://echo360.net.au/section/55555555-6666-7777-8888-999999999999/home',
      iframes: [],
    };

    const videos = await provider.detectVideosAsync!(context, fetcher);

    expect(videos).toHaveLength(1);
    expect(videos[0].echoMediaId).toBe('unknown-type-media');
  });
});

describe('Section page detection', () => {
  it('extracts section ID from URL', () => {
    expect(extractSectionId('https://echo360.net.au/section/19bae95c-ee99-44c1-975d-c45f07ca3db7/syllabus'))
      .toBe('19bae95c-ee99-44c1-975d-c45f07ca3db7');
    expect(extractSectionId('https://echo360.net.au/section/AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE/home'))
      .toBe('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
    expect(extractSectionId('https://echo360.net.au/lesson/123/classroom'))
      .toBeNull();
    expect(extractSectionId('https://example.com/some/page'))
      .toBeNull();
  });

  it('detects section pages correctly', () => {
    // Section pages
    expect(isEcho360SectionPage('https://echo360.net.au/section/19bae95c-ee99-44c1-975d-c45f07ca3db7/syllabus'))
      .toBe(true);
    expect(isEcho360SectionPage('https://echo360.net.au/section/19bae95c-ee99-44c1-975d-c45f07ca3db7/home'))
      .toBe(true);
    expect(isEcho360SectionPage('https://echo360.net.au/section/19bae95c-ee99-44c1-975d-c45f07ca3db7'))
      .toBe(true);
    
    // Not section pages - lesson pages
    expect(isEcho360SectionPage('https://echo360.net.au/lesson/abc123/classroom'))
      .toBe(false);
    expect(isEcho360SectionPage('https://echo360.net.au/lessons/abc123'))
      .toBe(false);
    
    // Not section pages - non-Echo360
    expect(isEcho360SectionPage('https://example.com/section/19bae95c-ee99-44c1-975d-c45f07ca3db7'))
      .toBe(false);
  });
});
