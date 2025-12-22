/**
 * Echo360 Transcript Provider
 *
 * Handles detection and transcript extraction for Echo360 videos.
 * Echo360 pages have URLs like:
 *   https://echo360.{domain}/section/{sectionId}/home
 *   https://echo360.{domain}/lesson/{lessonId}/classroom
 *
 * This provider uses:
 * - Sync detection for lesson pages (single video)
 * - Async detection for section pages (requires API call)
 */

import type {
  DetectedVideo,
  VideoDetectionContext,
  TranscriptExtractionResult,
  Echo360Context,
  TranscriptSegment,
} from '../types';
import type { TranscriptProviderV2, AsyncFetcher } from '../providerRegistry';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/**
 * List of valid Echo360 host domains
 */
export const ECHO360_HOSTS = [
  'echo360qa.org',
  'echo360qa.dev',
  'echo360.org',
  'echo360.org.au',
  'echo360.net.au',
  'echo360.ca',
  'echo360.org.uk',
] as const;

/**
 * Regex to extract section ID from Echo360 URL
 */
const SECTION_ID_REGEX = /\/section\/([a-f0-9-]+)/i;

/**
 * Regex to extract lesson ID from Echo360 URL
 */
const LESSON_ID_REGEX = /\/lesson\/([^/]+)/i;

// ─────────────────────────────────────────────────────────────────────────────
// URL Utilities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check if a hostname is an Echo360 domain
 */
export function isEcho360Domain(hostname: string): boolean {
  const lowerHost = hostname.toLowerCase();
  return ECHO360_HOSTS.some(
    (domain) => lowerHost === domain || lowerHost.endsWith('.' + domain)
  );
}

/**
 * Check if a URL is an Echo360 page
 */
export function isEcho360Url(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return isEcho360Domain(urlObj.hostname);
  } catch {
    return false;
  }
}

/**
 * Extract Echo360 origin from URL
 */
