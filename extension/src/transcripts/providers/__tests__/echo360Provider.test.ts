/**
 * Echo360 Provider Tests
 */

import { describe, it, expect } from "vitest";
import {
  isEcho360Domain,
  isEcho360Url,
  extractEcho360Origin,
  extractSectionId,
  extractLessonId,
  extractMediaId,
  extractEcho360Context,
  Echo360TranscriptProvider,
} from "../echo360Provider";

describe("isEcho360Domain", () => {
  it("returns true for valid Echo360 domains", () => {
    expect(isEcho360Domain("echo360.net.au")).toBe(true);
    expect(isEcho360Domain("echo360.org.au")).toBe(true);
    expect(isEcho360Domain("echo360.org")).toBe(true);
    expect(isEcho360Domain("echo360.ca")).toBe(true);
    expect(isEcho360Domain("echo360.org.uk")).toBe(true);
    expect(isEcho360Domain("echo360qa.org")).toBe(true);
    expect(isEcho360Domain("echo360qa.dev")).toBe(true);
  });

  it("returns true for subdomains of Echo360 domains", () => {
    expect(isEcho360Domain("monash.echo360.net.au")).toBe(true);
    expect(isEcho360Domain("university.echo360.org")).toBe(true);
    expect(isEcho360Domain("app.echo360.ca")).toBe(true);
  });

  it("returns false for non-Echo360 domains", () => {
    expect(isEcho360Domain("echo360.com")).toBe(false);
    expect(isEcho360Domain("echo360.io")).toBe(false);
    expect(isEcho360Domain("example.com")).toBe(false);
    expect(isEcho360Domain("notecho360.net.au")).toBe(false);
  });

  it("is case insensitive", () => {
    expect(isEcho360Domain("ECHO360.NET.AU")).toBe(true);
    expect(isEcho360Domain("Echo360.Org.Au")).toBe(true);
  });
});

describe("isEcho360Url", () => {
  it("returns true for Echo360 URLs", () => {
    expect(isEcho360Url("https://echo360.net.au/section/abc123/home")).toBe(true);
    expect(isEcho360Url("https://echo360.org.au/lesson/xyz789/classroom")).toBe(true);
    expect(isEcho360Url("https://app.echo360.ca/section/def456/home")).toBe(true);
  });

  it("returns false for non-Echo360 URLs", () => {
    expect(isEcho360Url("https://example.com/page")).toBe(false);
    expect(isEcho360Url("https://panopto.com/embed")).toBe(false);
  });

  it("returns false for invalid URLs", () => {
    expect(isEcho360Url("not-a-url")).toBe(false);
    expect(isEcho360Url("")).toBe(false);
  });
});

describe("extractEcho360Origin", () => {
  it("extracts origin from Echo360 URLs", () => {
    expect(extractEcho360Origin("https://echo360.net.au/section/abc123/home")).toBe("https://echo360.net.au");
    expect(extractEcho360Origin("https://app.echo360.org/lesson/xyz/classroom")).toBe("https://app.echo360.org");
  });

  it("returns null for non-Echo360 URLs", () => {
    expect(extractEcho360Origin("https://example.com/page")).toBe(null);
  });
});

describe("extractSectionId", () => {
  it("extracts section ID from Echo360 section URLs", () => {
    expect(extractSectionId("https://echo360.net.au/section/d3e61b88-d8f7-4829-8e7f-a01d985392e0/home")).toBe("d3e61b88-d8f7-4829-8e7f-a01d985392e0");
    expect(extractSectionId("https://echo360.org/section/abc12345-1234-5678-9abc-def012345678/syllabus")).toBe("abc12345-1234-5678-9abc-def012345678");
  });

  it("returns null when no section ID is present", () => {
    expect(extractSectionId("https://echo360.net.au/lesson/abc123/classroom")).toBe(null);
    expect(extractSectionId("https://example.com/page")).toBe(null);
  });
});

