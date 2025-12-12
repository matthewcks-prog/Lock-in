"use strict";
var LockInPageContext = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // extension/content/pageContext.ts
  var pageContext_exports = {};
  __export(pageContext_exports, {
    resolveAdapterContext: () => resolveAdapterContext
  });

  // integrations/adapters/baseAdapter.ts
  var GenericAdapter = class {
    canHandle(_url) {
      return true;
    }
    getCourseCode(_dom) {
      return null;
    }
    getWeek(_dom) {
      return null;
    }
    getTopic(dom) {
      var _a, _b;
      const heading = (_b = (_a = dom.querySelector("h1, h2")) == null ? void 0 : _a.textContent) == null ? void 0 : _b.trim();
      return heading || null;
    }
    getCourseContext(_dom, url) {
      return {
        courseCode: null,
        sourceUrl: url
      };
    }
    getPageContext(dom, url) {
      var _a, _b;
      const heading = ((_b = (_a = dom.querySelector("h1, h2")) == null ? void 0 : _a.textContent) == null ? void 0 : _b.trim()) || dom.title;
      return {
        url,
        title: dom.title,
        heading,
        courseContext: this.getCourseContext(dom, url)
      };
    }
  };

  // core/utils/textUtils.ts
  function extractCourseCodeFromText(text) {
    if (!text || typeof text !== "string") return null;
    const match = text.match(/\b([A-Z]{3}\d{4})\b/i);
    return match ? match[1].toUpperCase() : null;
  }

  // integrations/adapters/moodleAdapter.ts
  var MoodleAdapter = class {
    constructor() {
    }
    canHandle(url) {
      return url.includes("learning.monash.edu");
    }
    /**
     * Get course code from page DOM
     */
    getCourseCode(dom) {
      var _a;
      const candidateTexts = [];
      const metaSelectors = [
        'meta[property="og:title"]',
        'meta[name="twitter:title"]',
        'meta[name="title"]'
      ];
      metaSelectors.forEach((selector) => {
        var _a2;
        const content = (_a2 = dom.querySelector(selector)) == null ? void 0 : _a2.getAttribute("content");
        if (content) candidateTexts.push(content);
      });
      const headingSelectors = [
        "h1",
        "h2",
        ".page-header-headings",
        ".page-header-headings h1",
        ".course-title",
        ".breadcrumb",
        "[data-region='course-header']"
      ];
      headingSelectors.forEach((selector) => {
        dom.querySelectorAll(selector).forEach((el) => {
          var _a2;
          const text = (_a2 = el.textContent) == null ? void 0 : _a2.trim();
          if (text) candidateTexts.push(text);
        });
      });
      const bodyText = ((_a = dom.body) == null ? void 0 : _a.innerText) || "";
      if (bodyText) {
        candidateTexts.push(bodyText.substring(0, 8e3));
      }
      for (const text of candidateTexts) {
        const code = extractCourseCodeFromText(text);
        if (code) {
          const courseId2 = this.getCourseId(dom);
          if (courseId2) {
            this.persistCourseMapping(courseId2, code);
          }
          return code;
        }
      }
      const courseId = this.getCourseId(dom);
      if (courseId) {
        return this.getStoredCourseMapping(courseId);
      }
      return null;
    }
    /**
     * Extract week number from Moodle page
     * 
     * Looks for the "Week X" label that appears above topic headings on Moodle learning pages.
     * Only returns a week if found in a specific, reliable location (not in general content).
     */
    getWeek(dom) {
      var _a, _b;
      const weekPattern = /^\s*Week\s+(\d{1,2})\s*$/i;
      const preciseSelectors = [
        // Moodle section info region
        '[data-region="section-info"] .text-muted',
        '[data-region="section-info"]',
        // Activity header area
        ".activity-header .text-muted",
        ".page-header-headings .text-muted",
        // Breadcrumb might have it
        ".breadcrumb-item.active"
      ];
      for (const selector of preciseSelectors) {
        const elements = dom.querySelectorAll(selector);
        for (const el of elements) {
          const text = ((_a = el.textContent) == null ? void 0 : _a.trim()) || "";
          const match = text.match(weekPattern);
          if (match) {
            const weekNum = parseInt(match[1], 10);
            if (weekNum > 0 && weekNum <= 52) {
              return weekNum;
            }
          }
        }
      }
      const headingSelectors = ["h2", "h3", "h4", "strong", ".section-title"];
      for (const selector of headingSelectors) {
        const elements = dom.querySelectorAll(selector);
        for (const el of elements) {
          const text = ((_b = el.textContent) == null ? void 0 : _b.trim()) || "";
          const match = text.match(weekPattern);
          if (match) {
            const weekNum = parseInt(match[1], 10);
            if (weekNum > 0 && weekNum <= 52) {
              return weekNum;
            }
          }
        }
      }
      const sectionContent = dom.querySelector(".course-content .section, #region-main .content");
      if (sectionContent) {
        const text = (sectionContent.textContent || "").substring(0, 300);
        const startMatch = text.match(/^\s*Week\s+(\d{1,2})\b/i);
        if (startMatch) {
          const weekNum = parseInt(startMatch[1], 10);
          if (weekNum > 0 && weekNum <= 52) {
            return weekNum;
          }
        }
      }
      return null;
    }
    /**
     * Extract topic/title from page
     */
    getTopic(dom) {
      var _a, _b;
      const heading = (_b = (_a = dom.querySelector("h1, h2")) == null ? void 0 : _a.textContent) == null ? void 0 : _b.trim();
      return heading || null;
    }
    /**
     * Get course ID from URL query params
     */
    getCourseId(dom) {
      const url = new URL(dom.location.href);
      return url.searchParams.get("id");
    }
    /**
     * Get stored course code mapping from localStorage
     */
    getStoredCourseMapping(courseId) {
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
    persistCourseMapping(courseId, courseCode) {
      if (!courseId || !courseCode) return;
      try {
        const existing = this.getStoredCourseMapping(courseId) ? JSON.parse(localStorage.getItem("lockin:monashCourseCodes") || "{}") : {};
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
    getCourseContext(dom, url) {
      const courseCode = this.getCourseCode(dom);
      const topic = this.getTopic(dom);
      const week = this.getWeek(dom);
      return {
        courseCode,
        courseName: courseCode || void 0,
        week: week || void 0,
        topic: topic || void 0,
        sourceUrl: url,
        sourceLabel: week ? `Week ${week}` : topic || courseCode || void 0
      };
    }
    /**
     * Get full page context
     */
    getPageContext(dom, url) {
      var _a, _b;
      const heading = ((_b = (_a = dom.querySelector("h1, h2")) == null ? void 0 : _a.textContent) == null ? void 0 : _b.trim()) || dom.title;
      const courseContext = this.getCourseContext(dom, url);
      return {
        url,
        title: dom.title,
        heading,
        courseContext
      };
    }
  };

  // integrations/adapters/edstemAdapter.ts
  var EdstemAdapter = class {
    canHandle(url) {
      return url.includes("edstem.org");
    }
    getCourseCode(dom) {
      var _a, _b;
      const title = dom.title;
      const heading = (_b = (_a = dom.querySelector("h1")) == null ? void 0 : _a.textContent) == null ? void 0 : _b.trim();
      const candidates = [title, heading].filter(Boolean);
      for (const text of candidates) {
        const code = extractCourseCodeFromText(text || "");
        if (code) return code;
      }
      return null;
    }
    getWeek(_dom) {
      return null;
    }
    getTopic(dom) {
      var _a, _b;
      const heading = (_b = (_a = dom.querySelector("h1, h2")) == null ? void 0 : _a.textContent) == null ? void 0 : _b.trim();
      return heading || null;
    }
    getCourseContext(dom, url) {
      const courseCode = this.getCourseCode(dom);
      const topic = this.getTopic(dom);
      return {
        courseCode,
        topic: topic || void 0,
        sourceUrl: url,
        sourceLabel: topic || courseCode || void 0
      };
    }
    getPageContext(dom, url) {
      var _a, _b;
      const heading = ((_b = (_a = dom.querySelector("h1, h2")) == null ? void 0 : _a.textContent) == null ? void 0 : _b.trim()) || dom.title;
      const courseContext = this.getCourseContext(dom, url);
      return {
        url,
        title: dom.title,
        heading,
        courseContext
      };
    }
  };

  // integrations/index.ts
  var adapters = [
    new MoodleAdapter(),
    new EdstemAdapter(),
    new GenericAdapter()
    // Fallback - must be last
  ];
  function getAdapterForUrl(url) {
    for (const adapter of adapters) {
      if (adapter.canHandle(url)) {
        return adapter;
      }
    }
    return new GenericAdapter();
  }

  // extension/content/pageContext.ts
  function inferCourseCode(dom, url) {
    var _a;
    const urlMatch = url.match(/\b([A-Z]{3}\d{4})\b/i);
    if (urlMatch) {
      return urlMatch[1].toUpperCase();
    }
    const bodyText = ((_a = dom.body) == null ? void 0 : _a.innerText) || "";
    const codeMatch = bodyText.match(/\b([A-Z]{3}\d{4})\b/i);
    return codeMatch ? codeMatch[1].toUpperCase() : null;
  }
  function resolveAdapterContext(logger) {
    var _a, _b, _c;
    const log = {
      error: (_a = logger == null ? void 0 : logger.error) != null ? _a : console.error,
      warn: (_b = logger == null ? void 0 : logger.warn) != null ? _b : console.warn,
      debug: (_c = logger == null ? void 0 : logger.debug) != null ? _c : (() => {
      })
    };
    let adapter = new GenericAdapter();
    let pageContext = {
      url: window.location.href,
      title: document.title,
      heading: document.title,
      courseContext: { courseCode: null, sourceUrl: window.location.href }
    };
    try {
      adapter = getAdapterForUrl(window.location.href) || adapter;
      pageContext = adapter.getPageContext(document, window.location.href);
      const courseContext = pageContext.courseContext || { courseCode: null, sourceUrl: window.location.href };
      if (!courseContext.courseCode) {
        const inferred = inferCourseCode(document, window.location.href);
        if (inferred) {
          pageContext = {
            ...pageContext,
            courseContext: {
              ...courseContext,
              courseCode: inferred
            }
          };
        }
      }
    } catch (error) {
      log.error("Failed to get page context:", error);
    }
    return { adapter, pageContext };
  }
  if (typeof window !== "undefined") {
    window.LockInContent = window.LockInContent || {};
    window.LockInContent.resolveAdapterContext = resolveAdapterContext;
  }
  return __toCommonJS(pageContext_exports);
})();
