/**
 * Echo360 Transcript Provider
 *
 * Handles detection and transcript extraction for Echo360 videos.
 *
 * Detection:
 * - Direct Echo360 URLs (user on echo360 domain)
 * - Embedded iframes (Echo360 in LMS pages)
 *
 * Extraction:
 * 1. JSON transcript endpoint: /api/ui/echoplayer/lessons/{lessonId}/medias/{mediaId}/transcript
 * 2. VTT transcript file
 * 3. Text transcript file
 */

import type {
  DetectedVideo,
  VideoDetectionContext,
  TranscriptExtractionResult,
  TranscriptResult,
  TranscriptSegment,
} from '../types';
import type { TranscriptProviderV2 } from '../providerRegistry';
import type { AsyncFetcher } from '../fetchers/types';
import { parseWebVtt } from '../webvttParser';
import type { Echo360Info, UnknownRecord } from '../types/echo360Types';
import {
  asRecord,
  extractSectionId,
  fetchVideosFromSyllabus,
  getUniqueKey,
} from '../parsers/echo360Parser';
import { log } from '../utils/echo360Logger';
import {
  DEFAULT_TIMEOUT_MS,
  fetchHtmlWithRedirect,
  fetchWithRetry,
  isTimeoutError,
} from '../utils/echo360Network';

export * from '../types/echo360Types';
export {
  extractSectionId,
  parseSyllabusResponse,
  fetchVideosFromSyllabus,
} from '../parsers/echo360Parser';

// ============================================================================
// Constants
// ============================================================================

const ECHO360_DOMAIN_SUFFIXES = [
  'echo360.org',
  'echo360.org.au',
  'echo360.net.au',
  'echo360.ca',
  'echo360.org.uk',
  'echo360qa.org',
  'echo360qa.dev',
];

/**
 * Check if URL is an Echo360 section/course page (not a single lesson view)
 */
export function isEcho360SectionPage(url: string): boolean {
  // Must be an Echo360 URL first
  if (!isEcho360Url(url)) return false;
  
  const sectionId = extractSectionId(url);
  if (!sectionId) return false;
  
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.toLowerCase();
    // It's a section page if we're not on a specific lesson page
    // Lesson pages have /lesson/{lessonId} in the path
    const isLessonPage = /\/lessons?\/[^/]+/.test(path);
    return !isLessonPage;
  } catch {
    return false;
  }
}

// ============================================================================
// Logging Utilities
// ============================================================================

