/**
 * Video Detection Module
 *
 * Pure functions for detecting videos on pages.
 * No Chrome dependencies - can be tested without browser.
 */

import type {
  DetectedVideo,
  VideoDetectionContext,
  VideoProvider,
} from './types';

import {
  extractPanoptoInfo as _extractPanoptoInfo,
  isPanoptoUrl as _isPanoptoUrl,
  buildPanoptoEmbedUrl,
  type PanoptoInfo,
} from './providers/panoptoProvider';
import {
  detectEcho360Videos as _detectEcho360Videos,
} from './providers/echo360Provider';

// Re-export Panopto functions for backwards compatibility
export const extractPanoptoInfo = _extractPanoptoInfo;
export const isPanoptoUrl = _isPanoptoUrl;
export type { PanoptoInfo };

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/** Maximum iframe nesting depth to search */
export const MAX_IFRAME_DEPTH = 3;

// ─────────────────────────────────────────────────────────────────────────────
// Panopto Detection Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Detect Panopto videos from iframe list
 * Note: This is a legacy function. For comprehensive detection,
 * use detectVideosSync() or PanoptoProvider.detectVideosSync().
 */
export function detectPanoptoVideosFromIframes(
  iframes: VideoDetectionContext['iframes'],
  pageUrl?: string
): DetectedVideo[] {
  const videos: DetectedVideo[] = [];
  const seenIds = new Set<string>();

  const addVideo = (info: PanoptoInfo, title: string): void => {
    if (seenIds.has(info.deliveryId)) return;
    seenIds.add(info.deliveryId);
    const embedUrl = buildPanoptoEmbedUrl(info.tenant, info.deliveryId);
    videos.push({
      id: info.deliveryId,
      provider: 'panopto',
      title: title || `Panopto video ${videos.length + 1}`,
      embedUrl,
      panoptoTenant: info.tenant,
    });
  };

  // Check current page URL if provided
  if (pageUrl) {
    const pageInfo = extractPanoptoInfo(pageUrl);
    if (pageInfo) {
      addVideo(pageInfo, '');
    }
  }

  // Check all iframes
  for (const iframe of iframes) {
    if (!iframe.src) continue;
    const info = extractPanoptoInfo(iframe.src);
    if (info) {
      addVideo(info, iframe.title || '');
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

function isElementVisible(element: Element | null): boolean {
  if (!element) return false;
  if (element.hasAttribute('hidden')) return false;
  if (element.closest('[hidden]')) return false;
  if (element.getAttribute('aria-hidden') === 'true') return false;
  if (element.closest('[aria-hidden="true"]')) return false;

  const details = element.closest('details');
  if (details && !details.hasAttribute('open')) {
    const summary = element.closest('summary');
    if (!summary || summary.parentElement !== details) {
      return false;
    }
  }

  // Check inline style attribute directly (works in jsdom)
  const inlineStyle = (element as HTMLElement).style;
  if (inlineStyle) {
    if (inlineStyle.display === 'none') return false;
    if (inlineStyle.visibility === 'hidden' || inlineStyle.visibility === 'collapse') return false;
    const opacity = Number.parseFloat(inlineStyle.opacity || '1');
    if (Number.isFinite(opacity) && opacity <= 0) return false;
  }

  // Also check computed style (for CSS classes, etc.)
  const view = element.ownerDocument?.defaultView;
  if (view && typeof view.getComputedStyle === 'function') {
    const style = view.getComputedStyle(element);
    if (style) {
      if (style.display === 'none') return false;
      if (style.visibility === 'hidden' || style.visibility === 'collapse') return false;
      const opacity = Number.parseFloat(style.opacity || '1');
      if (Number.isFinite(opacity) && opacity <= 0) return false;
    }
  }

  return true;
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
  const currentSrc = video.currentSrc || undefined;
  if (currentSrc) return currentSrc;

  const srcAttr = video.getAttribute('src');
  if (srcAttr) {
    const resolved = resolveUrl(srcAttr, baseUrl);
    if (resolved) return resolved;
  }

  const srcProp = video.src;
  if (srcProp) return srcProp;

  // Check for <source> elements (common pattern for HTML5 video)
  const sourceEl = video.querySelector('source[src]') as HTMLSourceElement | null;
  if (sourceEl) {
    const sourceSrc = sourceEl.getAttribute('src') || sourceEl.src;
    const resolved = resolveUrl(sourceSrc, baseUrl);
    if (resolved) return resolved;
  }

  // Check for video.js or Moodle media plugin lazy-load configuration
  // These players store the source URL in a data attribute
  const dataSetupLazy = video.getAttribute('data-setup-lazy');
  if (dataSetupLazy) {
    // The parent container might have the actual video source info
    const container = video.closest('.mediaplugin_videojs, .video-js');
    if (container) {
      const sourceInContainer = container.querySelector('source[src]') as HTMLSourceElement | null;
      if (sourceInContainer) {
        const src = sourceInContainer.getAttribute('src') || sourceInContainer.src;
        const resolved = resolveUrl(src, baseUrl);
        if (resolved) return resolved;
      }
    }
  }

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
  const doc = context.document;
  if (!doc) {
    return [];
  }

  const baseUrl = doc.baseURI || context.pageUrl;
  const videoElements = Array.from(
    doc.querySelectorAll('video')
  ).filter((video) => isElementVisible(video)) as HTMLVideoElement[];
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
    videos.push(detectedVideo);
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
}

/**
 * Detect videos synchronously from page context.
 */
export function detectVideosSync(
  context: VideoDetectionContext
): VideoDetectionResult {
  // Check for Panopto videos via embedded iframes and current URL
  const panoptoFromIframes = detectPanoptoVideosFromIframes(
    context.iframes,
    context.pageUrl
  );

  if (panoptoFromIframes.length > 0) {
    const result: VideoDetectionResult = {
      videos: panoptoFromIframes,
      provider: 'panopto' as VideoProvider,
      requiresApiCall: false,
    };
    return result;
  }

  // Check for Echo360 videos
  const echoVideos = _detectEcho360Videos(context);
  if (echoVideos.length > 0) {
    return {
      videos: echoVideos,
      provider: 'echo360' as VideoProvider,
      requiresApiCall: false,
    };
  }

  // Check for HTML5 video elements
  const html5Videos = detectHtml5Videos(context);
  if (html5Videos.length > 0) {
    return {
      videos: html5Videos,
      provider: 'html5' as VideoProvider,
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
  if (depth > MAX_IFRAME_DEPTH) {
    return [];
  }

  const iframes = Array.from(
    doc.querySelectorAll('iframe')
  ) as HTMLIFrameElement[];
  
  const result: VideoDetectionContext['iframes'] = [];

  for (const iframe of iframes) {
    if (!isElementVisible(iframe)) continue;
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

