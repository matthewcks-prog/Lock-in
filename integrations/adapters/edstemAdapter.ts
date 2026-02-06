/**
 * Edstem Adapter
 *
 * Extracts course context from Edstem pages.
 */

import type { BaseAdapter } from './baseAdapter';
import type { CourseContext, PageContext } from '../../core/domain/types';
import { extractCourseCodeFromText } from '../../core/utils/textUtils';

/**
 * Edstem-specific adapter
 */
export class EdstemAdapter implements BaseAdapter {
  canHandle(url: string): boolean {
    return url.includes('edstem.org');
  }

  getCourseCode(dom: Document): string | null {
    // Edstem course codes might be in:
    // - Page title
    // - Breadcrumbs
    // - Course header
    const title = dom.title;
    const heading = dom.querySelector('h1')?.textContent?.trim();

    const candidates = [title, heading].filter(Boolean);
    for (const text of candidates) {
      const code = extractCourseCodeFromText(text || '');
      if (code) return code;
    }

    return null;
  }

  getWeek(_dom: Document): number | null {
    // TODO: Extract week from Edstem structure
    return null;
  }

  getTopic(dom: Document): string | null {
    const heading = dom.querySelector('h1, h2')?.textContent?.trim();
    return heading || null;
  }

  getCourseContext(dom: Document, url: string): CourseContext {
    const courseCode = this.getCourseCode(dom);
    const topic = this.getTopic(dom);

    const context: CourseContext = {
      courseCode,
      sourceUrl: url,
    };
    if (topic) {
      context.topic = topic;
    }
    const sourceLabel = topic || courseCode || '';
    if (sourceLabel) {
      context.sourceLabel = sourceLabel;
    }
    return context;
  }

  getPageContext(dom: Document, url: string): PageContext {
    const heading = dom.querySelector('h1, h2')?.textContent?.trim() || dom.title;
    const courseContext = this.getCourseContext(dom, url);

    return {
      url,
      title: dom.title,
      heading,
      courseContext,
    };
  }
}