function createRequestId(): string {
  return `echo360-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

// ============================================================================
// Domain & URL Helpers
// ============================================================================

export function isEcho360Domain(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return ECHO360_DOMAIN_SUFFIXES.some(
    suffix => normalized === suffix || normalized.endsWith(`.${suffix}`)
  );
}

export function isEcho360Url(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);
    return isEcho360Domain(url.hostname);
  } catch {
    return rawUrl.toLowerCase().includes('echo360');
  }
}

function safeDecodeUri(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

// ============================================================================
// ID Extraction
// ============================================================================

/**
 * Extract lessonId from URL pathname
 * Lesson IDs can be complex: G_{uuid}_{uuid}_{timestamp}_{timestamp}
 */
function extractLessonIdFromPath(pathname: string): string | null {
  // Match /lesson/{complex-lesson-id} or /lessons/{complex-lesson-id}
  const match = pathname.match(/\/lessons?\/([^\/]+)/i);
  if (match?.[1]) {
    return safeDecodeUri(match[1]);
  }
  return null;
}

/**
 * Extract mediaId from URL pathname (standard UUID format)
 */
function extractMediaIdFromPath(pathname: string): string | null {
  // Match /media/{uuid} or /medias/{uuid}
  const match = pathname.match(/\/medias?\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
  return match ? match[1].toLowerCase() : null;
}

/**
 * Extract Echo360 info from a URL
 */
export function extractEcho360Info(rawUrl: string): Echo360Info | null {
  try {
    // First check if this URL contains an embedded Echo360 URL (e.g., LTI launch URLs)
    const decoded = safeDecodeUri(rawUrl);
    
    // Look for embedded Echo360 URL in query params
    try {
      const outerUrl = new URL(decoded);
      for (const [, value] of outerUrl.searchParams.entries()) {
        const decodedValue = safeDecodeUri(value);
        if (decodedValue.includes('echo360')) {
          const innerInfo = extractEcho360Info(decodedValue);
          if (innerInfo?.lessonId || innerInfo?.mediaId) {
            return innerInfo;
          }
        }
      }
    } catch {
      // Not a valid URL with params, continue
    }
    
    const url = new URL(decoded);
    
    if (!isEcho360Domain(url.hostname)) {
      return null;
    }

    const lessonId = extractLessonIdFromPath(url.pathname);
    const mediaId = extractMediaIdFromPath(url.pathname);

    // Also check query params
    const paramLessonId = url.searchParams.get('lessonId') || url.searchParams.get('lesson_id');
    const paramMediaId = url.searchParams.get('mediaId') || url.searchParams.get('media_id');

    return {
      lessonId: lessonId || paramLessonId || undefined,
      mediaId: mediaId || (paramMediaId ? paramMediaId.toLowerCase() : undefined),
      baseUrl: url.origin,
    };
  } catch {
    return null;
  }
}

/**
 * Extract mediaId from HTML content using multiple patterns
 */
function extractMediaIdFromHtml(html: string): string | null {
  // Pattern 1: JSON property "mediaId": "uuid" - various forms
  const jsonPatterns = [
    /"mediaId"\s*:\s*"([0-9a-f-]{36})"/i,
    /"media_id"\s*:\s*"([0-9a-f-]{36})"/i,
    /'mediaId'\s*:\s*'([0-9a-f-]{36})'/i,
    // id property inside medias arrays
    /"medias"\s*:\s*\[\s*\{[^}]*"id"\s*:\s*"([0-9a-f-]{36})"/i,
  ];
  
  for (const pattern of jsonPatterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      return match[1].toLowerCase();
    }
  }

  // Pattern 2: URL patterns in HTML
  // /api/ui/echoplayer/lessons/{lessonId}/medias/{mediaId}/transcript
  const urlPatterns = [
    /\/medias\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/transcript/i,
    /\/medias\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i,
    /\/media\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i,
    /\/interactive-media\/media\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i,
    // captions-{mediaId} pattern seen in network requests
    /captions-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i,
  ];

  for (const pattern of urlPatterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      return match[1].toLowerCase();
    }
  }

  // Pattern 3: data attributes
  const dataMatch = html.match(/data-media-id\s*=\s*["']([0-9a-f-]{36})["']/i);
  if (dataMatch?.[1]) {
    return dataMatch[1].toLowerCase();
  }

  return null;
}

/**
 * Build lesson info API URL to get medias
 * Format: /api/ui/echoplayer/lessons/{lessonId}
 */
function buildLessonInfoUrl(baseUrl: string, lessonId: string): string {
  return `${baseUrl}/api/ui/echoplayer/lessons/${encodeURIComponent(lessonId)}`;
}

/**
 * Extract mediaId from lesson API response
 */
function extractMediaIdFromLessonInfo(lessonData: unknown): string | null {
  if (!lessonData || typeof lessonData !== 'object') return null;
  
  const data = lessonData as Record<string, unknown>;
  
  // Check for direct medias array
  if (Array.isArray(data.medias) && data.medias.length > 0) {
    const firstMedia = data.medias[0] as Record<string, unknown>;
    if (typeof firstMedia?.id === 'string') {
      return firstMedia.id.toLowerCase();
    }
    if (typeof firstMedia?.mediaId === 'string') {
      return firstMedia.mediaId.toLowerCase();
    }
  }
  
  // Check for data wrapper
  if (data.data && typeof data.data === 'object') {
    return extractMediaIdFromLessonInfo(data.data);
  }
  
  // Check for lesson wrapper
  if (data.lesson && typeof data.lesson === 'object') {
    return extractMediaIdFromLessonInfo(data.lesson);
  }
  
  // Check for medias in nested structure
  const nestedKeys = ['video', 'media', 'content', 'sections'];
  for (const key of nestedKeys) {
    if (data[key] && typeof data[key] === 'object') {
      const nested = data[key] as Record<string, unknown>;
      if (Array.isArray(nested.medias) && nested.medias.length > 0) {
        const firstMedia = nested.medias[0] as Record<string, unknown>;
        if (typeof firstMedia?.id === 'string') {
          return firstMedia.id.toLowerCase();
        }
      }
    }
  }
  
  return null;
}

/**
 * Parse Echo360 info from HTML page content
 */
function parseEcho360InfoFromHtml(html: string, pageUrl: string): Echo360Info | null {
  const baseInfo = extractEcho360Info(pageUrl);
  const mediaId = extractMediaIdFromHtml(html);

  if (baseInfo) {
    return {
      ...baseInfo,
      mediaId: mediaId || baseInfo.mediaId,
    };
  }

  if (mediaId) {
    try {
      const url = new URL(pageUrl);
      return { mediaId, baseUrl: url.origin };
    } catch {
      return null;
    }
  }

  return null;
}

// ============================================================================
// URL Builders
// ============================================================================

/**
 * Build transcript JSON API URL
 * Format: /api/ui/echoplayer/lessons/{lessonId}/medias/{mediaId}/transcript
 */
function buildTranscriptUrl(baseUrl: string, lessonId: string, mediaId: string): string {
  return `${baseUrl}/api/ui/echoplayer/lessons/${encodeURIComponent(lessonId)}/medias/${encodeURIComponent(mediaId)}/transcript`;
}

/**
 * Build transcript file URL (VTT or text format)
 */
function buildTranscriptFileUrl(baseUrl: string, lessonId: string, mediaId: string, format: 'vtt' | 'text'): string {
  return `${baseUrl}/api/ui/echoplayer/lessons/${encodeURIComponent(lessonId)}/medias/${encodeURIComponent(mediaId)}/transcript-file?format=${format}`;
}

/**
 * Build lesson classroom page URL
 */
function buildClassroomUrl(baseUrl: string, lessonId: string): string {
  return `${baseUrl}/lesson/${encodeURIComponent(lessonId)}/classroom`;
}

// ============================================================================
// Transcript Parsing
// ============================================================================

function cleanText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function normalizeSpeaker(raw: unknown): string | undefined {
  if (typeof raw !== 'string' || !raw.trim()) return undefined;
  const trimmed = raw.trim();
  const match = trimmed.match(/^speaker\s*(\d+)$/i);
  if (match) {
    const idx = parseInt(match[1], 10);
    return idx === 0 ? 'Speaker' : `Speaker ${idx}`;
  }
  return trimmed;
}

function normalizeConfidence(raw: unknown): number | undefined {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return raw >= 0 && raw <= 1 ? raw : raw > 1 && raw <= 100 ? raw / 100 : undefined;
  }
  // Handle object with average/avg property
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    const value = obj.average ?? obj.avg ?? obj.raw ?? obj.score;
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value >= 0 && value <= 1 ? value : value > 1 && value <= 100 ? value / 100 : undefined;
    }
  }
  return undefined;
}

function buildTranscriptResult(segments: TranscriptSegment[]): TranscriptResult {
  const plainText = segments.map(s => s.text).join(' ').trim();
  const lastSegment = segments[segments.length - 1];
  return {
    plainText,
    segments,
    durationMs: lastSegment?.endMs ?? lastSegment?.startMs,
  };
}

/**
 * Extract transcript cues from Echo360 JSON payloads.
 */
function extractEcho360TranscriptCues(raw: unknown): UnknownRecord[] | null {
  const payload = asRecord(raw);
  if (!payload) return null;

  let cuesValue: unknown = payload.cues;

  if (!Array.isArray(cuesValue) && payload.contentJson) {
    try {
      const contentJson =
        typeof payload.contentJson === 'string'
          ? JSON.parse(payload.contentJson)
          : payload.contentJson;
      cuesValue = (contentJson as Record<string, unknown>)?.cues;
    } catch {
      return null;
    }
  }

  if (!Array.isArray(cuesValue)) return null;
  const cues = cuesValue
    .map(cue => asRecord(cue))
    .filter((cue): cue is UnknownRecord => Boolean(cue));
  if (cues.length === 0 && cuesValue.length > 0) return null;
  return cues;
}

/**
 * Parse Echo360 JSON transcript response
 */
export function normalizeEcho360TranscriptJson(raw: unknown): TranscriptResult | null {
  const cues = extractEcho360TranscriptCues(raw);
  if (!cues || cues.length === 0) return null;

  const segments: TranscriptSegment[] = [];

  for (const record of cues) {
    const startMs = Math.max(0, Math.round(
      typeof record.startMs === 'number' ? record.startMs : 
      typeof record.start === 'number' ? record.start : 0
    ));
    const endMs = Math.max(startMs, Math.round(
      typeof record.endMs === 'number' ? record.endMs :
      typeof record.end === 'number' ? record.end : startMs
    ));
    
    const text = cleanText(String(record.content ?? record.text ?? ''));
    if (!text) continue;

    segments.push({
      startMs,
      endMs,
      text,
      speaker: normalizeSpeaker(record.speaker),
      confidence: normalizeConfidence(record.confidence),
    });
  }

  return segments.length > 0 ? buildTranscriptResult(segments) : null;
}

// ============================================================================
// Fetching Utilities
// ============================================================================

// ============================================================================
// Main Resolution Logic
// ============================================================================

/**
 * Resolve complete Echo360 info (lessonId + mediaId) from embed URL
 * Uses multiple strategies:
 * 1. Direct URL parsing
 * 2. Fetch classroom page and extract from HTML
 */
async function resolveEcho360Info(
  embedUrl: string,
  fetcher: AsyncFetcher,
  requestId: string
): Promise<Echo360Info | null> {
  log('info', requestId, 'Resolving Echo360 info', { embedUrl });

  // Strategy 1: Extract directly from URL
  const directInfo = extractEcho360Info(embedUrl);
  log('info', requestId, 'Direct URL extraction', {
    lessonId: directInfo?.lessonId,
    mediaId: directInfo?.mediaId,
    baseUrl: directInfo?.baseUrl,
  });

  if (directInfo?.lessonId && directInfo?.mediaId) {
    log('info', requestId, 'Resolved from direct URL');
    return directInfo;
  }

  // Strategy 2: Fetch classroom page to get mediaId from HTML
  if (directInfo?.lessonId && directInfo?.baseUrl) {
    try {
      const classroomUrl = buildClassroomUrl(directInfo.baseUrl, directInfo.lessonId);
      log('info', requestId, 'Fetching classroom page', { classroomUrl });
      
      const { html, finalUrl } = await fetchHtmlWithRedirect(classroomUrl, fetcher);
      log('info', requestId, 'Classroom page fetched', { 
        htmlLength: html.length, 
        finalUrl 
      });

      const htmlInfo = parseEcho360InfoFromHtml(html, finalUrl);
      if (htmlInfo?.mediaId) {
        const resolved: Echo360Info = {
          lessonId: directInfo.lessonId,
          mediaId: htmlInfo.mediaId,
          baseUrl: directInfo.baseUrl,
        };
        log('info', requestId, 'Resolved mediaId from classroom HTML', { 
          mediaId: resolved.mediaId 
        });
        return resolved;
      }
      
      log('warn', requestId, 'No mediaId found in classroom HTML');
    } catch (error) {
      log('warn', requestId, 'Classroom fetch failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Strategy 2b: Fetch lesson info from API to get mediaId
    try {
      const lessonInfoUrl = buildLessonInfoUrl(directInfo.baseUrl, directInfo.lessonId);
      log('info', requestId, 'Fetching lesson info from API', { lessonInfoUrl });
      
      const lessonData = await fetcher.fetchJson<unknown>(lessonInfoUrl);
      log('info', requestId, 'Lesson info fetched', { 
        hasData: !!lessonData,
        dataType: typeof lessonData,
      });
      
      const mediaId = extractMediaIdFromLessonInfo(lessonData);
      if (mediaId) {
        const resolved: Echo360Info = {
          lessonId: directInfo.lessonId,
          mediaId,
          baseUrl: directInfo.baseUrl,
        };
        log('info', requestId, 'Resolved mediaId from lesson API', { 
          mediaId: resolved.mediaId 
        });
        return resolved;
      }
      
      log('warn', requestId, 'No mediaId found in lesson API response');
    } catch (error) {
      log('warn', requestId, 'Lesson info API fetch failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Strategy 3: Fetch the embed URL directly
  try {
    log('info', requestId, 'Fetching embed URL directly', { embedUrl });
    const { html, finalUrl } = await fetchHtmlWithRedirect(embedUrl, fetcher);
    
    const urlInfo = extractEcho360Info(finalUrl);
    const htmlInfo = parseEcho360InfoFromHtml(html, finalUrl);
    
    const lessonId = urlInfo?.lessonId || htmlInfo?.lessonId || directInfo?.lessonId;
    const mediaId = urlInfo?.mediaId || htmlInfo?.mediaId;
    const baseUrl = urlInfo?.baseUrl || htmlInfo?.baseUrl || directInfo?.baseUrl;

    if (lessonId && mediaId && baseUrl) {
      log('info', requestId, 'Resolved from embed URL fetch', { lessonId, mediaId });
      return { lessonId, mediaId, baseUrl };
    }
  } catch (error) {
    log('warn', requestId, 'Embed URL fetch failed', {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  log('warn', requestId, 'Could not resolve complete Echo360 info');
  return directInfo;
}

// ============================================================================
// Detection
// ============================================================================

function generateVideoId(info: Echo360Info | null, embedUrl: string): string {
  if (info?.mediaId) return info.mediaId;
  if (info?.lessonId) return info.lessonId;
  // Hash the URL for fallback ID
  let hash = 0;
  for (let i = 0; i < embedUrl.length; i++) {
    hash = ((hash << 5) - hash) + embedUrl.charCodeAt(i);
    hash |= 0;
  }
  return `echo_${Math.abs(hash).toString(36)}`;
}

function hasEcho360VideoIdentifiers(info: Echo360Info | null): info is Echo360Info {
  return Boolean(info && (info.lessonId || info.mediaId));
}

export function detectEcho360Videos(context: VideoDetectionContext): DetectedVideo[] {
  const videos: DetectedVideo[] = [];
  const seenIds = new Set<string>();

  const addVideo = (url: string, title: string) => {
    const info = extractEcho360Info(url);
    if (!hasEcho360VideoIdentifiers(info)) return;
    
    const id = generateVideoId(info, url);
    if (seenIds.has(id)) return;
    seenIds.add(id);

    videos.push({
      id,
      provider: 'echo360',
      title: title || `Echo360 video ${videos.length + 1}`,
      embedUrl: url,
      echoLessonId: info.lessonId,
      echoMediaId: info.mediaId,
      echoBaseUrl: info.baseUrl,
    });
  };

  // Check page URL
  if (isEcho360Url(context.pageUrl)) {
    addVideo(context.pageUrl, context.document?.title || '');
  }

  // Check iframes
  for (const iframe of context.iframes) {
    if (iframe.src && isEcho360Url(iframe.src)) {
      addVideo(iframe.src, iframe.title || '');
    }
  }

  return videos;
}

/**
 * Merge syllabus-derived metadata into a sync-detected video.
 */
function mergeSyllabusMetadata(
  syncVideo: DetectedVideo,
  syllabusVideo: DetectedVideo
): DetectedVideo {
  return {
    ...syncVideo,
    id: syllabusVideo.id || syncVideo.id,
    title: syllabusVideo.title || syncVideo.title,
    echoLessonId: syllabusVideo.echoLessonId || syncVideo.echoLessonId,
    echoMediaId: syllabusVideo.echoMediaId || syncVideo.echoMediaId,
    echoBaseUrl: syllabusVideo.echoBaseUrl || syncVideo.echoBaseUrl,
  };
}

/**
 * Match a page-detected video with syllabus metadata.
 */
function findMatchingSyllabusVideo(
  syncVideo: DetectedVideo,
  syllabusVideos: DetectedVideo[],
  requestId: string
): DetectedVideo | null {
  if (syllabusVideos.length === 0) return null;

  const info = extractEcho360Info(syncVideo.embedUrl);
  const mediaId = syncVideo.echoMediaId || info?.mediaId;
  const lessonId = syncVideo.echoLessonId || info?.lessonId;

  if (mediaId) {
    const match = syllabusVideos.find(
      video => video.echoMediaId === mediaId || video.id === mediaId
    );
    if (match) {
      log('debug', requestId, 'Matched syllabus video by mediaId', {
        mediaId,
        syncVideoId: syncVideo.id,
        syllabusVideoId: match.id,
      });
      return match;
    }
  }

  if (lessonId) {
    const match = syllabusVideos.find(
      video => video.echoLessonId === lessonId || video.id === lessonId
    );
    if (match) {
      log('debug', requestId, 'Matched syllabus video by lessonId', {
        lessonId,
        syncVideoId: syncVideo.id,
        syllabusVideoId: match.id,
      });
      return match;
    }
  }

  const embedUrl = syncVideo.embedUrl.toLowerCase();
  const urlMatch = syllabusVideos.find(video => {
    const mediaMatch = video.echoMediaId && embedUrl.includes(video.echoMediaId.toLowerCase());
    const lessonMatch = video.echoLessonId && embedUrl.includes(video.echoLessonId.toLowerCase());
    return Boolean(mediaMatch || lessonMatch);
  });

  if (urlMatch) {
    log('debug', requestId, 'Matched syllabus video by URL', {
      syncVideoId: syncVideo.id,
      syllabusVideoId: urlMatch.id,
    });
    return urlMatch;
  }

  log('debug', requestId, 'No syllabus match for video', { syncVideoId: syncVideo.id });
  return null;
}

// ============================================================================
// Provider Class
// ============================================================================

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

  async detectVideosAsync(
    context: VideoDetectionContext,
    fetcher: AsyncFetcher
  ): Promise<DetectedVideo[]> {
    const requestId = createRequestId();
    log('info', requestId, 'Starting async detection', { pageUrl: context.pageUrl });

    const sectionId = extractSectionId(context.pageUrl);
    let syllabusVideos: DetectedVideo[] = [];

    if (sectionId) {
      log('info', requestId, 'Section ID detected, fetching syllabus', { sectionId });
      syllabusVideos = await fetchVideosFromSyllabus(
        context.pageUrl,
        fetcher,
        requestId
      );
    }

    if (isEcho360SectionPage(context.pageUrl)) {
      if (syllabusVideos.length > 0) {
        log('info', requestId, 'Syllabus detection complete', {
          count: syllabusVideos.length,
          withMediaId: syllabusVideos.filter(v => v.echoMediaId).length,
        });
        return syllabusVideos;
      }

      log('info', requestId, 'No videos from syllabus, falling back to standard detection');
    }

    // Start with sync detection for non-section pages or as fallback
    const syncVideos = detectEcho360Videos(context);
    
    if (syncVideos.length === 0) {
      log('info', requestId, 'No videos found in sync detection');
      return [];
    }

    let matchedCount = 0;
    const mergedVideos = syllabusVideos.length > 0
      ? syncVideos.map(video => {
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

    // Try to resolve missing mediaIds
    const enhancedVideos: DetectedVideo[] = [];
    const seenKeys = new Set<string>();
    
    for (const video of mergedVideos) {
      if (video.echoMediaId) {
        const key =
          getUniqueKey(video.echoMediaId ?? null, video.echoLessonId ?? null) || video.id;
        if (seenKeys.has(key)) continue;
        seenKeys.add(key);
        enhancedVideos.push(video);
        continue;
      }

      // Try to resolve mediaId
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
        getUniqueKey(updated.echoMediaId ?? null, updated.echoLessonId ?? null) ||
        updated.id;
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);
      enhancedVideos.push(updated);
    }

    log('info', requestId, 'Async detection complete', { 
      count: enhancedVideos.length,
      withMediaId: enhancedVideos.filter(v => v.echoMediaId).length,
    });

    return enhancedVideos;
  }

  async extractTranscript(
    video: DetectedVideo,
    fetcher: AsyncFetcher
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
      let baseUrl = video.echoBaseUrl || (() => {
        try { return new URL(video.embedUrl).origin; } 
        catch { return ''; }
      })();

      // Resolve missing IDs if needed
      if (!lessonId || !mediaId) {
        log('info', requestId, 'Resolving missing IDs');
        const resolved = await resolveEcho360Info(video.embedUrl, fetcher, requestId);
        lessonId = lessonId || resolved?.lessonId;
        mediaId = mediaId || resolved?.mediaId;
        baseUrl = baseUrl || resolved?.baseUrl || '';
      }

      // Validate we have required IDs
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

      // Try JSON transcript endpoint
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
          payloadRecord &&
          ('cues' in payloadRecord || 'contentJson' in payloadRecord);
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

      // Try VTT format
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

      // Try text format
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
          const transcript = buildTranscriptResult([
            { startMs: 0, endMs: null, text: plainText },
          ]);
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
