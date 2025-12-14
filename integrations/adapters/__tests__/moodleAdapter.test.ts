/**
 * Unit tests for MoodleAdapter
 * 
 * Tests DOM-based adapter logic using jsdom.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { JSDOM } from "jsdom";
import { MoodleAdapter } from "../moodleAdapter";

describe("MoodleAdapter", () => {
  let adapter: MoodleAdapter;
  let document: Document;

  function createDocumentWithLocation(courseId: string = "123"): Document {
    // Use JSDOM to create a document with proper location support
    const dom = new JSDOM(
      `<!DOCTYPE html>
      <html>
        <head>
          <title>Test Page</title>
        </head>
        <body></body>
      </html>`,
      {
        url: `https://learning.monash.edu/course/view.php?id=${courseId}`,
        pretendToBeVisual: true,
      }
    );
    return dom.window.document;
  }

  beforeEach(() => {
    adapter = new MoodleAdapter();
    // Clear localStorage between tests to avoid cached course codes
    if (typeof localStorage !== "undefined") {
      localStorage.clear();
    }
    document = createDocumentWithLocation();
  });

  describe("canHandle", () => {
    it("should return true for Moodle URLs", () => {
      expect(adapter.canHandle("https://learning.monash.edu/course/view.php")).toBe(true);
      expect(adapter.canHandle("http://learning.monash.edu/mod/page/view.php")).toBe(true);
    });

    it("should return false for non-Moodle URLs", () => {
      expect(adapter.canHandle("https://edstem.org")).toBe(false);
      expect(adapter.canHandle("https://example.com")).toBe(false);
    });
  });

  describe("getCourseCode", () => {
    it("should extract course code from meta tags", () => {
      const meta = document.createElement("meta");
      meta.setAttribute("property", "og:title");
      meta.setAttribute("content", "FIT1045 - Introduction to Programming");
      document.head.appendChild(meta);

      const code = adapter.getCourseCode(document);
      expect(code).toBe("FIT1045");
    });

    it("should extract course code from headings", () => {
      const h1 = document.createElement("h1");
      h1.textContent = "FIT1045 Course Page";
      document.body.appendChild(h1);

      const code = adapter.getCourseCode(document);
      expect(code).toBe("FIT1045");
    });

    it("should extract course code from body text", () => {
      // Use a different course ID to avoid cache conflicts
      const doc = createDocumentWithLocation("456");
      // Set innerHTML and ensure innerText is available (jsdom may not have innerText)
      doc.body.innerHTML = "Welcome to MAT1830 - Discrete Mathematics";
      // Polyfill innerText if not available (jsdom doesn't always support it)
      if (!("innerText" in doc.body)) {
        Object.defineProperty(doc.body, "innerText", {
          get() {
            return this.textContent || "";
          },
          configurable: true,
        });
      }
      const code = adapter.getCourseCode(doc);
      expect(code).toBe("MAT1830");
    });

    it("should return null when no course code found", () => {
      // Use a different course ID to avoid cache conflicts
      const doc = createDocumentWithLocation("789");
      doc.body.textContent = "Welcome to the course";
      const code = adapter.getCourseCode(doc);
      expect(code).toBe(null);
    });
  });

  describe("getWeek", () => {
    it("should extract week number from section info", () => {
      const sectionInfo = document.createElement("div");
      sectionInfo.setAttribute("data-region", "section-info");
      const textMuted = document.createElement("div");
      textMuted.className = "text-muted";
      textMuted.textContent = "Week 5";
      sectionInfo.appendChild(textMuted);
      document.body.appendChild(sectionInfo);

      const week = adapter.getWeek(document);
      expect(week).toBe(5);
    });

    it("should extract week number from headings", () => {
      const h2 = document.createElement("h2");
      h2.textContent = "Week 3";
      document.body.appendChild(h2);

      const week = adapter.getWeek(document);
      expect(week).toBe(3);
    });

    it("should return null when no week found", () => {
      document.body.textContent = "General content without week";
      const week = adapter.getWeek(document);
      expect(week).toBe(null);
    });

    it("should handle week numbers 1-52", () => {
      const h2 = document.createElement("h2");
      h2.textContent = "Week 1";
      document.body.appendChild(h2);
      expect(adapter.getWeek(document)).toBe(1);

      h2.textContent = "Week 52";
      expect(adapter.getWeek(document)).toBe(52);
    });

    it("should return null for invalid week numbers", () => {
      const h2 = document.createElement("h2");
      h2.textContent = "Week 0";
      document.body.appendChild(h2);
      expect(adapter.getWeek(document)).toBe(null);

      h2.textContent = "Week 53";
      expect(adapter.getWeek(document)).toBe(null);
    });
  });

  describe("getTopic", () => {
    it("should extract topic from h1", () => {
      const h1 = document.createElement("h1");
      h1.textContent = "Introduction to Arrays";
      document.body.appendChild(h1);

      const topic = adapter.getTopic(document);
      expect(topic).toBe("Introduction to Arrays");
    });

    it("should extract topic from h2 if h1 not present", () => {
      const h2 = document.createElement("h2");
      h2.textContent = "Lecture Notes";
      document.body.appendChild(h2);

      const topic = adapter.getTopic(document);
      expect(topic).toBe("Lecture Notes");
    });

    it("should return null when no heading found", () => {
      document.body.textContent = "No headings here";
      const topic = adapter.getTopic(document);
      expect(topic).toBe(null);
    });
  });

  describe("getCourseContext", () => {
    it("should build complete course context", () => {
      const h1 = document.createElement("h1");
      h1.textContent = "FIT1045 - Introduction";
      document.body.appendChild(h1);

      const sectionInfo = document.createElement("div");
      sectionInfo.setAttribute("data-region", "section-info");
      const textMuted = document.createElement("div");
      textMuted.className = "text-muted";
      textMuted.textContent = "Week 7";
      sectionInfo.appendChild(textMuted);
      document.body.appendChild(sectionInfo);

      const url = "https://learning.monash.edu/course/view.php?id=123";
      const context = adapter.getCourseContext(document, url);

      expect(context.courseCode).toBe("FIT1045");
      expect(context.week).toBe(7);
      expect(context.topic).toBe("FIT1045 - Introduction");
      expect(context.sourceUrl).toBe(url);
    });

    it("should handle missing course code gracefully", () => {
      // Use a different course ID to avoid cache conflicts
      const doc = createDocumentWithLocation("999");
      doc.body.textContent = "No course code here";
      const url = "https://learning.monash.edu/course/view.php";
      const context = adapter.getCourseContext(doc, url);

      expect(context.courseCode).toBe(null);
      expect(context.sourceUrl).toBe(url);
    });
  });

  describe("getPageContext", () => {
    it("should build complete page context", () => {
      document.title = "Course Page - Moodle";
      const h1 = document.createElement("h1");
      h1.textContent = "Welcome";
      document.body.appendChild(h1);

      const url = "https://learning.monash.edu/course/view.php";
      const context = adapter.getPageContext(document, url);

      expect(context.url).toBe(url);
      expect(context.title).toBe("Course Page - Moodle");
      expect(context.heading).toBe("Welcome");
      expect(context.courseContext).toBeDefined();
    });
  });
});

