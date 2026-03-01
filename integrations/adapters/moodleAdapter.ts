/**
 * Moodle Adapter for Monash University Learning Management System
 *
 * Extracts course codes and context from Moodle pages.
 */

import type { BaseAdapter } from './baseAdapter';
import type { CourseContext, PageContext } from '../../core/domain/types';
import { extractCourseCodeFromText } from '../utils/textUtils';
import {
  BODY_TEXT_LIMIT,
  HEADING_SELECTORS,
  HEADING_WEEK_SELECTORS,
  META_SELECTORS,
  PRECISE_WEEK_SELECTORS,
  SECTION_TEXT_LIMIT,
  WEEK_PATTERN,
  WEEK_START_PATTERN,
  extractWeekFromSelectors,
  isNonEmptyString,
  parseWeekToken,
} from './moodleUtils';

/**
 * Moodle-specific adapter for learning.monash.edu
 */
export class MoodleAdapter implements BaseAdapter {
  constructor() {}

  canHandle(url: string): boolean {
    return url.includes('learning.monash.edu');
  }

  /**
   * Get course code from page DOM
   */
  getCourseCode(dom: Document): string | null {
    // Try multiple strategies to find course code
    const candidateTexts: string[] = [];

    // 1. Check meta tags
    META_SELECTORS.forEach((selector) => {
      const content = dom.querySelector(selector)?.getAttribute('content');
      if (isNonEmptyString(content)) candidateTexts.push(content);
    });

    // 2. Check headings
    HEADING_SELECTORS.forEach((selector) => {
      dom.querySelectorAll(selector).forEach((el) => {
        const text = el.textContent?.trim();
        if (isNonEmptyString(text)) candidateTexts.push(text);
      });
    });

    // 3. Check body text (first 8000 chars)
    const bodyText = dom.body?.innerText ?? '';
    if (bodyText.length > 0) {
      candidateTexts.push(bodyText.substring(0, BODY_TEXT_LIMIT));
    }

    // Try to extract course code from candidates
    for (const text of candidateTexts) {
      const code = extractCourseCodeFromText(text);
      if (code !== null) {
        return code;
      }
    }

    return null;
  }

  /**
   * Extract week number from Moodle page
   *
   * Looks for the "Week X" label that appears above topic headings on Moodle learning pages.
   * Only returns a week if found in a specific, reliable location (not in general content).
   */
  getWeek(dom: Document): number | null {
    // First strategy: Look for a standalone "Week X" text element
    // On Moodle, this appears as a separate element above the topic title
    // It's often in a <strong> or standalone text near the section header

    // Check section info areas and headings - these should have ONLY "Week X"
    const preciseWeek = extractWeekFromSelectors(dom, PRECISE_WEEK_SELECTORS, WEEK_PATTERN);
    if (preciseWeek !== null) {
      return preciseWeek;
    }

    // Second strategy: Look for "Week X" as a small heading or label
    // Check h2, h3, strong elements but only if they contain JUST "Week X"
    const headingWeek = extractWeekFromSelectors(dom, HEADING_WEEK_SELECTORS, WEEK_PATTERN);
    if (headingWeek !== null) {
      return headingWeek;
    }

    // Third strategy: Look for Week X at the very start of the main content
    // The week label on Moodle pages is typically in the first 300 chars of section content
    const sectionContent = dom.querySelector('.course-content .section, #region-main .content');
    if (sectionContent !== null) {
      const text = (sectionContent.textContent ?? '').substring(0, SECTION_TEXT_LIMIT);
      // Look for "Week X" at the start of content (possibly after whitespace)
      const startMatch = text.match(WEEK_START_PATTERN);
      const week = parseWeekToken(startMatch?.[1]);
      if (week !== null) return week;
    }

    // No reliable week indicator found
    return null;
  }

  /**
   * Extract topic/title from page
   */
  getTopic(dom: Document): string | null {
    const heading = dom.querySelector('h1, h2')?.textContent?.trim();
    return isNonEmptyString(heading) ? heading : null;
  }

  /**
   * Get full course context
   */
  getCourseContext(dom: Document, url: string): CourseContext {
    const courseCode = this.getCourseCode(dom);
    const topic = this.getTopic(dom);
    const week = this.getWeek(dom);

    const context: CourseContext = {
      courseCode,
      sourceUrl: url,
    };
    if (courseCode !== null) {
      context.courseName = courseCode;
    }
    if (week !== null) {
      context.week = week;
    }
    if (topic !== null) {
      context.topic = topic;
    }
    const sourceLabel = week !== null ? `Week ${week}` : (topic ?? courseCode ?? '');
    if (sourceLabel.length > 0) {
      context.sourceLabel = sourceLabel;
    }
    return context;
  }

  /**
   * Get full page context
   */
  getPageContext(dom: Document, url: string): PageContext {
    const headingText = dom.querySelector('h1, h2')?.textContent?.trim();
    const heading = isNonEmptyString(headingText) ? headingText : dom.title;
    const courseContext = this.getCourseContext(dom, url);

    return {
      url,
      title: dom.title,
      heading,
      courseContext,
    };
  }
}
