import type { VideoDetectionContext } from '../types';
import { isElementVisible } from './domUtils';

/** Maximum iframe nesting depth to search */
export const MAX_IFRAME_DEPTH = 3;

/**
 * Collect iframe information from a document.
 * This should be called from content script context where document is available.
 */
export function collectIframeInfo(doc: Document, depth = 0): VideoDetectionContext['iframes'] {
  if (depth > MAX_IFRAME_DEPTH) {
    return [];
  }

  const iframes = Array.from(doc.querySelectorAll('iframe')) as HTMLIFrameElement[];

  const result: VideoDetectionContext['iframes'] = [];

  for (const iframe of iframes) {
    if (!isElementVisible(iframe)) continue;
    const src = iframe.src || iframe.getAttribute('data-src') || iframe.dataset['src'] || '';
    if (src) {
      const entry: { src: string; title?: string } = { src };
      if (iframe.title) {
        entry.title = iframe.title;
      }
      result.push(entry);
    }

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