describe("extractLessonId", () => {
  it("extracts lesson ID from Echo360 lesson URLs", () => {
    expect(extractLessonId("https://echo360.net.au/lesson/abc12345-1234-5678-9abc-def012345678/classroom")).toBe("abc12345-1234-5678-9abc-def012345678");
  });

  it("extracts complex lesson IDs with underscores, dots, and colons", () => {
    const complexId = "G_6f71556b-833c-468e-9aba-89fbc66d6e6f_19bae95c-ee99-44c1-975d-c45f07ca3db7_2025-07-31T13:58:00.000_2025-07-31T15:53:00.000";
    expect(extractLessonId(`https://echo360.net.au/lesson/${complexId}/classroom`)).toBe(complexId);
  });

  it("returns null when no lesson ID is present", () => {
    expect(extractLessonId("https://echo360.net.au/section/abc123/home")).toBe(null);
  });
});

describe("extractMediaId", () => {
  it("extracts media ID from URL query params", () => {
    expect(extractMediaId("https://echo360.net.au/lesson/abc/classroom?mediaId=xyz12345-1234-5678-9abc-def012345678")).toBe("xyz12345-1234-5678-9abc-def012345678");
  });

  it("extracts media ID from alternate param names", () => {
    expect(extractMediaId("https://echo360.net.au/lesson/abc/classroom?media=xyz123")).toBe("xyz123");
    expect(extractMediaId("https://echo360.net.au/lesson/abc/classroom?mid=abc456")).toBe("abc456");
  });

  it("returns null when no media ID is present", () => {
    expect(extractMediaId("https://echo360.net.au/lesson/abc/classroom")).toBe(null);
  });
});

describe("extractEcho360Context", () => {
  it("extracts full context from section URL", () => {
    const context = extractEcho360Context("https://echo360.net.au/section/d3e61b88-d8f7-4829-8e7f-a01d985392e0/home");
    expect(context).toEqual({
      echoOrigin: "https://echo360.net.au",
      sectionId: "d3e61b88-d8f7-4829-8e7f-a01d985392e0",
      lessonId: undefined,
      mediaId: undefined,
    });
  });

  it("extracts lesson ID from query params as fallback", () => {
    const context = extractEcho360Context("https://echo360.net.au/player?lessonId=lesson123&mediaId=media456");
    expect(context).not.toBe(null);
    expect(context?.lessonId).toBe("lesson123");
    expect(context?.mediaId).toBe("media456");
  });

  it("extracts full context from lesson URL", () => {
    const context = extractEcho360Context("https://echo360.net.au/lesson/abc12345-1234-5678-9abc-def012345678/classroom");
    expect(context).toEqual({
      echoOrigin: "https://echo360.net.au",
      sectionId: undefined,
      lessonId: "abc12345-1234-5678-9abc-def012345678",
      mediaId: undefined,
    });
  });

  it("extracts context with media ID", () => {
    const context = extractEcho360Context("https://echo360.net.au/lesson/lesson123/classroom?mediaId=media456");
    expect(context).not.toBe(null);
    expect(context?.mediaId).toBe("media456");
  });

  it("returns null for non-Echo360 URLs", () => {
    expect(extractEcho360Context("https://example.com/page")).toBe(null);
  });
});

describe("Echo360TranscriptProvider", () => {
  const provider = new Echo360TranscriptProvider();

  describe("canHandle", () => {
    it("returns true for Echo360 URLs", () => {
      expect(provider.canHandle("https://echo360.net.au/section/abc/home")).toBe(true);
      expect(provider.canHandle("https://echo360.org.au/lesson/xyz/classroom")).toBe(true);
    });

    it("returns false for non-Echo360 URLs", () => {
      expect(provider.canHandle("https://example.com/page")).toBe(false);
      expect(provider.canHandle("https://panopto.com/embed")).toBe(false);
    });
  });

  describe("detectVideos", () => {
    it("returns empty array (Echo360 uses API-based detection)", () => {
      const context = {
        pageUrl: "https://echo360.net.au/section/abc/home",
        iframes: [],
      };
      const videos = provider.detectVideos(context);
      expect(videos).toEqual([]);
    });
  });

  it("has correct provider type", () => {
    expect(provider.provider).toBe("echo360");
  });
});
