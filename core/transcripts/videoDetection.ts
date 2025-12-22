/**
 * Video Detection Module
 *
 * Pure functions for detecting videos on pages.
 * No Chrome dependencies - can be tested without browser.
 */

import type {
  DetectedVideo,
  VideoDetectionContext,
  Echo360Context,
  VideoProvider,
} from './types';

// Import from provider for local use
import {
  ECHO360_HOSTS as _ECHO360_HOSTS,
  isEcho360Domain as _isEcho360Domain,
} from './providers/echo360Provider';

// Re-export for backwards compatibility
export const ECHO360_HOSTS = _ECHO360_HOSTS;
export const isEcho360Domain = _isEcho360Domain;

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/** Maximum iframe nesting depth to search */
export const MAX_IFRAME_DEPTH = 3;

/** Regex patterns for Panopto URLs */
export const PANOPTO_URL_PATTERNS = [
  /https?:\/\/([^/]+\.panopto\.com)\/Panopto\/Pages\/Embed\.aspx\?.*\bid=([a-f0-9-]+)/i,
  /https?:\/\/([^/]+\.panopto\.com)\/Panopto\/Pages\/Viewer\.aspx\?.*\bid=([a-f0-9-]+)/i,
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Panopto Types
// ─────────────────────────────────────────────────────────────────────────────

export interface PanoptoInfo {
  deliveryId: string;
  tenant: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Echo360 Detection Functions
// ─────────────────────────────────────────────────────────────────────────────

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
 * Extract Echo360 context from current page URL
 * Uses multiple strategies for robustness across different university configurations
 */
export function extractEcho360Context(url: string): Echo360Context | null {
  try {
    const urlObj = new URL(url);
    if (!isEcho360Domain(urlObj.hostname)) {
      return null;
    }

    const echoOrigin = urlObj.origin;
    const pathname = urlObj.pathname;

    // Strategy 1: Extract section ID from URL path
    // Section IDs are typically UUIDs: /section/{uuid}/...
    const sectionMatch = pathname.match(/\/section\/([^/]+)/i);
    const sectionId = sectionMatch
      ? decodeURIComponent(sectionMatch[1])
      : undefined;

    // Strategy 2: Extract lesson ID from URL path
    // Lesson IDs can vary widely: UUIDs, compound IDs, or other formats
    // Use permissive regex that captures everything until next slash
    const lessonMatch = pathname.match(/\/lesson\/([^/]+)/i);
    let lessonId = lessonMatch ? decodeURIComponent(lessonMatch[1]) : undefined;

    // Strategy 3: Try to get lesson/media info from query params (some Echo360 configs use this)
    const mediaId =
      urlObj.searchParams.get('mediaId') ||
      urlObj.searchParams.get('media') ||
      urlObj.searchParams.get('mid') ||
      undefined;

    // Strategy 4: Check for lesson ID in query params as fallback
    if (!lessonId) {
      lessonId =
        urlObj.searchParams.get('lessonId') ||
        urlObj.searchParams.get('lesson') ||
        urlObj.searchParams.get('lid') ||
        undefined;
    }

    // Strategy 5: Check hash fragment (some single-page app configs)
    if (!lessonId && !sectionId && urlObj.hash) {
      const hashLessonMatch = urlObj.hash.match(/lesson[=/]([^&/#]+)/i);
      if (hashLessonMatch) {
        lessonId = decodeURIComponent(hashLessonMatch[1]);
      }
    }

    return {
      echoOrigin,
      sectionId,
      lessonId,
      mediaId,
    };
  } catch {
    return null;
  }
}

/**
 * Determine the type of Echo360 page from context
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
// Panopto Detection Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract video ID and tenant from a Panopto URL.
 */
export function extractPanoptoInfo(url: string): PanoptoInfo | null {
  for (const pattern of PANOPTO_URL_PATTERNS) {
    const match = url.match(pattern);
    if (match) {
      return { deliveryId: match[2], tenant: match[1] };
    }
  }
  return null;
}

/**
 * Check if URL is a Panopto URL
 */
export function isPanoptoUrl(url: string): boolean {
  return PANOPTO_URL_PATTERNS.some((pattern) => pattern.test(url));
}

/**
 * Detect Panopto videos from iframe list
 */
export function detectPanoptoVideosFromIframes(
  iframes: VideoDetectionContext['iframes'],
  pageUrl?: string
): DetectedVideo[] {
  const videos: DetectedVideo[] = [];
  const seenIds = new Set<string>();
  let videoIndex = 0;

  // Helper to add video if not already seen
  const addVideo = (
    info: PanoptoInfo,
    title: string,
    embedUrl: string
  ): void => {
    if (seenIds.has(info.deliveryId)) return;
    seenIds.add(info.deliveryId);
    videoIndex++;
    videos.push({
      id: info.deliveryId,
      provider: 'panopto',
      title: title || `Panopto video ${videoIndex}`,
      embedUrl,
    });
  };

  // Check current page URL if provided
  if (pageUrl) {
    const pageInfo = extractPanoptoInfo(pageUrl);
    if (pageInfo) {
      addVideo(pageInfo, '', pageUrl);
    }
  }

  // Check all iframes
  for (const iframe of iframes) {
    if (!iframe.src) continue;
    const info = extractPanoptoInfo(iframe.src);
    if (info) {
      addVideo(info, iframe.title || '', iframe.src);
    }
  }

  return videos;
}

// ─────────────────────────────────────────────────────────────────────────────
// Unified Detection
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Result of synchronous video detection
 */
export interface VideoDetectionResult {
  /** Detected videos (may be empty if API call required) */
  videos: DetectedVideo[];
  /** Which provider was detected */
  provider: VideoProvider | null;
  /** Whether an API call is required to get full video list */
  requiresApiCall: boolean;
  /** Echo360 context if detected */
  echo360Context?: Echo360Context;
}

/**
 * Detect videos synchronously from page context.
 * For Echo360 section pages, returns requiresApiCall=true
 * and the caller must fetch the syllabus via background script.
 */
export function detectVideosSync(
  context: VideoDetectionContext
): VideoDetectionResult {
  // Check for Echo360 page first
  const echo360Context = extractEcho360Context(context.pageUrl);
  if (echo360Context) {
    const pageType = getEcho360PageType(echo360Context);

    if (pageType === 'lesson') {
      // Lesson page - can create single video entry directly
      // Note: mediaId may need to be extracted from DOM separately
      const video: DetectedVideo = {
        id: echo360Context.lessonId!,
        provider: 'echo360',
        title: '', // Will be filled by caller with page title
        embedUrl: context.pageUrl,
        echoOrigin: echo360Context.echoOrigin,
        lessonId: echo360Context.lessonId,
        mediaId: echo360Context.mediaId,
      };
      return {
        videos: [video],
        provider: 'echo360',
        requiresApiCall: false,
        echo360Context,
      };
    }

    if (pageType === 'section') {
      // Section page - need API call to get video list
      return {
        videos: [],
        provider: 'echo360',
        requiresApiCall: true,
        echo360Context,
      };
    }
  }

  // Check for Panopto videos
  const panoptoVideos = detectPanoptoVideosFromIframes(
    context.iframes,
    context.pageUrl
  );
  if (panoptoVideos.length > 0) {
    return {
      videos: panoptoVideos,
      provider: 'panopto',
      requiresApiCall: false,
    };
  }

  // No videos detected
  return {
    videos: [],
    provider: null,
    requiresApiCall: false,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// DOM Helpers (for use in content scripts)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Collect iframe information from a document.
 * This should be called from content script context where document is available.
 */
export function collectIframeInfo(
  doc: Document,
  depth = 0
): VideoDetectionContext['iframes'] {
  if (depth > MAX_IFRAME_DEPTH) return [];

  const iframes = Array.from(
    doc.querySelectorAll('iframe')
  ) as HTMLIFrameElement[];
  const result: VideoDetectionContext['iframes'] = [];

  for (const iframe of iframes) {
    const src =
      iframe.src || iframe.getAttribute('data-src') || iframe.dataset.src || '';
    if (src) {
      result.push({
        src,
        title: iframe.title || undefined,
      });
    }

    // Try to collect from nested iframes (same-origin only)
    try {
      const innerDoc = iframe.contentDocument;
      if (innerDoc) {
        result.push(...collectIframeInfo(innerDoc, depth + 1));
      }
    } catch {
      // Cross-origin iframe - skip
    }
  }

  return result;
}

/**
 * Build detection context from current document.
 * This should be called from content script context.
 */
export function buildDetectionContext(doc: Document): VideoDetectionContext {
  return {
    pageUrl: doc.location.href,
    iframes: collectIframeInfo(doc),
    document: doc,
  };
}

