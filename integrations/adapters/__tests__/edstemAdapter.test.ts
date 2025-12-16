/**
 * Unit tests for EdstemAdapter
 * 
 * Tests DOM-based adapter logic using jsdom.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { JSDOM } from "jsdom";
import { EdstemAdapter } from "../edstemAdapter";

describe("EdstemAdapter", () => {
  let adapter: EdstemAdapter;
  let document: Document;

  function createDocument(url: string = "https://edstem.org/us/courses/12345"): Document {
    const dom = new JSDOM(
      `<!DOCTYPE html>
      <html>
        <head>
          <title>Test Page</title>
        </head>
        <body></body>
      </html>`,
      {
        url,
        pretendToBeVisual: true,
      }
    );
    return dom.window.document;
  }

  beforeEach(() => {
    adapter = new EdstemAdapter();
    document = createDocument();
  });

  describe("canHandle", () => {
    it("should return true for Edstem URLs", () => {
      expect(adapter.canHandle("https://edstem.org/us/courses/12345")).toBe(true);
      expect(adapter.canHandle("http://edstem.org")).toBe(true);
      expect(adapter.canHandle("https://edstem.org/au/courses/67890")).toBe(true);
    });

    it("should return false for non-Edstem URLs", () => {
      expect(adapter.canHandle("https://learning.monash.edu")).toBe(false);
      expect(adapter.canHandle("https://example.com")).toBe(false);
    });
  });

  describe("getCourseCode", () => {
    it("should extract course code from page title", () => {
      document.title = "FIT1045 - Introduction to Programming";
      const code = adapter.getCourseCode(document);
      expect(code).toBe("FIT1045");
    });

    it("should extract course code from h1 heading", () => {
      const h1 = document.createElement("h1");
      h1.textContent = "MAT1830 - Discrete Mathematics";
      document.body.appendChild(h1);

      const code = adapter.getCourseCode(document);
      expect(code).toBe("MAT1830");
    });

    it("should extract course code from h1 heading (h2 not checked by adapter)", () => {
      // Note: EdstemAdapter only checks title and h1, not h2
      const h1 = document.createElement("h1");
      h1.textContent = "FIT1045 Course Content";
      document.body.appendChild(h1);

      const code = adapter.getCourseCode(document);
      expect(code).toBe("FIT1045");
    });

    it("should return null when no course code found", () => {
      document.title = "General Course Page";
      document.body.textContent = "Welcome to the course";
      const code = adapter.getCourseCode(document);
      expect(code).toBe(null);
    });

    it("should handle case-insensitive course codes", () => {
      document.title = "fit1045 - Introduction";
      const code = adapter.getCourseCode(document);
      expect(code).toBe("FIT1045");
    });
  });

  describe("getWeek", () => {
    it("should return null (not yet implemented)", () => {
      const h1 = document.createElement("h1");
      h1.textContent = "Week 5 Content";
      document.body.appendChild(h1);

      const week = adapter.getWeek(document);
      expect(week).toBe(null);
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

    it("should prefer h1 over h2", () => {
      const h1 = document.createElement("h1");
      h1.textContent = "Main Topic";
      document.body.appendChild(h1);

      const h2 = document.createElement("h2");
      h2.textContent = "Sub Topic";
      document.body.appendChild(h2);

      const topic = adapter.getTopic(document);
      expect(topic).toBe("Main Topic");
    });

    it("should return null when no heading found", () => {
      document.body.textContent = "No headings here";
      const topic = adapter.getTopic(document);
      expect(topic).toBe(null);
    });
  });

  describe("getCourseContext", () => {
    it("should build complete course context", () => {
      document.title = "FIT1045 - Introduction";
      const h1 = document.createElement("h1");
      h1.textContent = "Welcome to FIT1045";
      document.body.appendChild(h1);

      const url = "https://edstem.org/us/courses/12345";
      const context = adapter.getCourseContext(document, url);

      expect(context.courseCode).toBe("FIT1045");
      expect(context.topic).toBe("Welcome to FIT1045");
      expect(context.sourceUrl).toBe(url);
      expect(context.sourceLabel).toBe("Welcome to FIT1045");
    });

    it("should handle missing course code gracefully", () => {
      document.title = "General Course Page";
      document.body.textContent = "No course code here";
      const url = "https://edstem.org/us/courses/12345";
      const context = adapter.getCourseContext(document, url);

      expect(context.courseCode).toBe(null);
      expect(context.sourceUrl).toBe(url);
    });

    it("should use course code as sourceLabel when topic is missing", () => {
      document.title = "FIT1045 - Course";
      const url = "https://edstem.org/us/courses/12345";
      const context = adapter.getCourseContext(document, url);

      expect(context.courseCode).toBe("FIT1045");
      expect(context.sourceLabel).toBe("FIT1045");
    });
  });

  describe("getPageContext", () => {
    it("should build complete page context", () => {
      document.title = "Course Page - Edstem";
      const h1 = document.createElement("h1");
      h1.textContent = "Welcome";
      document.body.appendChild(h1);

      const url = "https://edstem.org/us/courses/12345";
      const context = adapter.getPageContext(document, url);

      expect(context.url).toBe(url);
      expect(context.title).toBe("Course Page - Edstem");
      expect(context.heading).toBe("Welcome");
      expect(context.courseContext).toBeDefined();
    });

    it("should use title as heading fallback", () => {
      document.title = "Course Page Title";
      const url = "https://edstem.org/us/courses/12345";
      const context = adapter.getPageContext(document, url);

      expect(context.heading).toBe("Course Page Title");
    });
  });
});

