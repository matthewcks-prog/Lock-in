/**
 * Unit tests for adapter factory (integrations/index.ts)
 * 
 * Tests adapter selection logic.
 */

import { describe, it, expect } from "vitest";
import { getAdapterForUrl, getCurrentAdapter } from "../index";
import { MoodleAdapter } from "../adapters/moodleAdapter";
import { EdstemAdapter } from "../adapters/edstemAdapter";
import { GenericAdapter } from "../adapters/baseAdapter";

describe("Adapter Factory", () => {
  describe("getAdapterForUrl", () => {
    it("should return MoodleAdapter for Moodle URLs", () => {
      const adapter = getAdapterForUrl("https://learning.monash.edu/course/view.php?id=123");
      expect(adapter).toBeInstanceOf(MoodleAdapter);
    });

    it("should return EdstemAdapter for Edstem URLs", () => {
      const adapter = getAdapterForUrl("https://edstem.org/us/courses/12345");
      expect(adapter).toBeInstanceOf(EdstemAdapter);
    });

    it("should return GenericAdapter for unknown URLs", () => {
      const adapter = getAdapterForUrl("https://example.com/page");
      expect(adapter).toBeInstanceOf(GenericAdapter);
    });

    it("should prefer MoodleAdapter over GenericAdapter for Moodle URLs", () => {
      const adapter = getAdapterForUrl("https://learning.monash.edu/mod/page/view.php");
      expect(adapter).toBeInstanceOf(MoodleAdapter);
      expect(adapter).not.toBeInstanceOf(GenericAdapter);
    });

    it("should prefer EdstemAdapter over GenericAdapter for Edstem URLs", () => {
      const adapter = getAdapterForUrl("https://edstem.org/au/courses/67890");
      expect(adapter).toBeInstanceOf(EdstemAdapter);
      expect(adapter).not.toBeInstanceOf(GenericAdapter);
    });
  });

  describe("getCurrentAdapter", () => {
    it("should return GenericAdapter when window is undefined", () => {
      // Save original window
      const globalAny = globalThis as typeof globalThis & { window?: Window };
      const originalWindow = globalAny.window;
      delete (globalAny as { window?: Window }).window;

      try {
        const adapter = getCurrentAdapter();
        expect(adapter).toBeInstanceOf(GenericAdapter);
      } finally {
        // Restore window
        globalAny.window = originalWindow;
      }
    });

    it("should return adapter based on current URL when window is available", () => {
      // Mock window.location
      const originalLocation = window.location;
      Object.defineProperty(window, "location", {
        value: { href: "https://learning.monash.edu/course/view.php?id=123" },
        writable: true,
      });

      try {
        const adapter = getCurrentAdapter();
        expect(adapter).toBeInstanceOf(MoodleAdapter);
      } finally {
        // Restore location
        Object.defineProperty(window, "location", {
          value: originalLocation,
          writable: true,
        });
      }
    });
  });
});




