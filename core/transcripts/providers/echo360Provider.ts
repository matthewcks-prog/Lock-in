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
import { hasRedirectSupport } from '../fetchers/types';
import { parseWebVtt } from '../webvttParser';

// ============================================================================
// Constants
// ============================================================================

const LOG_PREFIX = '[Lock-in Transcript:Echo360]';

const ECHO360_DOMAIN_SUFFIXES = [
  'echo360.org',
  'echo360.org.au',
  'echo360.net.au',
  'echo360.ca',
  'echo360.org.uk',
  'echo360qa.org',
  'echo360qa.dev',
];

// ============================================================================
// Types
// ============================================================================

export interface Echo360Info {
  lessonId?: string;
  mediaId?: string;
  baseUrl: string;
}

/**
 * Echo360 syllabus API response types
 */
interface Echo360SyllabusMedia {
  id: string;
  mediaType?: string;
  title?: string;
  isAvailable?: boolean;
}

interface Echo360SyllabusLesson {
  id: string;
  name?: string;
  displayName?: string;
  timing?: {
    start?: string;
    end?: string;
  };
}

interface Echo360SyllabusEntry {
  lesson: Echo360SyllabusLesson;
  medias: Echo360SyllabusMedia[];
}

interface Echo360SyllabusResponse {
  status?: string;
  message?: string;
  data?: Echo360SyllabusEntry[];
}

/**
 * Extract section ID from Echo360 URL
 * URL format: /section/{sectionId}/* or /section/{sectionId}
 */
export function extractSectionId(url: string): string | null {
  try {
    const parsed = new URL(url);
    // Match /section/{uuid}
    const match = parsed.pathname.match(
      /\/section\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i
    );
    return match ? match[1].toLowerCase() : null;
  } catch {
    return null;
  }
}

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

/**
 * Build syllabus API URL
 * Format: /section/{sectionId}/syllabus
 */
function buildSyllabusUrl(baseUrl: string, sectionId: string): string {
  return `${baseUrl}/section/${encodeURIComponent(sectionId)}/syllabus`;
}

/**
 * Build lesson page URL for a specific lesson
 */
function buildLessonPageUrl(baseUrl: string, lessonId: string): string {
  return `${baseUrl}/lesson/${encodeURIComponent(lessonId)}/classroom`;
}

/**
 * Parse syllabus response and extract video information
 */
function parseSyllabusResponse(
  response: unknown,
  baseUrl: string,
  requestId: string
): DetectedVideo[] {
  const videos: DetectedVideo[] = [];
  const seenIds = new Set<string>();

  if (!response || typeof response !== 'object') {
    log('warn', requestId, 'Invalid syllabus response', { responseType: typeof response });
    return videos;
  }

  const syllabusData = response as Echo360SyllabusResponse;
  
  if (syllabusData.status !== 'ok' || !Array.isArray(syllabusData.data)) {
    log('warn', requestId, 'Syllabus response not ok or no data', { 
      status: syllabusData.status,
      hasData: Array.isArray(syllabusData.data),
    });
    return videos;
  }

  for (const entry of syllabusData.data) {
    if (!entry.lesson?.id) continue;
    
    const lessonId = entry.lesson.id;
    const lessonName = entry.lesson.displayName || entry.lesson.name || '';
    
    // Get timing info for display
    const timing = entry.lesson.timing;
    let dateStr = '';
    if (timing?.start) {
      try {
        const date = new Date(timing.start);
        dateStr = date.toLocaleDateString(undefined, { 
          month: 'short', 
          day: 'numeric',
          year: 'numeric',
        });
      } catch {
        // Ignore date parsing errors
      }
    }
    
    // Process each media in the lesson
    if (Array.isArray(entry.medias) && entry.medias.length > 0) {
      for (const media of entry.medias) {
        if (!media.id) continue;
        
        // Skip unavailable media
        if (media.isAvailable === false) continue;
        
        const mediaId = media.id.toLowerCase();
        if (seenIds.has(mediaId)) continue;
        seenIds.add(mediaId);

        // Build a descriptive title
        const mediaTitle = media.title || lessonName;
        const titleWithDate = dateStr && mediaTitle 
          ? `${mediaTitle} - ${dateStr}`
          : mediaTitle || `Echo360 video`;

        videos.push({
          id: mediaId,
          provider: 'echo360',
          title: titleWithDate,
          embedUrl: buildLessonPageUrl(baseUrl, lessonId),
          echoLessonId: lessonId,
          echoMediaId: mediaId,
          echoBaseUrl: baseUrl,
        });
      }
    } else {
      // Lesson without explicit medias - add the lesson itself
      // Some lessons may only show media after opening
      if (seenIds.has(lessonId)) continue;
      seenIds.add(lessonId);
      
      const titleWithDate = dateStr && lessonName 
        ? `${lessonName} - ${dateStr}`
        : lessonName || `Echo360 lesson`;

      videos.push({
        id: lessonId,
        provider: 'echo360',
        title: titleWithDate,
        embedUrl: buildLessonPageUrl(baseUrl, lessonId),
        echoLessonId: lessonId,
        echoMediaId: undefined, // Will be resolved when extracting transcript
        echoBaseUrl: baseUrl,
      });
    }
  }

  log('info', requestId, 'Parsed syllabus videos', { 
    count: videos.length,
    entriesProcessed: syllabusData.data.length,
  });

  return videos;
}

