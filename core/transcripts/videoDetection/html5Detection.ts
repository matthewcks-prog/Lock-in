import type { DetectedVideo, VideoDetectionContext } from '../types';
import { isElementVisible } from './domUtils';

const MAX_TITLE_DEPTH = 4;
const MAX_SELECTOR_DEPTH = 4;
const HASH_SHIFT = 5;
const HASH_RADIX = 36;

const isNonEmptyString = (value: string | null | undefined): value is string =>
  typeof value === 'string' && value.length > 0;

function resolveUrl(candidate: string | null | undefined, baseUrl: string): string | null {
  if (!isNonEmptyString(candidate)) return null;
  try {
    return new URL(candidate, baseUrl).toString();
  } catch {
    return null;
  }
}

function getElementLabel(el: Element | null): string | null {
  if (el === null) return null;
  const label =
    el.getAttribute('data-title') ?? el.getAttribute('aria-label') ?? el.getAttribute('title');
  if (!isNonEmptyString(label)) return null;
  const trimmed = label.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function getClosestContainerTitle(video: HTMLVideoElement): string | null {
  let current: Element | null = video.parentElement;
  let depth = 0;
  while (current !== null && depth < MAX_TITLE_DEPTH) {
    const label = getElementLabel(current);
    if (label !== null) return label;

    const figcaption = current.querySelector('figcaption');
    const figcaptionText = figcaption?.textContent;
    if (typeof figcaptionText === 'string') {
      const trimmed = figcaptionText.trim();
      if (trimmed.length > 0) return trimmed;
    }

    const heading = current.querySelector('h1,h2,h3,h4,h5,h6');
    const headingText = heading?.textContent;
    if (typeof headingText === 'string') {
      const trimmed = headingText.trim();
      if (trimmed.length > 0) return trimmed;
    }

    current = current.parentElement;
    depth += 1;
  }
  return null;
}

function getFilenameTitle(mediaUrl: string | null): string | null {
  if (!isNonEmptyString(mediaUrl)) return null;
  try {
    const url = new URL(mediaUrl);
    const filename = url.pathname.split('/').pop();
    if (!isNonEmptyString(filename)) return null;
    const decoded = decodeURIComponent(filename);
    const withoutExt = decoded.replace(/\.[a-z0-9]+$/i, '');
    const trimmed = withoutExt.trim();
    return trimmed.length > 0 ? trimmed : null;
  } catch {
    return null;
  }
}

function getVideoTitle(video: HTMLVideoElement, mediaUrl: string | null, index: number): string {
  const directTitle = getElementLabel(video);
  if (directTitle !== null) return directTitle;

  const containerTitle = getClosestContainerTitle(video);
  if (containerTitle !== null) return containerTitle;

  const filenameTitle = getFilenameTitle(mediaUrl);
  if (filenameTitle !== null) return filenameTitle;

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
  const currentSrc = video.currentSrc;
  if (isNonEmptyString(currentSrc)) return currentSrc;

  const srcAttr = video.getAttribute('src');
  if (isNonEmptyString(srcAttr)) {
    const resolved = resolveUrl(srcAttr, baseUrl);
    if (resolved !== null) return resolved;
  }

  const source = video.querySelector('source[src]') as HTMLSourceElement | null;
  if (source !== null && isNonEmptyString(source.src)) {
    const resolved = resolveUrl(source.src, baseUrl);
    if (resolved !== null) return resolved;
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
    const rawSrc = track.getAttribute('src') ?? track.src;
    const resolved = resolveUrl(rawSrc, baseUrl);
    if (resolved === null) continue;
    const kind = track.getAttribute('kind');
    const entry: { kind: string; label?: string; srclang?: string; src: string } = {
      kind: isNonEmptyString(kind) ? kind : 'subtitles',
      src: resolved,
    };
    const label = track.getAttribute('label');
    if (isNonEmptyString(label)) {
      entry.label = label;
    }
    const srclang = track.getAttribute('srclang');
    if (isNonEmptyString(srclang)) {
      entry.srclang = srclang;
    }
    urls.push(entry);
  }
  return urls;
}

function getDrmInfo(video: HTMLVideoElement): { detected: boolean; reason?: string } {
  if (video.hasAttribute('data-drm') || video.getAttribute('data-protected') !== null) {
    return { detected: true, reason: 'data-attribute' };
  }

  const sources = Array.from(video.querySelectorAll('source')) as HTMLSourceElement[];
  for (const source of sources) {
    const type = source.getAttribute('type');
    if (typeof type === 'string' && type.includes('application/dash+xml')) {
      return { detected: true, reason: 'dash-manifest' };
    }
    if (typeof type === 'string' && type.includes('application/vnd.apple.mpegurl')) {
      return { detected: true, reason: 'hls-manifest' };
    }
  }

  return { detected: false };
}

function buildDomSelector(element: Element): string | undefined {
  const id = (element as HTMLElement).id;
  if (id.length > 0) return `#${id}`;

  const segments: string[] = [];
  let current: Element | null = element;
  let depth = 0;

  while (current !== null && depth < MAX_SELECTOR_DEPTH) {
    const tagName = current.tagName.toLowerCase();
    const currentTagName = current.tagName;
    const parent: Element | null = current.parentElement;
    if (parent === null) {
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
    hash = (hash << HASH_SHIFT) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(HASH_RADIX);
}

type DrmFields = { drmDetected?: boolean; drmReason?: string };

function buildDrmFields(drmInfo: { detected: boolean; reason?: string }): DrmFields {
  if (!drmInfo.detected) {
    return {};
  }
  const fields: DrmFields = { drmDetected: true };
  if (typeof drmInfo.reason === 'string' && drmInfo.reason.length > 0) {
    fields.drmReason = drmInfo.reason;
  }
  return fields;
}

function buildOptionalVideoFields(params: {
  mediaUrl: string | null;
  domId: string | null;
  domSelector: string | undefined;
  durationMs: number | undefined;
  trackUrls: Array<{ kind: string; label?: string; srclang?: string; src: string }>;
}): Partial<DetectedVideo> {
  const fields: Partial<DetectedVideo> = {};
  if (params.mediaUrl !== null) {
    fields.mediaUrl = params.mediaUrl;
  }
  if (params.domId !== null) {
    fields.domId = params.domId;
  }
  if (params.domSelector !== undefined) {
    fields.domSelector = params.domSelector;
  }
  if (params.durationMs !== undefined) {
    fields.durationMs = params.durationMs;
  }
  if (params.trackUrls.length > 0) {
    fields.trackUrls = params.trackUrls;
  }
  return fields;
}

function buildDetectedVideo(
  video: HTMLVideoElement,
  index: number,
  baseUrl: string,
  pageUrl: string,
): DetectedVideo {
  const mediaUrl = getMediaUrl(video, baseUrl);
  const trackUrls = getTrackUrls(video, baseUrl);
  const domId = video.id.length > 0 ? video.id : null;
  const domSelector = buildDomSelector(video);
  const title = getVideoTitle(video, mediaUrl, index);
  const durationMs = getVideoDurationMs(video);
  const drmFields = buildDrmFields(getDrmInfo(video));

  const idSource = mediaUrl !== null ? `${mediaUrl}_${index}` : `video_${index}`;
  const id = domId ?? `html5_${hashString(idSource)}`;

  const optionalFields = buildOptionalVideoFields({
    mediaUrl,
    domId,
    domSelector,
    durationMs,
    trackUrls,
  });

  return {
    id,
    provider: 'html5',
    title,
    embedUrl: mediaUrl ?? pageUrl,
    ...drmFields,
    ...optionalFields,
  };
}

export function detectHtml5Videos(context: VideoDetectionContext): DetectedVideo[] {
  const doc = context.document;
  if (doc === null || doc === undefined) {
    return [];
  }

  const baseUrl = doc.baseURI.length > 0 ? doc.baseURI : context.pageUrl;
  const videoElements = Array.from(doc.querySelectorAll('video')).filter((video) =>
    isElementVisible(video),
  ) as HTMLVideoElement[];

  return videoElements.map((video, index) =>
    buildDetectedVideo(video, index, baseUrl, context.pageUrl),
  );
}
