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

// HTML5 Detection Functions

function resolveUrl(
  candidate: string | null | undefined,
  baseUrl: string
): string | null {
  if (!candidate) return null;
  try {
    return new URL(candidate, baseUrl).toString();
  } catch {
    return null;
  }
}

function getElementLabel(el: Element | null): string | null {
  if (!el) return null;
  const label =
    el.getAttribute('data-title') ||
    el.getAttribute('aria-label') ||
    el.getAttribute('title');
  return label ? label.trim() : null;
}

function getClosestContainerTitle(video: HTMLVideoElement): string | null {
  let current: Element | null = video.parentElement;
  let depth = 0;
  while (current && depth < 4) {
    const label = getElementLabel(current);
    if (label) return label;

    const figcaption = current.querySelector('figcaption');
    const figcaptionText = figcaption?.textContent?.trim();
    if (figcaptionText) return figcaptionText;

    const heading = current.querySelector('h1,h2,h3,h4,h5,h6');
    const headingText = heading?.textContent?.trim();
    if (headingText) return headingText;

    current = current.parentElement;
    depth += 1;
  }
  return null;
}

function getFilenameTitle(mediaUrl: string | null): string | null {
  if (!mediaUrl) return null;
  try {
    const url = new URL(mediaUrl);
    const filename = url.pathname.split('/').pop();
    if (!filename) return null;
    const decoded = decodeURIComponent(filename);
    const withoutExt = decoded.replace(/\.[a-z0-9]+$/i, '');
    return withoutExt.trim() || null;
  } catch {
    return null;
  }
}

function getVideoTitle(
  video: HTMLVideoElement,
  mediaUrl: string | null,
  index: number
): string {
  const directTitle = getElementLabel(video);
  if (directTitle) return directTitle;

  const containerTitle = getClosestContainerTitle(video);
  if (containerTitle) return containerTitle;

  const filenameTitle = getFilenameTitle(mediaUrl);
  if (filenameTitle) return filenameTitle;

  return `HTML5 video ${index + 1}`;
}

function getVideoDurationMs(video: HTMLVideoElement): number | undefined {
  const duration = video.duration;
  if (Number.isFinite(duration) && duration > 0) {
    return Math.round(duration * 1000);
  }
  return undefined;
}

function getMediaUrl(video: HTMLVideoElement, baseUrl: string): string | null {
  console.log('[Lock-in Transcript] getMediaUrl for video:', video.id || '(no id)');
  
  const currentSrc = video.currentSrc || undefined;
  console.log('[Lock-in Transcript] currentSrc:', currentSrc || '(none)');
  if (currentSrc) return currentSrc;

  const srcAttr = video.getAttribute('src');
  console.log('[Lock-in Transcript] src attribute:', srcAttr || '(none)');
  if (srcAttr) {
    const resolved = resolveUrl(srcAttr, baseUrl);
    if (resolved) return resolved;
  }

  const srcProp = video.src;
  console.log('[Lock-in Transcript] src property:', srcProp || '(none)');
  if (srcProp) return srcProp;

  // Check for <source> elements (common pattern for HTML5 video)
  const sourceEl = video.querySelector('source[src]') as HTMLSourceElement | null;
  if (sourceEl) {
    const sourceSrc = sourceEl.getAttribute('src') || sourceEl.src;
    console.log('[Lock-in Transcript] <source> src:', sourceSrc || '(none)');
    const resolved = resolveUrl(sourceSrc, baseUrl);
    if (resolved) return resolved;
  } else {
    console.log('[Lock-in Transcript] No <source> element found');
  }

  // Check for video.js or Moodle media plugin lazy-load configuration
  // These players store the source URL in a data attribute
  const dataSetupLazy = video.getAttribute('data-setup-lazy');
  if (dataSetupLazy) {
    console.log('[Lock-in Transcript] Found data-setup-lazy attribute');
    // The parent container might have the actual video source info
    const container = video.closest('.mediaplugin_videojs, .video-js');
    if (container) {
      const sourceInContainer = container.querySelector('source[src]') as HTMLSourceElement | null;
      if (sourceInContainer) {
        const src = sourceInContainer.getAttribute('src') || sourceInContainer.src;
        console.log('[Lock-in Transcript] Found source in container:', src);
        const resolved = resolveUrl(src, baseUrl);
        if (resolved) return resolved;
      }
    }
  }

  console.log('[Lock-in Transcript] No media URL found for video');
  return null;
}

