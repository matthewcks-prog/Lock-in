/**
 * Edstem Adapter
 *
 * Extracts course context from Edstem pages.
 */

import type { BaseAdapter } from './baseAdapter';
import type { CourseContext, PageContext } from '../../core/domain/types';
import { extractCourseCodeFromText } from '../utils/textUtils';

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

    const candidates: string[] = [];
    if (title.length > 0) {
      candidates.push(title);
    }
    if (heading !== undefined && heading.length > 0) {
      candidates.push(heading);
    }
    for (const text of candidates) {
      const code = extractCourseCodeFromText(text);
      if (code !== null && code.length > 0) return code;
    }

    return null;
  }

  getWeek(_dom: Document): number | null {
    // TODO: Extract week from Edstem structure
    return null;
  }

  getTopic(dom: Document): string | null {
    const heading = dom.querySelector('h1, h2')?.textContent?.trim();
    if (heading === undefined || heading.length === 0) {
      return null;
    }
    return heading;
  }

  getCourseContext(dom: Document, url: string): CourseContext {
    const courseCode = this.getCourseCode(dom);
    const topic = this.getTopic(dom);

    const context: CourseContext = {
      courseCode,
      sourceUrl: url,
    };
    if (topic !== null && topic.length > 0) {
      context.topic = topic;
    }
    const sourceLabel =
      topic !== null && topic.length > 0
        ? topic
        : courseCode !== null && courseCode.length > 0
          ? courseCode
          : '';
    if (sourceLabel.length > 0) {
      context.sourceLabel = sourceLabel;
    }
    return context;
  }

  getPageContext(dom: Document, url: string): PageContext {
    const headingText = dom.querySelector('h1, h2')?.textContent?.trim();
    const heading = headingText !== undefined && headingText.length > 0 ? headingText : dom.title;
    const courseContext = this.getCourseContext(dom, url);

    return {
      url,
      title: dom.title,
      heading,
      courseContext,
    };
  }
}
