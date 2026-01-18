import type { DetectedVideo, VideoDetectionContext } from '../types';
import { isElementVisible } from './domUtils';

function resolveUrl(candidate: string | null | undefined, baseUrl: string): string | null {
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
    el.getAttribute('data-title') || el.getAttribute('aria-label') || el.getAttribute('title');
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

function getVideoTitle(video: HTMLVideoElement, mediaUrl: string | null, index: number): string {
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

  const source = video.querySelector('source[src]') as HTMLSourceElement | null;
  if (source?.src) {
    const resolved = resolveUrl(source.src, baseUrl);
    if (resolved) return resolved;
  }

  return null;
}

function getTrackUrls(
  video: HTMLVideoElement,
  baseUrl: string,
): Array<{ kind: string; label?: string; srclang?: string; src: string }> {
  const tracks = Array.from(video.querySelectorAll('track[src]')) as HTMLTrackElement[];
  const urls: Array<{ kind: string; label?: string; srclang?: string; src: string }> = [];
  for (const track of tracks) {
    const rawSrc = track.getAttribute('src') || track.src;
    const resolved = resolveUrl(rawSrc, baseUrl);
    if (!resolved) continue;
    urls.push({
      kind: track.getAttribute('kind') || 'subtitles',
      label: track.getAttribute('label') || undefined,
      srclang: track.getAttribute('srclang') || undefined,
      src: resolved,
    });
  }
  return urls;
}

function getDrmInfo(video: HTMLVideoElement): { detected: boolean; reason?: string } {
  if (video.hasAttribute('data-drm') || video.getAttribute('data-protected')) {
    return { detected: true, reason: 'data-attribute' };
  }

  const sources = Array.from(video.querySelectorAll('source')) as HTMLSourceElement[];
  for (const source of sources) {
    if (source.getAttribute('type')?.includes('application/dash+xml')) {
      return { detected: true, reason: 'dash-manifest' };
    }
    if (source.getAttribute('type')?.includes('application/vnd.apple.mpegurl')) {
      return { detected: true, reason: 'hls-manifest' };
    }
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
    const sameTagSiblings = siblings.filter((child) => child.tagName === currentTagName);
    const index = sameTagSiblings.indexOf(current);
    const suffix = sameTagSiblings.length > 1 ? `:nth-of-type(${index + 1})` : '';
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

export function detectHtml5Videos(context: VideoDetectionContext): DetectedVideo[] {
  const doc = context.document;
  if (!doc) {
    return [];
  }

  const baseUrl = doc.baseURI || context.pageUrl;
  const videoElements = Array.from(doc.querySelectorAll('video')).filter((video) =>
    isElementVisible(video),
  ) as HTMLVideoElement[];
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
    const drmFields = drmInfo.detected ? { drmDetected: true, drmReason: drmInfo.reason } : {};

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