function getTrackUrls(
  video: HTMLVideoElement,
  baseUrl: string
): Array<{ kind: string; label?: string; srclang?: string; src: string }> {
  const tracks = Array.from(
    video.querySelectorAll('track')
  ) as HTMLTrackElement[];
  const results: Array<{
    kind: string;
    label?: string;
    srclang?: string;
    src: string;
  }> = [];

  for (const track of tracks) {
    const kind = (track.getAttribute('kind') || track.kind || '').toLowerCase();
    if (kind !== 'captions' && kind !== 'subtitles') continue;

    const srcAttr = track.getAttribute('src') || track.src;
    const resolved = resolveUrl(srcAttr, baseUrl);
    if (!resolved) continue;

    results.push({
      kind,
      label: track.label || undefined,
      srclang: track.srclang || undefined,
      src: resolved,
    });
  }

  return results;
}

function getDrmInfo(
  video: HTMLVideoElement
): { detected: boolean; reason?: string } {
  if (video.mediaKeys) {
    return { detected: true, reason: 'mediaKeys' };
  }

  const webkitKeys = (video as { webkitKeys?: unknown }).webkitKeys;
  if (webkitKeys) {
    return { detected: true, reason: 'webkitKeys' };
  }

  const encryptedAttr = video.getAttribute('data-lockin-encrypted');
  if (encryptedAttr === 'true') {
    return { detected: true, reason: 'encrypted-event' };
  }

  return { detected: false };
}

function buildDomSelector(element: Element): string | undefined {
  const id = (element as HTMLElement).id;
  if (id) return `#${id}`;

  const segments: string[] = [];
  let current: Element | null = element;
  let depth = 0;

  while (current && depth < 4) {
    const tagName = current.tagName.toLowerCase();
    const currentTagName = current.tagName;
    const parent: Element | null = current.parentElement;
    if (!parent) {
      segments.unshift(tagName);
      break;
    }

    const siblings = Array.from(parent.children) as Element[];
    const sameTagSiblings = siblings.filter(
      (child) => child.tagName === currentTagName
    );
    const index = sameTagSiblings.indexOf(current);
    const suffix =
      sameTagSiblings.length > 1 ? `:nth-of-type(${index + 1})` : '';
    segments.unshift(`${tagName}${suffix}`);

    current = parent;
    depth += 1;
  }

  return segments.length > 0 ? segments.join(' > ') : undefined;
}

