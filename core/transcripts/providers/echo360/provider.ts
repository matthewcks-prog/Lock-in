import type { DetectedVideo, TranscriptExtractionResult, VideoDetectionContext } from '../../types';
import type { TranscriptProviderV2 } from '../../providerRegistry';
import type { AsyncFetcher } from '../../fetchers/types';
import { parseWebVtt } from '../../webvttParser';
import { log } from '../../utils/echo360Logger';
import { DEFAULT_TIMEOUT_MS, fetchWithRetry, isTimeoutError } from '../../utils/echo360Network';
import {
  asRecord,
  extractSectionId,
  fetchVideosFromSyllabus,
  getUniqueKey,
} from '../../parsers/echo360Parser';
import { detectEcho360Videos, findMatchingSyllabusVideo, mergeSyllabusMetadata } from './detection';
import { resolveEcho360Info } from './resolveInfo';
import { buildTranscriptFileUrl, buildTranscriptUrl } from './urlBuilders';
import { isEcho360SectionPage, isEcho360Url } from './urlUtils';
import {
  buildTranscriptResult,
  cleanText,
  normalizeEcho360TranscriptJson,
} from './transcriptParsing';

function createRequestId(): string {
  return `echo360-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

type TranscriptAttemptState = {
  hadTimeout: boolean;
  invalidResponseCount: number;
  nonEmptyResponseCount: number;
};

type TranscriptAttemptResult = {
  transcript?: TranscriptExtractionResult['transcript'];
  authRequired?: boolean;
};

function createAttemptState(): TranscriptAttemptState {
  return { hadTimeout: false, invalidResponseCount: 0, nonEmptyResponseCount: 0 };
}

function markInvalidResponse(state: TranscriptAttemptState, hasContent: boolean): void {
  if (hasContent) {
    state.nonEmptyResponseCount += 1;
  }
  state.invalidResponseCount += 1;
}

async function fetchSyllabusVideos(
  context: VideoDetectionContext,
  fetcher: AsyncFetcher,
  requestId: string,
): Promise<DetectedVideo[]> {
  const sectionId = extractSectionId(context.pageUrl);
  if (!sectionId) {
    return [];
  }
  log('info', requestId, 'Section ID detected, fetching syllabus', { sectionId });
  return fetchVideosFromSyllabus(context.pageUrl, fetcher, requestId);
}

function mergeSyllabusVideos(
  syncVideos: DetectedVideo[],
  syllabusVideos: DetectedVideo[],
  requestId: string,
): { mergedVideos: DetectedVideo[]; matchedCount: number } {
  if (syllabusVideos.length === 0) {
    return { mergedVideos: syncVideos, matchedCount: 0 };
  }

  let matchedCount = 0;
  const mergedVideos = syncVideos.map((video) => {
    const match = findMatchingSyllabusVideo(video, syllabusVideos, requestId);
    if (match) {
      matchedCount += 1;
      return mergeSyllabusMetadata(video, match);
    }
    return video;
  });

  log('info', requestId, 'Merged syllabus metadata', {
    matchedCount,
    totalSyncVideos: syncVideos.length,
  });

  return { mergedVideos, matchedCount };
}

async function enhanceVideosWithMediaIds(
  videos: DetectedVideo[],
  fetcher: AsyncFetcher,
  requestId: string,
): Promise<DetectedVideo[]> {
  const enhancedVideos: DetectedVideo[] = [];
  const seenKeys = new Set<string>();

  for (const video of videos) {
    let updated = video;
    if (!video.echoMediaId) {
      const resolved = await resolveEcho360Info(video.embedUrl, fetcher, requestId);
      if (resolved?.mediaId) {
        updated = {
          ...video,
          echoMediaId: resolved.mediaId,
          echoLessonId: resolved.lessonId || video.echoLessonId,
          echoBaseUrl: resolved.baseUrl || video.echoBaseUrl,
        };
      }
    }

    const key =
      getUniqueKey(updated.echoMediaId ?? null, updated.echoLessonId ?? null) || updated.id;
    if (seenKeys.has(key)) {
      continue;
    }
    seenKeys.add(key);
    enhancedVideos.push(updated);
  }

  return enhancedVideos;
}

function resolveBaseUrl(video: DetectedVideo): string {
  if (video.echoBaseUrl) return video.echoBaseUrl;
  try {
    return new URL(video.embedUrl).origin;
  } catch {
    return '';
  }
}

async function resolveVideoIdentifiers(
  video: DetectedVideo,
  fetcher: AsyncFetcher,
  requestId: string,
): Promise<{ lessonId: string | null; mediaId: string | null; baseUrl: string }> {
  let lessonId: string | null = video.echoLessonId ?? null;
  let mediaId: string | null = video.echoMediaId ?? null;
  let baseUrl = resolveBaseUrl(video) || '';

  if (!lessonId || !mediaId) {
    log('info', requestId, 'Resolving missing IDs');
    const resolved = await resolveEcho360Info(video.embedUrl, fetcher, requestId);
    lessonId = lessonId || resolved?.lessonId || null;
    mediaId = mediaId || resolved?.mediaId || null;
    baseUrl = baseUrl || resolved?.baseUrl || '';
  }

  return { lessonId, mediaId, baseUrl };
}

function buildAuthRequiredResult(): TranscriptExtractionResult {
  return {
    success: false,
    error: 'Authentication required. Please log in to Echo360.',
    errorCode: 'AUTH_REQUIRED',
    aiTranscriptionAvailable: true,
  };
}

function buildTimeoutResult(): TranscriptExtractionResult {
  return {
    success: false,
    error: 'Request timeout. The server took too long to respond.',
    errorCode: 'TIMEOUT',
    aiTranscriptionAvailable: true,
  };
}

function buildInvalidResponseResult(): TranscriptExtractionResult {
  return {
    success: false,
    error: 'Transcript response was invalid or empty.',
    errorCode: 'INVALID_RESPONSE',
    aiTranscriptionAvailable: true,
  };
}

function buildNoCaptionsResult(): TranscriptExtractionResult {
  return {
    success: false,
    error: 'No captions available for this video.',
    errorCode: 'NO_CAPTIONS',
    aiTranscriptionAvailable: true,
  };
}

function buildParseErrorResult(message: string): TranscriptExtractionResult {
  return {
    success: false,
    error: `Failed to extract transcript: ${message}`,
    errorCode: 'PARSE_ERROR',
    aiTranscriptionAvailable: true,
  };
}

async function tryJsonTranscript(
  fetcher: AsyncFetcher,
  url: string,
  requestId: string,
  state: TranscriptAttemptState,
): Promise<TranscriptAttemptResult | null> {
  log('info', requestId, 'Trying JSON endpoint', { url });
  try {
    const jsonPayload = await fetchWithRetry<unknown>(fetcher, url, {
      requestId,
      responseType: 'json',
      context: 'transcript-json',
      timeoutMs: DEFAULT_TIMEOUT_MS,
    });
    const transcript = normalizeEcho360TranscriptJson(jsonPayload);
    if (transcript && transcript.segments.length > 0) {
      log('info', requestId, 'JSON transcript extracted', {
        segments: transcript.segments.length,
      });
      return { transcript };
    }
    const payloadRecord = asRecord(jsonPayload);
    const hasTranscriptFields =
      payloadRecord && ('cues' in payloadRecord || 'contentJson' in payloadRecord);
    if (hasTranscriptFields) {
      markInvalidResponse(state, true);
      log('warn', requestId, 'JSON transcript response invalid', { url });
    }
    return null;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    log('warn', requestId, 'JSON endpoint failed', { error: msg });
    if (msg === 'AUTH_REQUIRED') {
      return { authRequired: true };
    }
    if (isTimeoutError(error)) {
      state.hadTimeout = true;
    }
    return null;
  }
}

async function tryVttTranscript(
  fetcher: AsyncFetcher,
  url: string,
  requestId: string,
  state: TranscriptAttemptState,
): Promise<TranscriptAttemptResult | null> {
  log('info', requestId, 'Trying VTT endpoint', { url });
  try {
    const vttContent = await fetchWithRetry<string>(fetcher, url, {
      requestId,
      responseType: 'text',
      context: 'transcript-vtt',
      timeoutMs: DEFAULT_TIMEOUT_MS,
    });
    const transcript = parseWebVtt(vttContent);
    if (transcript.segments.length > 0) {
      log('info', requestId, 'VTT transcript extracted', {
        segments: transcript.segments.length,
      });
      return { transcript };
    }
    if (vttContent.trim()) {
      markInvalidResponse(state, true);
      log('warn', requestId, 'VTT transcript response invalid', { url });
    }
  } catch (error) {
    log('warn', requestId, 'VTT endpoint failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    if (isTimeoutError(error)) {
      state.hadTimeout = true;
    }
  }
  return null;
}

async function tryTextTranscript(
  fetcher: AsyncFetcher,
  url: string,
  requestId: string,
  state: TranscriptAttemptState,
): Promise<TranscriptAttemptResult | null> {
  log('info', requestId, 'Trying text endpoint', { url });
  try {
    const textContent = await fetchWithRetry<string>(fetcher, url, {
      requestId,
      responseType: 'text',
      context: 'transcript-text',
      timeoutMs: DEFAULT_TIMEOUT_MS,
    });
    const plainText = cleanText(textContent);
    if (plainText) {
      const transcript = buildTranscriptResult([{ startMs: 0, endMs: null, text: plainText }]);
      log('info', requestId, 'Text transcript extracted');
      return { transcript };
    }
    if (textContent.trim()) {
      markInvalidResponse(state, true);
      log('warn', requestId, 'Text transcript response invalid', { url });
    }
  } catch (error) {
    log('warn', requestId, 'Text endpoint failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    if (isTimeoutError(error)) {
      state.hadTimeout = true;
    }
  }
  return null;
}

// ============================================================================//
// Provider Class
// ============================================================================//

export class Echo360Provider implements TranscriptProviderV2 {
  readonly provider = 'echo360' as const;

  canHandle(url: string): boolean {
    return isEcho360Url(url);
  }

  requiresAsyncDetection(_context: VideoDetectionContext): boolean {
    // We may need async detection to resolve mediaId
    return true;
  }

  detectVideosSync(context: VideoDetectionContext): DetectedVideo[] {
    return detectEcho360Videos(context);
  }

  /**
   * Get a hint message when no Echo360 videos are detected.
   * Provides guidance for users on Echo360 section pages.
   */
  getEmptyDetectionHint(context: VideoDetectionContext): string | null {
    // Only show hint if we're on an Echo360 page
    if (!isEcho360Url(context.pageUrl)) {
      return null;
    }
    return 'Echo360 tip: open a lesson page or the syllabus list to load videos.';
  }

  async detectVideosAsync(
    context: VideoDetectionContext,
    fetcher: AsyncFetcher,
  ): Promise<DetectedVideo[]> {
    const requestId = createRequestId();
    log('info', requestId, 'Starting async detection', { pageUrl: context.pageUrl });

    const syllabusVideos = await fetchSyllabusVideos(context, fetcher, requestId);

    if (isEcho360SectionPage(context.pageUrl)) {
      if (syllabusVideos.length > 0) {
        log('info', requestId, 'Syllabus detection complete', {
          count: syllabusVideos.length,
          withMediaId: syllabusVideos.filter((v) => v.echoMediaId).length,
        });
        return syllabusVideos;
      }
      log('info', requestId, 'No videos from syllabus, falling back to standard detection');
    }

    const syncVideos = detectEcho360Videos(context);

    if (syncVideos.length === 0) {
      log('info', requestId, 'No videos found in sync detection');
      return [];
    }

    const { mergedVideos } = mergeSyllabusVideos(syncVideos, syllabusVideos, requestId);
    const enhancedVideos = await enhanceVideosWithMediaIds(mergedVideos, fetcher, requestId);

    log('info', requestId, 'Async detection complete', {
      count: enhancedVideos.length,
      withMediaId: enhancedVideos.filter((v) => v.echoMediaId).length,
    });

    return enhancedVideos;
  }

  async extractTranscript(
    video: DetectedVideo,
    fetcher: AsyncFetcher,
  ): Promise<TranscriptExtractionResult> {
    const requestId = createRequestId();
    log('info', requestId, 'Starting transcript extraction', {
      videoId: video.id,
      lessonId: video.echoLessonId,
      mediaId: video.echoMediaId,
    });

    try {
      const { lessonId, mediaId, baseUrl } = await resolveVideoIdentifiers(
        video,
        fetcher,
        requestId,
      );

      if (!lessonId || !mediaId || !baseUrl) {
        log('warn', requestId, 'Missing required IDs', { lessonId, mediaId, baseUrl });
        return {
          success: false,
          error: 'Could not resolve Echo360 video identifiers.',
          errorCode: 'INVALID_VIDEO',
          aiTranscriptionAvailable: true,
        };
      }

      log('info', requestId, 'IDs resolved', { lessonId, mediaId, baseUrl });

      const state = createAttemptState();

      const jsonUrl = buildTranscriptUrl(baseUrl, lessonId, mediaId);
      const jsonResult = await tryJsonTranscript(fetcher, jsonUrl, requestId, state);
      if (jsonResult?.authRequired) {
        return buildAuthRequiredResult();
      }
      if (jsonResult?.transcript) {
        return { success: true, transcript: jsonResult.transcript };
      }

      const vttUrl = buildTranscriptFileUrl(baseUrl, lessonId, mediaId, 'vtt');
      const vttResult = await tryVttTranscript(fetcher, vttUrl, requestId, state);
      if (vttResult?.transcript) {
        return { success: true, transcript: vttResult.transcript };
      }

      const textUrl = buildTranscriptFileUrl(baseUrl, lessonId, mediaId, 'text');
      const textResult = await tryTextTranscript(fetcher, textUrl, requestId, state);
      if (textResult?.transcript) {
        return { success: true, transcript: textResult.transcript };
      }

      log('warn', requestId, 'No transcript available');
      if (state.hadTimeout) {
        return buildTimeoutResult();
      }
      if (
        state.nonEmptyResponseCount > 0 &&
        state.invalidResponseCount === state.nonEmptyResponseCount
      ) {
        return buildInvalidResponseResult();
      }
      return buildNoCaptionsResult();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log('error', requestId, 'Extraction failed', { error: message });

      if (message === 'AUTH_REQUIRED') {
        return buildAuthRequiredResult();
      }

      if (isTimeoutError(error)) {
        return buildTimeoutResult();
      }

      return buildParseErrorResult(message);
    }
  }
}

export function createEcho360Provider(): Echo360Provider {
  return new Echo360Provider();
}
