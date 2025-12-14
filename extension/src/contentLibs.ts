/**
 * Content Script Libraries Entry Point
 * 
 * This file bundles all the content script helper libraries and the page context
 * resolver with adapters. It serves as the single entry point for building
 * the content script dependencies.
 * 
 * Bundled by vite.config.contentLibs.ts into extension/libs/contentLibs.js
 * 
 * Exposes on window:
 * - LockInLogger
 * - LockInMessaging  
 * - LockInStorage
 * - LockInContent.resolveAdapterContext
 */

// Import and re-export all libs (side effects expose them on window)
import "./logger";
import "./messaging";
import "./storage";

// Import adapters and page context
import { getAdapterForUrl, GenericAdapter } from "../../integrations";
import type { BaseAdapter } from "../../integrations/adapters/baseAdapter";
import type { PageContext } from "../../core/domain/types";

/**
 * Infer course code from URL or page content as fallback
 */
function inferCourseCode(dom: Document, url: string): string | null {
  // Try URL first
  const urlMatch = url.match(/\b([A-Z]{3}\d{4})\b/i);
  if (urlMatch) {
    return urlMatch[1].toUpperCase();
  }

  // Try page body text (expensive, do last)
  const bodyText = dom.body?.innerText || "";
  const codeMatch = bodyText.match(/\b([A-Z]{3}\d{4})\b/i);
  return codeMatch ? codeMatch[1].toUpperCase() : null;
}

interface LoggerInterface {
  error?: (...args: unknown[]) => void;
  warn?: (...args: unknown[]) => void;
  debug?: (...args: unknown[]) => void;
}

/**
 * Resolve the appropriate adapter for the current page and extract context
 */
export function resolveAdapterContext(logger?: LoggerInterface): {
  adapter: BaseAdapter;
  pageContext: PageContext;
} {
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
    const courseContext = pageContext.courseContext || {
      courseCode: null,
      sourceUrl: window.location.href,
    };

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
