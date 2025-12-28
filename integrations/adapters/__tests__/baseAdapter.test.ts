/**
 * Unit tests for GenericAdapter (baseAdapter)
 * 
 * Tests the fallback adapter for unknown sites.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { JSDOM } from "jsdom";
import { GenericAdapter } from "../baseAdapter";

describe("GenericAdapter", () => {
  let adapter: GenericAdapter;
  let document: Document;

  function createDocument(url: string = "https://example.com/page"): Document {
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
    adapter = new GenericAdapter();
    document = createDocument();
  });

  describe("canHandle", () => {
    it("should return true for any URL (fallback adapter)", () => {
      expect(adapter.canHandle("https://example.com")).toBe(true);
      expect(adapter.canHandle("https://unknown-site.com")).toBe(true);
      expect(adapter.canHandle("http://localhost:3000")).toBe(true);
    });
  });

  describe("getCourseCode", () => {
    it("should return null (generic adapter doesn't extract course codes)", () => {
      document.title = "FIT1045 - Course";
      const h1 = document.createElement("h1");
      h1.textContent = "FIT1045 Content";
      document.body.appendChild(h1);

      const code = adapter.getCourseCode(document);
      expect(code).toBe(null);
    });
  });

  describe("getWeek", () => {
    it("should return null (generic adapter doesn't extract weeks)", () => {
      const h2 = document.createElement("h2");
      h2.textContent = "Week 5";
      document.body.appendChild(h2);

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
    it("should return minimal context with sourceUrl", () => {
      const url = "https://example.com/page";
      const context = adapter.getCourseContext(document, url);

      expect(context.courseCode).toBe(null);
      expect(context.sourceUrl).toBe(url);
    });
  });

  describe("getPageContext", () => {
    it("should build complete page context", () => {
      document.title = "Page Title";
      const h1 = document.createElement("h1");
      h1.textContent = "Page Heading";
      document.body.appendChild(h1);

      const url = "https://example.com/page";
      const context = adapter.getPageContext(document, url);

      expect(context.url).toBe(url);
      expect(context.title).toBe("Page Title");
      expect(context.heading).toBe("Page Heading");
      expect(context.courseContext).toBeDefined();
      expect(context.courseContext.courseCode).toBe(null);
    });

    it("should use title as heading fallback", () => {
      document.title = "Page Title";
      const url = "https://example.com/page";
      const context = adapter.getPageContext(document, url);

      expect(context.heading).toBe("Page Title");
    });
  });
});