function hashString(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

export function detectHtml5Videos(
  context: VideoDetectionContext
): DetectedVideo[] {
  console.log('[Lock-in Transcript] detectHtml5Videos called');
  console.log('[Lock-in Transcript] Context pageUrl:', context.pageUrl);
  
  const doc = context.document;
  if (!doc) {
    console.warn('[Lock-in Transcript] No document in context - cannot detect HTML5 videos');
    return [];
  }

  const baseUrl = doc.baseURI || context.pageUrl;
  console.log('[Lock-in Transcript] Document baseURI:', baseUrl);
  
  const videoElements = Array.from(
    doc.querySelectorAll('video')
  ) as HTMLVideoElement[];
  console.log('[Lock-in Transcript] Found', videoElements.length, 'video elements in DOM');
  
  // Also check for video.js players which might wrap videos in specific containers
  const videojsContainers = doc.querySelectorAll('.video-js, .mediaplugin_videojs');
  console.log('[Lock-in Transcript] Found', videojsContainers.length, 'video.js containers');
  
  // Log details of each video element found
  videoElements.forEach((v, i) => {
    const sources = Array.from(v.querySelectorAll('source')).map(s => ({
      src: s.getAttribute('src') || s.src,
      type: s.getAttribute('type') || s.type,
    }));
    const tracks = Array.from(v.querySelectorAll('track')).map(t => ({
      kind: t.getAttribute('kind') || t.kind,
      src: t.getAttribute('src') || t.src,
      label: t.label,
    }));
    const parent = v.parentElement;
    const isInVideoJs = !!v.closest('.video-js, .mediaplugin_videojs');
    
    console.log(`[Lock-in Transcript] Video ${i + 1}:`, {
      id: v.id || '(no id)',
      className: v.className || '(no class)',
      src: v.getAttribute('src') || '(no src attr)',
      srcProp: v.src || '(no src prop)',
      currentSrc: v.currentSrc || '(no currentSrc)',
      readyState: v.readyState,
      networkState: v.networkState,
      sources,
      tracks,
      isInVideoJs,
      parentTag: parent?.tagName || '(no parent)',
      parentClass: parent?.className || '(no parent class)',
      dataSetupLazy: v.getAttribute('data-setup-lazy') ? 'present' : '(none)',
    });
  });
  
  const videos: DetectedVideo[] = [];

  for (let index = 0; index < videoElements.length; index += 1) {
    const video = videoElements[index];
    const mediaUrl = getMediaUrl(video, baseUrl);
    const trackUrls = getTrackUrls(video, baseUrl);
    const domId = video.id || undefined;
    const domSelector = buildDomSelector(video);
    const title = getVideoTitle(video, mediaUrl, index);
    const durationMs = getVideoDurationMs(video);
    const drmInfo = getDrmInfo(video);
    const drmFields = drmInfo.detected
      ? { drmDetected: true, drmReason: drmInfo.reason }
      : {};

    const idSource = mediaUrl ? `${mediaUrl}_${index}` : `video_${index}`;
    const id = domId || `html5_${hashString(idSource)}`;

    const detectedVideo: DetectedVideo = {
      id,
      provider: 'html5',
      title,
      embedUrl: mediaUrl || context.pageUrl,
      mediaUrl: mediaUrl || undefined,
      domId,
      domSelector,
      durationMs,
      ...drmFields,
      trackUrls: trackUrls.length > 0 ? trackUrls : undefined,
    };
    
    console.log('[Lock-in Transcript] Detected HTML5 video:', detectedVideo);
    videos.push(detectedVideo);
  }

  console.log('[Lock-in Transcript] Total HTML5 videos detected:', videos.length);
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
  console.log('[Lock-in Transcript] detectVideosSync called');
  console.log('[Lock-in Transcript] Page URL:', context.pageUrl);
  console.log('[Lock-in Transcript] Iframes found:', context.iframes.length);
  console.log('[Lock-in Transcript] Document available:', !!context.document);
  
  // Check for Echo360 page first
  const echo360Context = extractEcho360Context(context.pageUrl);
  if (echo360Context) {
    console.log('[Lock-in Transcript] Echo360 context detected:', echo360Context);
    const pageType = getEcho360PageType(echo360Context);
    console.log('[Lock-in Transcript] Echo360 page type:', pageType);

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
  console.log('[Lock-in Transcript] Checking for Panopto videos...');
  const panoptoVideos = detectPanoptoVideosFromIframes(
    context.iframes,
    context.pageUrl
  );
  console.log('[Lock-in Transcript] Panopto videos found:', panoptoVideos.length);
  if (panoptoVideos.length > 0) {
    return {
      videos: panoptoVideos,
      provider: 'panopto',
      requiresApiCall: false,
    };
  }

  // Check for HTML5 video elements
  console.log('[Lock-in Transcript] Checking for HTML5 videos...');
  const html5Videos = detectHtml5Videos(context);
  console.log('[Lock-in Transcript] HTML5 videos found:', html5Videos.length);
  if (html5Videos.length > 0) {
    return {
      videos: html5Videos,
      provider: 'html5',
      requiresApiCall: false,
    };
  }

  // No videos detected
  console.log('[Lock-in Transcript] No videos detected on page');
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
  if (depth > MAX_IFRAME_DEPTH) {
    console.log('[Lock-in Transcript] collectIframeInfo: max depth reached');
    return [];
  }

  const iframes = Array.from(
    doc.querySelectorAll('iframe')
  ) as HTMLIFrameElement[];
  
  if (depth === 0) {
    console.log('[Lock-in Transcript] collectIframeInfo: found', iframes.length, 'iframes at depth', depth);
  }
  
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
      // Cross-origin iframe - skip (this is expected and normal)
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

