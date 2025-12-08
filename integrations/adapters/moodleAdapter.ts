/**
 * Moodle Adapter for Monash University Learning Management System
 * 
 * Extracts course codes and context from Moodle pages.
 */

import type { BaseAdapter } from "./baseAdapter";
import type { CourseContext, PageContext } from "../../core/domain/types";
import { extractCourseCodeFromText } from "../../core/utils/textUtils";

/**
 * Moodle-specific adapter for learning.monash.edu
 */
export class MoodleAdapter implements BaseAdapter {
  constructor() {}

  canHandle(url: string): boolean {
    return url.includes("learning.monash.edu");
  }

  /**
   * Get course code from page DOM
   */
  getCourseCode(dom: Document): string | null {
    // Try multiple strategies to find course code
    const candidateTexts: string[] = [];

    // 1. Check meta tags
    const metaSelectors = [
      'meta[property="og:title"]',
      'meta[name="twitter:title"]',
      'meta[name="title"]',
    ];
    metaSelectors.forEach((selector) => {
      const content = dom.querySelector(selector)?.getAttribute("content");
      if (content) candidateTexts.push(content);
    });

    // 2. Check headings
    const headingSelectors = [
      "h1",
      "h2",
      ".page-header-headings",
      ".page-header-headings h1",
      ".course-title",
      ".breadcrumb",
      "[data-region='course-header']",
    ];
    headingSelectors.forEach((selector) => {
      dom.querySelectorAll(selector).forEach((el) => {
        const text = el.textContent?.trim();
        if (text) candidateTexts.push(text);
      });
    });

    // 3. Check body text (first 8000 chars)
    const bodyText = dom.body?.innerText || "";
    if (bodyText) {
      candidateTexts.push(bodyText.substring(0, 8000));
    }

    // Try to extract course code from candidates
    for (const text of candidateTexts) {
      const code = extractCourseCodeFromText(text);
      if (code) {
        // Cache the mapping if we have a course ID
        const courseId = this.getCourseId(dom);
        if (courseId) {
          this.persistCourseMapping(courseId, code);
        }
        return code;
      }
    }

    // Fallback: check cached mapping
    const courseId = this.getCourseId(dom);
    if (courseId) {
      return this.getStoredCourseMapping(courseId);
    }

    return null;
  }

  /**
   * Extract week number from Moodle page
   */
  getWeek(_dom: Document): number | null {
    // TODO: Implement week extraction from Moodle structure
    // Moodle weeks might be in breadcrumbs, headings, or URL params
    return null;
  }

  /**
   * Extract topic/title from page
   */
  getTopic(dom: Document): string | null {
    const heading = dom.querySelector("h1, h2")?.textContent?.trim();
    return heading || null;
  }

  /**
   * Get course ID from URL query params
   */
  private getCourseId(dom: Document): string | null {
    const url = new URL(dom.location.href);
    return url.searchParams.get("id");
  }

  /**
   * Get stored course code mapping from localStorage
   */
  private getStoredCourseMapping(courseId: string): string | null {
    try {
      const raw = localStorage.getItem("lockin:monashCourseCodes");
      const mapping = raw ? JSON.parse(raw) : {};
      return mapping[courseId] || null;
    } catch (error) {
      console.warn("Failed to read cached Monash course codes", error);
      return null;
    }
  }

  /**
   * Persist course code mapping to localStorage
   */
  private persistCourseMapping(courseId: string, courseCode: string): void {
    if (!courseId || !courseCode) return;

    try {
      const existing = this.getStoredCourseMapping(courseId)
        ? JSON.parse(localStorage.getItem("lockin:monashCourseCodes") || "{}")
        : {};
      
      if (existing[courseId] === courseCode) return;

      const next = { ...existing, [courseId]: courseCode };
      localStorage.setItem("lockin:monashCourseCodes", JSON.stringify(next));
    } catch (error) {
      console.warn("Failed to persist Monash course code", error);
    }
  }

  /**
   * Get full course context
   */
  getCourseContext(dom: Document, url: string): CourseContext {
    const courseCode = this.getCourseCode(dom);
    const topic = this.getTopic(dom);

    return {
      courseCode,
      courseName: courseCode || undefined,
      topic: topic || undefined,
      sourceUrl: url,
      sourceLabel: topic || courseCode || undefined,
    };
  }

  /**
   * Get full page context
   */
  getPageContext(dom: Document, url: string): PageContext {
    const heading = dom.querySelector("h1, h2")?.textContent?.trim() || dom.title;
    const courseContext = this.getCourseContext(dom, url);

    return {
      url,
      title: dom.title,
      heading,
      courseContext,
    };
  }
}
