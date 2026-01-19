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

    const sectionId = extractSectionId(context.pageUrl);
    let syllabusVideos: DetectedVideo[] = [];

    if (sectionId) {
      log('info', requestId, 'Section ID detected, fetching syllabus', { sectionId });
      syllabusVideos = await fetchVideosFromSyllabus(context.pageUrl, fetcher, requestId);
    }

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

    let matchedCount = 0;
    const mergedVideos =
      syllabusVideos.length > 0
        ? syncVideos.map((video) => {
            const match = findMatchingSyllabusVideo(video, syllabusVideos, requestId);
            if (match) {
              matchedCount += 1;
              return mergeSyllabusMetadata(video, match);
            }
            return video;
          })
        : syncVideos;

    if (syllabusVideos.length > 0) {
      log('info', requestId, 'Merged syllabus metadata', {
        matchedCount,
        totalSyncVideos: syncVideos.length,
      });
    }

    const enhancedVideos: DetectedVideo[] = [];
    const seenKeys = new Set<string>();

    for (const video of mergedVideos) {
      if (video.echoMediaId) {
        const key = getUniqueKey(video.echoMediaId ?? null, video.echoLessonId ?? null) || video.id;
        if (seenKeys.has(key)) continue;
        seenKeys.add(key);
        enhancedVideos.push(video);
        continue;
      }

      const resolved = await resolveEcho360Info(video.embedUrl, fetcher, requestId);
      const updated: DetectedVideo = resolved?.mediaId
        ? {
            ...video,
            echoMediaId: resolved.mediaId,
            echoLessonId: resolved.lessonId || video.echoLessonId,
            echoBaseUrl: resolved.baseUrl || video.echoBaseUrl,
          }
        : video;
      const key =
        getUniqueKey(updated.echoMediaId ?? null, updated.echoLessonId ?? null) || updated.id;
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);
      enhancedVideos.push(updated);
    }

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
      let lessonId = video.echoLessonId;
      let mediaId = video.echoMediaId;
      let baseUrl =
        video.echoBaseUrl ||
        (() => {
          try {
            return new URL(video.embedUrl).origin;
          } catch {
            return '';
          }
        })();

      if (!lessonId || !mediaId) {
        log('info', requestId, 'Resolving missing IDs');
        const resolved = await resolveEcho360Info(video.embedUrl, fetcher, requestId);
        lessonId = lessonId || resolved?.lessonId;
        mediaId = mediaId || resolved?.mediaId;
        baseUrl = baseUrl || resolved?.baseUrl || '';
      }

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

      let hadTimeout = false;
      let invalidResponseCount = 0;
      let nonEmptyResponseCount = 0;

      const jsonUrl = buildTranscriptUrl(baseUrl, lessonId, mediaId);
      log('info', requestId, 'Trying JSON endpoint', { url: jsonUrl });

      try {
        const jsonPayload = await fetchWithRetry<unknown>(fetcher, jsonUrl, {
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
          return { success: true, transcript };
        }
        const payloadRecord = asRecord(jsonPayload);
        const hasTranscriptFields =
          payloadRecord && ('cues' in payloadRecord || 'contentJson' in payloadRecord);
        if (hasTranscriptFields) {
          nonEmptyResponseCount += 1;
          invalidResponseCount += 1;
          log('warn', requestId, 'JSON transcript response invalid', { url: jsonUrl });
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        log('warn', requestId, 'JSON endpoint failed', { error: msg });

        if (msg === 'AUTH_REQUIRED') {
          return {
            success: false,
            error: 'Authentication required. Please log in to Echo360.',
            errorCode: 'AUTH_REQUIRED',
            aiTranscriptionAvailable: true,
          };
        }
        if (isTimeoutError(error)) {
          hadTimeout = true;
        }
      }

      const vttUrl = buildTranscriptFileUrl(baseUrl, lessonId, mediaId, 'vtt');
      log('info', requestId, 'Trying VTT endpoint', { url: vttUrl });

      try {
        const vttContent = await fetchWithRetry<string>(fetcher, vttUrl, {
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
          return { success: true, transcript };
        }
        if (vttContent.trim()) {
          nonEmptyResponseCount += 1;
          invalidResponseCount += 1;
          log('warn', requestId, 'VTT transcript response invalid', { url: vttUrl });
        }
      } catch (error) {
        log('warn', requestId, 'VTT endpoint failed', {
          error: error instanceof Error ? error.message : String(error),
        });
        if (isTimeoutError(error)) {
          hadTimeout = true;
        }
      }

      const textUrl = buildTranscriptFileUrl(baseUrl, lessonId, mediaId, 'text');
      log('info', requestId, 'Trying text endpoint', { url: textUrl });

      try {
        const textContent = await fetchWithRetry<string>(fetcher, textUrl, {
          requestId,
          responseType: 'text',
          context: 'transcript-text',
          timeoutMs: DEFAULT_TIMEOUT_MS,
        });
        const plainText = cleanText(textContent);
        if (plainText) {
          const transcript = buildTranscriptResult([{ startMs: 0, endMs: null, text: plainText }]);
          log('info', requestId, 'Text transcript extracted');
          return { success: true, transcript };
        }
        if (textContent.trim()) {
          nonEmptyResponseCount += 1;
          invalidResponseCount += 1;
          log('warn', requestId, 'Text transcript response invalid', { url: textUrl });
        }
      } catch (error) {
        log('warn', requestId, 'Text endpoint failed', {
          error: error instanceof Error ? error.message : String(error),
        });
        if (isTimeoutError(error)) {
          hadTimeout = true;
        }
      }

      log('warn', requestId, 'No transcript available');
      if (hadTimeout) {
        return {
          success: false,
          error: 'Request timeout. The server took too long to respond.',
          errorCode: 'TIMEOUT',
          aiTranscriptionAvailable: true,
        };
      }
      if (nonEmptyResponseCount > 0 && invalidResponseCount === nonEmptyResponseCount) {
        return {
          success: false,
          error: 'Transcript response was invalid or empty.',
          errorCode: 'INVALID_RESPONSE',
          aiTranscriptionAvailable: true,
        };
      }
      return {
        success: false,
        error: 'No captions available for this video.',
        errorCode: 'NO_CAPTIONS',
        aiTranscriptionAvailable: true,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log('error', requestId, 'Extraction failed', { error: message });

      if (message === 'AUTH_REQUIRED') {
        return {
          success: false,
          error: 'Authentication required. Please log in to Echo360.',
          errorCode: 'AUTH_REQUIRED',
          aiTranscriptionAvailable: true,
        };
      }

      if (isTimeoutError(error)) {
        return {
          success: false,
          error: 'Request timeout. The server took too long to respond.',
          errorCode: 'TIMEOUT',
          aiTranscriptionAvailable: true,
        };
      }

      return {
        success: false,
        error: `Failed to extract transcript: ${message}`,
        errorCode: 'PARSE_ERROR',
        aiTranscriptionAvailable: true,
      };
    }
  }
}

export function createEcho360Provider(): Echo360Provider {
  return new Echo360Provider();
}
