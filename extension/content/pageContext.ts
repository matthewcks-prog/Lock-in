/**
 * Page context + adapter resolution for the content script.
 *
 * Bundles the shared site adapters directly (no window globals).
 */
import { getAdapterForUrl, GenericAdapter, BaseAdapter } from "../../integrations";
import type { PageContext } from "../../core/domain/types";

function inferCourseCode(dom: Document, url: string): string | null {
  const urlMatch = url.match(/\b([A-Z]{3}\d{4})\b/i);
  if (urlMatch) {
    return urlMatch[1].toUpperCase();
  }

  const bodyText = dom.body?.innerText || "";
  const codeMatch = bodyText.match(/\b([A-Z]{3}\d{4})\b/i);
  return codeMatch ? codeMatch[1].toUpperCase() : null;
}

export function resolveAdapterContext(logger?: { error?: (...args: any[]) => void; warn?: (...args: any[]) => void; debug?: (...args: any[]) => void }) {
  const log = {
    error: logger?.error ?? console.error,
    warn: logger?.warn ?? console.warn,
    debug: logger?.debug ?? (() => {}),
  };
  let adapter: BaseAdapter = new GenericAdapter();
  let pageContext: PageContext = {
    url: window.location.href,
    title: document.title,
    heading: document.title,
    courseContext: { courseCode: null, sourceUrl: window.location.href },
  };

  try {
    adapter = getAdapterForUrl(window.location.href) || adapter;
    pageContext = adapter.getPageContext(document, window.location.href);

    // Apply lightweight course-code inference if adapter didn't find one
    const courseContext = pageContext.courseContext || { courseCode: null, sourceUrl: window.location.href };
    if (!courseContext.courseCode) {
      const inferred = inferCourseCode(document, window.location.href);
      if (inferred) {
        pageContext = {
          ...pageContext,
          courseContext: {
            ...courseContext,
            courseCode: inferred,
          },
        };
      }
    }
  } catch (error) {
    log.error("Failed to get page context:", error);
  }

  return { adapter, pageContext };
}

// Expose to the content script orchestrator
if (typeof window !== "undefined") {
  (window as any).LockInContent = (window as any).LockInContent || {};
  (window as any).LockInContent.resolveAdapterContext = resolveAdapterContext;
}