export function extractEcho360Origin(url: string): string | null {
  try {
    const urlObj = new URL(url);
    if (isEcho360Domain(urlObj.hostname)) {
      return urlObj.origin;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Extract section ID from Echo360 URL
 */
export function extractSectionId(url: string): string | null {
  const match = url.match(SECTION_ID_REGEX);
  return match ? match[1] : null;
}

/**
 * Extract lesson ID from Echo360 URL
 */
export function extractLessonId(url: string): string | null {
  const match = url.match(LESSON_ID_REGEX);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

/**
 * Extract media ID from Echo360 URL query params
 */
export function extractMediaId(url: string): string | null {
  try {
    const urlObj = new URL(url);
    return (
      urlObj.searchParams.get('mediaId') ||
      urlObj.searchParams.get('media') ||
      urlObj.searchParams.get('mid') ||
      null
    );
  } catch {
    return null;
  }
}

/**
 * Extract full Echo360 context from a page URL
 */
export function extractEcho360Context(url: string): Echo360Context | null {
  const echoOrigin = extractEcho360Origin(url);
  if (!echoOrigin) return null;

  let lessonId = extractLessonId(url) || undefined;
  let sectionId = extractSectionId(url) || undefined;
  let mediaId = extractMediaId(url) || undefined;

  // Fallback: Check query params for IDs
  try {
    const urlObj = new URL(url);
    if (!lessonId) {
      lessonId =
        urlObj.searchParams.get('lessonId') ||
        urlObj.searchParams.get('lesson') ||
        urlObj.searchParams.get('lid') ||
        undefined;
    }
    if (!sectionId) {
      sectionId =
        urlObj.searchParams.get('sectionId') ||
        urlObj.searchParams.get('section') ||
        urlObj.searchParams.get('sid') ||
        undefined;
    }
  } catch {
    // URL parsing failed, continue with what we have
  }

  return {
    echoOrigin,
    sectionId,
    lessonId,
    mediaId,
  };
}

/**
 * Get page type from Echo360 context
 */
export function getEcho360PageType(
  context: Echo360Context | null
): 'lesson' | 'section' | 'unknown' {
  if (!context) return 'unknown';
  if (context.lessonId) return 'lesson';
  if (context.sectionId) return 'section';
  return 'unknown';
}

// ─────────────────────────────────────────────────────────────────────────────
// Syllabus Parsing
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse Echo360 syllabus response into DetectedVideo array
 */
export function parseEcho360Syllabus(
  data: unknown,
  echoOrigin: string,
  sectionId: string
): DetectedVideo[] {
  const videos: DetectedVideo[] = [];

  // Handle both direct array and { data: [...] } formats
  const items = Array.isArray(data)
    ? data
    : (data as { data?: unknown[] })?.data || [];

  for (const item of items as Array<{
    type?: string;
    lesson?: {
      lesson?: { id?: string; name?: string; displayName?: string; timing?: { start?: string } };
      medias?: Array<{ id?: string; title?: string; durationMs?: number; thumbnailUri?: string; thumbnailUrl?: string; isAvailable?: boolean }>;
      captureStartedAt?: string;
      hasVideo?: boolean;
    };
  }>) {
    // Skip non-lesson items
    if (item.type && item.type !== 'SyllabusLessonType') {
      continue;
    }

    const lessonWrapper = item.lesson || item;
    const lesson = (lessonWrapper as { lesson?: { id?: string; name?: string; displayName?: string; timing?: { start?: string } } }).lesson || lessonWrapper;
    const medias = (lessonWrapper as { medias?: Array<{ id?: string; title?: string; durationMs?: number; thumbnailUri?: string; thumbnailUrl?: string; isAvailable?: boolean }> }).medias || [];

    const lessonData = lesson as { id?: string; name?: string; displayName?: string; timing?: { start?: string } };
    if (!lessonData || !lessonData.id) {
      continue;
    }

    // Create a video entry for each media in the lesson
    for (const media of medias) {
      if (!media.id) continue;

      // Skip unavailable media
      if (media.isAvailable === false) {
        continue;
      }

      const title =
        lessonData.name ||
        lessonData.displayName ||
        media.title ||
        `Recording ${videos.length + 1}`;
      const recordedAt =
        lessonData.timing?.start || (lessonWrapper as { captureStartedAt?: string }).captureStartedAt || undefined;

      videos.push({
        id: `${lessonData.id}_${media.id}`,
        provider: 'echo360',
        title,
        embedUrl: `${echoOrigin}/lesson/${lessonData.id}/classroom`,
        echoOrigin,
        sectionId,
        lessonId: lessonData.id,
        mediaId: media.id,
        durationMs: media.durationMs || undefined,
        thumbnailUrl: media.thumbnailUri || media.thumbnailUrl || undefined,
        recordedAt,
      });
    }

    // If no medias array but lesson has video content, create placeholder entry
    if (medias.length === 0 && lessonData.id && (lessonWrapper as { hasVideo?: boolean }).hasVideo) {
      videos.push({
        id: lessonData.id,
        provider: 'echo360',
        title:
          lessonData.name ||
          lessonData.displayName ||
          `Recording ${videos.length + 1}`,
        embedUrl: `${echoOrigin}/lesson/${lessonData.id}/classroom`,
        echoOrigin,
        sectionId,
        lessonId: lessonData.id,
        recordedAt: lessonData.timing?.start || undefined,
      });
    }
  }

  return videos;
}

// ─────────────────────────────────────────────────────────────────────────────
// Transcript Parsing
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse Echo360 transcript API response
 */
export function parseEcho360Transcript(data: unknown): {
  plainText: string;
  segments: TranscriptSegment[];
  durationMs: number;
} | null {
  // Handle various response structures
  const dataObj = data as {
    data?: {
      contentJSON?: { cues?: Array<{ content?: string; text?: string; startMs?: number; start?: number; endMs?: number; end?: number; speaker?: string }> };
    };
    contentJSON?: { cues?: Array<{ content?: string; text?: string; startMs?: number; start?: number; endMs?: number; end?: number; speaker?: string }> };
    cues?: Array<{ content?: string; text?: string; startMs?: number; start?: number; endMs?: number; end?: number; speaker?: string }>;
  };

  const cues =
    dataObj?.data?.contentJSON?.cues ||
    dataObj?.contentJSON?.cues ||
    dataObj?.cues ||
    [];

  if (!cues || cues.length === 0) {
    return null;
  }

  const segments: TranscriptSegment[] = [];
  const textParts: string[] = [];

  for (const cue of cues) {
    const text = (cue.content || cue.text || '').trim();
    if (!text) continue;

    segments.push({
      startMs: cue.startMs || cue.start || 0,
      endMs: cue.endMs || cue.end || 0,
      text,
      speaker: cue.speaker || undefined,
    });

    textParts.push(text);
  }

  const plainText = textParts.join(' ');
  const durationMs = segments.length > 0 ? segments[segments.length - 1].endMs : 0;

  return {
    plainText,
    segments,
    durationMs,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider Implementation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Echo360 transcript provider implementation
 */
export class Echo360Provider implements TranscriptProviderV2 {
  readonly provider = 'echo360' as const;

  canHandle(url: string): boolean {
    return isEcho360Url(url);
  }

  requiresAsyncDetection(context: VideoDetectionContext): boolean {
    const echo360Context = extractEcho360Context(context.pageUrl);
    const pageType = getEcho360PageType(echo360Context);
    // Section pages require API call to get video list
    return pageType === 'section';
  }

  detectVideosSync(context: VideoDetectionContext): DetectedVideo[] {
    const echo360Context = extractEcho360Context(context.pageUrl);
    const pageType = getEcho360PageType(echo360Context);

    if (pageType === 'lesson' && echo360Context) {
      // Lesson page - can create single video entry directly
      const video: DetectedVideo = {
        id: echo360Context.lessonId!,
        provider: 'echo360',
        title: '', // Will be filled by caller with page title
        embedUrl: context.pageUrl,
        echoOrigin: echo360Context.echoOrigin,
        lessonId: echo360Context.lessonId,
        mediaId: echo360Context.mediaId,
      };
      return [video];
    }

    // Section pages require async detection
    return [];
  }

  async detectVideosAsync(
    context: VideoDetectionContext,
    fetcher: AsyncFetcher
  ): Promise<DetectedVideo[]> {
    const echo360Context = extractEcho360Context(context.pageUrl);
    if (!echo360Context || !echo360Context.sectionId) {
      return [];
    }

    const syllabusUrl = `${echo360Context.echoOrigin}/section/${echo360Context.sectionId}/syllabus`;
    const data = await fetcher.fetchJson<unknown>(syllabusUrl);
    return parseEcho360Syllabus(
      data,
      echo360Context.echoOrigin,
      echo360Context.sectionId
    );
  }

  async extractTranscript(
    video: DetectedVideo,
    fetcher: AsyncFetcher
  ): Promise<TranscriptExtractionResult> {
    const { echoOrigin, lessonId, mediaId } = video;

    if (!echoOrigin || !lessonId) {
      return {
        success: false,
        error: 'Missing Echo360 video metadata (origin or lessonId)',
        errorCode: 'PARSE_ERROR',
        aiTranscriptionAvailable: true,
      };
    }

    // If mediaId is missing, we can't fetch transcript
    // (The background script has strategies to find it)
    if (!mediaId) {
      return {
        success: false,
        error: 'Missing media ID for transcript',
        errorCode: 'PARSE_ERROR',
        aiTranscriptionAvailable: true,
      };
    }

    const transcriptUrl = `${echoOrigin}/api/ui/echoplayer/lessons/${lessonId}/medias/${mediaId}/transcript`;

    try {
      const data = await fetcher.fetchJson<unknown>(transcriptUrl);
      const transcript = parseEcho360Transcript(data);

      if (!transcript || transcript.segments.length === 0) {
        return {
          success: false,
          error:
            'Transcript not available for this recording. AI transcription may be available as a fallback.',
          errorCode: 'NOT_AVAILABLE',
          aiTranscriptionAvailable: true,
        };
      }

      return {
        success: true,
        transcript,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      if (message === 'AUTH_REQUIRED') {
        return {
          success: false,
          error: 'Please sign in to Echo360 to access transcripts.',
          errorCode: 'AUTH_REQUIRED',
          aiTranscriptionAvailable: true,
        };
      }

      return {
        success: false,
        error: `Failed to fetch transcript: ${message}`,
        errorCode: 'NETWORK_ERROR',
        aiTranscriptionAvailable: true,
      };
    }
  }

  /**
   * Get Echo360 context from a URL (utility method)
   */
  getContext(url: string): Echo360Context | null {
    return extractEcho360Context(url);
  }
}

/**
 * Create a new Echo360 provider instance
 */
export function createEcho360Provider(): Echo360Provider {
  return new Echo360Provider();
}