/**
 * Fetch videos from Echo360 syllabus API
 */
async function fetchVideosFromSyllabus(
  pageUrl: string,
  fetcher: AsyncFetcher,
  requestId: string
): Promise<DetectedVideo[]> {
  const sectionId = extractSectionId(pageUrl);
  if (!sectionId) {
    log('info', requestId, 'Not a section page, skipping syllabus fetch');
    return [];
  }

  try {
    const parsed = new URL(pageUrl);
    const baseUrl = parsed.origin;
    const syllabusUrl = buildSyllabusUrl(baseUrl, sectionId);
    
    log('info', requestId, 'Fetching syllabus API', { syllabusUrl, sectionId });
    
    const syllabusData = await fetcher.fetchJson<unknown>(syllabusUrl);
    return parseSyllabusResponse(syllabusData, baseUrl, requestId);
  } catch (error) {
    log('warn', requestId, 'Failed to fetch syllabus', {
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

// ============================================================================
// Logging Utilities
// ============================================================================

function createRequestId(): string {
  return `echo360-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function log(level: 'info' | 'warn' | 'error', requestId: string, message: string, meta?: Record<string, unknown>): void {
  const logFn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.info;
  const msg = `${LOG_PREFIX} [${requestId}] ${message}`;
  meta ? logFn(msg, meta) : logFn(msg);
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
    // id property in media objects
    /"id"\s*:\s*"([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})"/i,
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
 * Parse Echo360 JSON transcript response
 */
export function normalizeEcho360TranscriptJson(raw: unknown): TranscriptResult | null {
  if (!raw || typeof raw !== 'object') return null;

  const payload = raw as Record<string, unknown>;
  
  // Find cues array - can be at different locations in response
  let cues: unknown[] | undefined;
  
  if (Array.isArray(payload.cues)) {
    cues = payload.cues;
  } else if (payload.contentJson) {
    try {
      const contentJson = typeof payload.contentJson === 'string' 
        ? JSON.parse(payload.contentJson) 
        : payload.contentJson;
      cues = (contentJson as Record<string, unknown>)?.cues as unknown[];
    } catch {
      // JSON parse failed, cues remains undefined
    }
  }

  if (!Array.isArray(cues) || cues.length === 0) return null;

  const segments: TranscriptSegment[] = [];

  for (const cue of cues) {
    if (!cue || typeof cue !== 'object') continue;
    
    const record = cue as Record<string, unknown>;
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

async function fetchHtmlWithRedirect(
  url: string,
  fetcher: AsyncFetcher
): Promise<{ html: string; finalUrl: string }> {
  if (hasRedirectSupport(fetcher) && fetcher.fetchHtmlWithRedirectInfo) {
    const result = await fetcher.fetchHtmlWithRedirectInfo(url);
    return { html: result.html, finalUrl: result.finalUrl || url };
  }
  const html = await fetcher.fetchWithCredentials(url);
  return { html, finalUrl: url };
}

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

export function detectEcho360Videos(context: VideoDetectionContext): DetectedVideo[] {
  const videos: DetectedVideo[] = [];
  const seenIds = new Set<string>();

  const addVideo = (url: string, title: string) => {
    const info = extractEcho360Info(url);
    if (!info) return;
    
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

    // Check if we're on a section/course listing page
    // If so, fetch videos from the syllabus API
    if (isEcho360SectionPage(context.pageUrl)) {
      log('info', requestId, 'Detected section page, fetching syllabus');
      const syllabusVideos = await fetchVideosFromSyllabus(
        context.pageUrl,
        fetcher,
        requestId
      );
      
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

    // Try to resolve missing mediaIds
    const enhancedVideos: DetectedVideo[] = [];
    
    for (const video of syncVideos) {
      if (video.echoMediaId) {
        enhancedVideos.push(video);
        continue;
      }

      // Try to resolve mediaId
      const resolved = await resolveEcho360Info(video.embedUrl, fetcher, requestId);
      if (resolved?.mediaId) {
        enhancedVideos.push({
          ...video,
          echoMediaId: resolved.mediaId,
          echoLessonId: resolved.lessonId || video.echoLessonId,
          echoBaseUrl: resolved.baseUrl || video.echoBaseUrl,
        });
      } else {
        enhancedVideos.push(video);
      }
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

      // Try JSON transcript endpoint
      const jsonUrl = buildTranscriptUrl(baseUrl, lessonId, mediaId);
      log('info', requestId, 'Trying JSON endpoint', { url: jsonUrl });

      try {
        const jsonPayload = await fetcher.fetchJson<unknown>(jsonUrl);
        const transcript = normalizeEcho360TranscriptJson(jsonPayload);
        if (transcript && transcript.segments.length > 0) {
          log('info', requestId, 'JSON transcript extracted', {
            segments: transcript.segments.length,
          });
          return { success: true, transcript };
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
      }

      // Try VTT format
      const vttUrl = buildTranscriptFileUrl(baseUrl, lessonId, mediaId, 'vtt');
      log('info', requestId, 'Trying VTT endpoint', { url: vttUrl });

      try {
        const vttContent = await fetcher.fetchWithCredentials(vttUrl);
        const transcript = parseWebVtt(vttContent);
        if (transcript.segments.length > 0) {
          log('info', requestId, 'VTT transcript extracted', {
            segments: transcript.segments.length,
          });
          return { success: true, transcript };
        }
      } catch (error) {
        log('warn', requestId, 'VTT endpoint failed', {
          error: error instanceof Error ? error.message : String(error),
        });
      }

      // Try text format
      const textUrl = buildTranscriptFileUrl(baseUrl, lessonId, mediaId, 'text');
      log('info', requestId, 'Trying text endpoint', { url: textUrl });

      try {
        const textContent = await fetcher.fetchWithCredentials(textUrl);
        const plainText = cleanText(textContent);
        if (plainText) {
          const transcript = buildTranscriptResult([
            { startMs: 0, endMs: null, text: plainText },
          ]);
          log('info', requestId, 'Text transcript extracted');
          return { success: true, transcript };
        }
      } catch (error) {
        log('warn', requestId, 'Text endpoint failed', {
          error: error instanceof Error ? error.message : String(error),
        });
      }

      log('warn', requestId, 'No transcript available');
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
