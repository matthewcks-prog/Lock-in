import type { DetectedVideo } from '../../types';
import { buildPanoptoEmbedUrl, extractPanoptoInfo, type PanoptoInfo } from './urlUtils';

function resolveUrl(candidate: string, baseUrl: string): string | null {
  const trimmed = candidate.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('#')) return null;
  if (trimmed.startsWith('javascript:')) return null;
  if (trimmed.startsWith('mailto:')) return null;
  try {
    return new URL(trimmed, baseUrl).toString();
  } catch {
    return null;
  }
}

function getAnchorTitle(anchor: HTMLAnchorElement): string {
  return (
    anchor.textContent?.trim() ||
    anchor.getAttribute('title') ||
    anchor.getAttribute('aria-label') ||
    anchor.getAttribute('data-title') ||
    ''
  );
}

/**
 * Detect Panopto videos from anchor links on a page.
 * Catches cases where Panopto is linked but not embedded.
 */
export function detectPanoptoFromLinks(doc: Document): DetectedVideo[] {
  const videos: DetectedVideo[] = [];
  const seenIds = new Set<string>();
  const baseUrl = doc.baseURI || (doc.location ? doc.location.href : '');

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

  const anchors = Array.from(doc.querySelectorAll('a[href]')) as HTMLAnchorElement[];
  for (const anchor of anchors) {
    const rawHref = anchor.getAttribute('href') || anchor.href || '';
    if (!rawHref) continue;
    const resolvedHref = resolveUrl(rawHref, baseUrl);
    const href = resolvedHref || rawHref;

    let info = extractPanoptoInfo(href);

    if (!info) {
      const dataHref =
        anchor.getAttribute('data-href') ||
        anchor.getAttribute('data-url') ||
        anchor.getAttribute('data-src');
      if (dataHref) {
        const resolvedDataHref = resolveUrl(dataHref, baseUrl);
        info = extractPanoptoInfo(resolvedDataHref || dataHref);
      }
    }

    if (info) {
      const title = getAnchorTitle(anchor);
      addVideo(info, title);
    }
  }

  const elementsWithOnclick = Array.from(
    doc.querySelectorAll('[onclick*="panopto" i]'),
  ) as HTMLElement[];

  for (const el of elementsWithOnclick) {
    const onclick = el.getAttribute('onclick') || '';
    const info = extractPanoptoInfo(onclick);
    if (info && !seenIds.has(info.deliveryId)) {
      const title = el.textContent?.trim() || '';
      addVideo(info, title);
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

  const addVideo = (info: PanoptoInfo, title: string): void => {
    if (seenIds.has(info.deliveryId)) return;
    seenIds.add(info.deliveryId);

    const embedUrl = buildPanoptoEmbedUrl(info.tenant, info.deliveryId);
    videos.push({
      id: info.deliveryId,
      provider: 'panopto',
      title: title || doc.title || 'Panopto video',
      embedUrl,
      panoptoTenant: info.tenant,
    });
  };

  const metaRefresh = doc.querySelector('meta[http-equiv="refresh"]');
  if (metaRefresh) {
    const content = metaRefresh.getAttribute('content') || '';
    const urlMatch = content.match(/url=(.+)/i);
    if (urlMatch) {
      const info = extractPanoptoInfo(urlMatch[1]);
      if (info) {
        addVideo(info, '');
      }
    }
  }

  const scripts = Array.from(doc.querySelectorAll('script:not([src])'));
  for (const script of scripts) {
    const content = script.textContent || '';
    const locationMatch = content.match(
      /(?:window\.)?location(?:\.href)?\s*=\s*['"]([^'"]*panopto[^'"]*)['"]/i,
    );
    if (locationMatch) {
      const info = extractPanoptoInfo(locationMatch[1]);
      if (info && !seenIds.has(info.deliveryId)) {
        addVideo(info, '');
      }
    }
  }

  const bodyText = doc.body?.textContent || '';
  const panoptoUrls = bodyText.match(/https?:\/\/[a-z0-9.-]+\.panopto\.com\/[^\s<>"']*/gi) || [];

  for (const url of panoptoUrls) {
    const info = extractPanoptoInfo(url);
    if (info && !seenIds.has(info.deliveryId)) {
      addVideo(info, '');
    }
  }

  return videos;
}
