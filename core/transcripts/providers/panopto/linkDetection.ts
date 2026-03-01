import type { DetectedVideo } from '../../types';
import { buildPanoptoEmbedUrl, extractPanoptoInfo, type PanoptoInfo } from './urlUtils';

const isNonEmptyString = (value: string | null | undefined): value is string =>
  typeof value === 'string' && value.length > 0;

const firstNonEmptyString = (values: Array<string | null | undefined>): string | null => {
  for (const value of values) {
    if (isNonEmptyString(value)) return value;
  }
  return null;
};

const SCRIPT_PROTOCOL = 'java' + 'script:';
const MAILTO_PROTOCOL = 'mailto:';

function resolveUrl(candidate: string, baseUrl: string): string | null {
  const trimmed = candidate.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.startsWith('#')) return null;
  if (trimmed.startsWith(SCRIPT_PROTOCOL)) return null;
  if (trimmed.startsWith(MAILTO_PROTOCOL)) return null;
  try {
    return new URL(trimmed, baseUrl).toString();
  } catch {
    return null;
  }
}

function getAnchorTitle(anchor: HTMLAnchorElement): string {
  const textContent = anchor.textContent;
  const candidates = [
    typeof textContent === 'string' ? textContent.trim() : null,
    anchor.getAttribute('title'),
    anchor.getAttribute('aria-label'),
    anchor.getAttribute('data-title'),
  ];
  return firstNonEmptyString(candidates) ?? '';
}

function resolveBaseUrl(doc: Document): string {
  if (doc.baseURI.length > 0) return doc.baseURI;
  return typeof doc.location?.href === 'string' ? doc.location.href : '';
}

function createVideoAdder(videos: DetectedVideo[], seenIds: Set<string>) {
  return (info: PanoptoInfo, title: string, fallback: string): void => {
    if (seenIds.has(info.deliveryId)) return;
    seenIds.add(info.deliveryId);

    const embedUrl = buildPanoptoEmbedUrl(info.tenant, info.deliveryId);
    const resolvedTitle = title.length > 0 ? title : fallback;
    videos.push({
      id: info.deliveryId,
      provider: 'panopto',
      title: resolvedTitle,
      embedUrl,
      panoptoTenant: info.tenant,
    });
  };
}

function extractInfoFromAnchor(anchor: HTMLAnchorElement, baseUrl: string): PanoptoInfo | null {
  const rawHref = firstNonEmptyString([anchor.getAttribute('href'), anchor.href]) ?? '';
  if (rawHref.length === 0) return null;
  const resolvedHref = resolveUrl(rawHref, baseUrl);
  const href = resolvedHref ?? rawHref;

  let info = extractPanoptoInfo(href);
  if (info !== null) return info;

  const dataHref = firstNonEmptyString([
    anchor.getAttribute('data-href'),
    anchor.getAttribute('data-url'),
    anchor.getAttribute('data-src'),
  ]);
  if (dataHref === null) return null;
  const resolvedDataHref = resolveUrl(dataHref, baseUrl);
  info = extractPanoptoInfo(resolvedDataHref ?? dataHref);
  return info;
}

function extractPanoptoInfoFromOnclick(onclick: string): PanoptoInfo | null {
  return extractPanoptoInfo(onclick);
}

function extractMetaRefreshUrl(doc: Document): string | null {
  const metaRefresh = doc.querySelector('meta[http-equiv="refresh"]');
  if (metaRefresh === null) return null;
  const content = metaRefresh.getAttribute('content') ?? '';
  const urlMatch = content.match(/url=(.+)/i);
  const urlValue = urlMatch?.[1];
  return urlValue !== undefined && urlValue.length > 0 ? urlValue : null;
}

function extractScriptRedirectUrls(doc: Document): string[] {
  const urls: string[] = [];
  const scripts = Array.from(doc.querySelectorAll('script:not([src])'));
  for (const script of scripts) {
    const content = script.textContent ?? '';
    const locationMatch = content.match(
      /(?:window\.)?location(?:\.href)?\s*=\s*['"]([^'"]*panopto[^'"]*)['"]/i,
    );
    const locationValue = locationMatch?.[1];
    if (locationValue !== undefined && locationValue.length > 0) {
      urls.push(locationValue);
    }
  }
  return urls;
}

function extractBodyPanoptoUrls(doc: Document): string[] {
  const bodyText = doc.body?.textContent ?? '';
  return bodyText.match(/https?:\/\/[a-z0-9.-]+\.panopto\.com\/[^\s<>"']*/gi) ?? [];
}

function collectRedirectUrls(doc: Document): string[] {
  const urls = new Set<string>();
  const metaUrl = extractMetaRefreshUrl(doc);
  if (metaUrl !== null) urls.add(metaUrl);
  for (const url of extractScriptRedirectUrls(doc)) {
    urls.add(url);
  }
  for (const url of extractBodyPanoptoUrls(doc)) {
    urls.add(url);
  }
  return Array.from(urls);
}

/**
 * Detect Panopto videos from anchor links on a page.
 * Catches cases where Panopto is linked but not embedded.
 */
export function detectPanoptoFromLinks(doc: Document): DetectedVideo[] {
  const videos: DetectedVideo[] = [];
  const seenIds = new Set<string>();
  const baseUrl = resolveBaseUrl(doc);
  const addVideo = createVideoAdder(videos, seenIds);

  const anchors = Array.from(doc.querySelectorAll('a[href]')) as HTMLAnchorElement[];
  for (const anchor of anchors) {
    const info = extractInfoFromAnchor(anchor, baseUrl);
    if (info !== null) {
      const title = getAnchorTitle(anchor);
      addVideo(info, title, `Panopto video ${videos.length + 1}`);
    }
  }

  const elementsWithOnclick = Array.from(
    doc.querySelectorAll('[onclick*="panopto" i]'),
  ) as HTMLElement[];

  for (const el of elementsWithOnclick) {
    const onclick = el.getAttribute('onclick') ?? '';
    const info = extractPanoptoInfoFromOnclick(onclick);
    if (info !== null && !seenIds.has(info.deliveryId)) {
      const titleText = el.textContent;
      const title = typeof titleText === 'string' ? titleText.trim() : '';
      addVideo(info, title, `Panopto video ${videos.length + 1}`);
    }
  }

  return videos;
}

/**
 * Detect Panopto from meta refresh or JavaScript redirects
 */
export function detectPanoptoFromRedirect(doc: Document): DetectedVideo[] {
  const videos: DetectedVideo[] = [];
  const seenIds = new Set<string>();
  const addVideo = createVideoAdder(videos, seenIds);

  const redirectUrls = collectRedirectUrls(doc);
  for (const url of redirectUrls) {
    const info = extractPanoptoInfo(url);
    if (info !== null && !seenIds.has(info.deliveryId)) {
      addVideo(info, doc.title, 'Panopto video');
    }
  }

  return videos;
}
