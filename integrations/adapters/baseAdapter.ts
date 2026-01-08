/**
 * Base Adapter Interface for Site-Specific Integrations
 *
 * Each supported site (Moodle, Edstem, etc.) implements this interface
 * to extract course context from the DOM.
 */

import type { CourseContext, PageContext } from '../../core/domain/types';

/**
 * Base adapter interface that all site adapters must implement
 */
export interface BaseAdapter {
  /**
   * Check if this adapter can handle the given URL
   */
  canHandle(url: string): boolean;

  /**
   * Extract course code from the page DOM
   */
  getCourseCode(dom: Document): string | null;

  /**
   * Extract week number from the page DOM
   */
  getWeek(dom: Document): number | null;

  /**
   * Extract topic/title from the page DOM
   */
  getTopic(dom: Document): string | null;

  /**
   * Extract full course context from the page
   */
  getCourseContext(dom: Document, url: string): CourseContext;

  /**
   * Extract full page context (title, heading, course info)
   */
  getPageContext(dom: Document, url: string): PageContext;
}

/**
 * Generic adapter for unknown sites (fallback)
 */
export class GenericAdapter implements BaseAdapter {
  canHandle(_url: string): boolean {
    return true; // Fallback adapter handles everything
  }

  getCourseCode(_dom: Document): string | null {
    return null;
  }

  getWeek(_dom: Document): number | null {
    return null;
  }

  getTopic(dom: Document): string | null {
    const heading = dom.querySelector('h1, h2')?.textContent?.trim();
    return heading || null;
  }

  getCourseContext(_dom: Document, url: string): CourseContext {
    return {
      courseCode: null,
      sourceUrl: url,
    };
  }

  getPageContext(dom: Document, url: string): PageContext {
    const heading = dom.querySelector('h1, h2')?.textContent?.trim() || dom.title;
    return {
      url,
      title: dom.title,
      heading,
      courseContext: this.getCourseContext(dom, url),
    };
  }
}
