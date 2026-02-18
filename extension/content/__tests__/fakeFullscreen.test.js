/**
 * Tests for extension/content/fakeFullscreen.js
 *
 * The IIFE module registers on `window.LockInContent` on first import.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ── Load the IIFE module ────────────────────────────────────────────────────
window.LockInContent = window.LockInContent || {};
await import('../fakeFullscreen.js');

const { createFakeFullscreen } = window.LockInContent;

// ── Test Suite ──────────────────────────────────────────────────────────────

describe('fakeFullscreen content script', () => {
  let mockLogger;
  let mockStateStore;

  beforeEach(() => {
    mockLogger = {
      debug: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    mockStateStore = {
      getSnapshot: vi.fn().mockReturnValue({ isSidebarOpen: true }),
      subscribe: vi.fn().mockReturnValue(() => {}),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.classList.remove('lockin-fake-fullscreen');
    const toggle = document.getElementById('lockin-fake-fs-toggle');
    if (toggle) toggle.remove();
    document.querySelectorAll('.lockin-fake-fullscreen-video').forEach((el) => {
      el.classList.remove('lockin-fake-fullscreen-video');
    });
  });

  it('exports createFakeFullscreen on window.LockInContent', () => {
    expect(typeof createFakeFullscreen).toBe('function');
  });

  describe('creation and lifecycle', () => {
    it('creates an instance with expected API shape', () => {
      const fs = createFakeFullscreen({ Logger: mockLogger, stateStore: mockStateStore });
      expect(typeof fs.init).toBe('function');
      expect(typeof fs.destroy).toBe('function');
      expect(typeof fs.activate).toBe('function');
      expect(typeof fs.deactivate).toBe('function');
      expect(typeof fs.isActive).toBe('function');
    });

    it('starts inactive', () => {
      const fs = createFakeFullscreen({ Logger: mockLogger, stateStore: mockStateStore });
      expect(fs.isActive()).toBe(false);
    });

    it('init and destroy do not throw', () => {
      const fs = createFakeFullscreen({ Logger: mockLogger, stateStore: mockStateStore });
      expect(() => fs.init()).not.toThrow();
      expect(() => fs.destroy()).not.toThrow();
    });
  });

  describe('activate / deactivate', () => {
    it('rejects activation with null element', () => {
      const fs = createFakeFullscreen({ Logger: mockLogger, stateStore: mockStateStore });
      fs.init();
      expect(fs.activate(null)).toBe(false);
      expect(fs.isActive()).toBe(false);
      fs.destroy();
    });

    it('activates with a video element', () => {
      const video = document.createElement('video');
      video.id = 'test-video';
      document.body.appendChild(video);

      const fs = createFakeFullscreen({ Logger: mockLogger, stateStore: mockStateStore });
      fs.init();

      const result = fs.activate(video);
      expect(result).toBe(true);
      expect(fs.isActive()).toBe(true);
      expect(document.body.classList.contains('lockin-fake-fullscreen')).toBe(true);
      expect(video.classList.contains('lockin-fake-fullscreen-video')).toBe(true);

      fs.destroy();
      video.remove();
    });

    it('activates with a non-video wrapper div', () => {
      const wrapper = document.createElement('div');
      wrapper.id = 'player-wrapper';
      document.body.appendChild(wrapper);

      const fs = createFakeFullscreen({ Logger: mockLogger, stateStore: mockStateStore });
      fs.init();

      const result = fs.activate(wrapper);
      expect(result).toBe(true);
      expect(fs.isActive()).toBe(true);
      expect(wrapper.classList.contains('lockin-fake-fullscreen-video')).toBe(true);

      fs.destroy();
      wrapper.remove();
    });

    it('deactivates and cleans up DOM', () => {
      const video = document.createElement('video');
      video.id = 'deact-video';
      document.body.appendChild(video);

      const fs = createFakeFullscreen({ Logger: mockLogger, stateStore: mockStateStore });
      fs.init();
      fs.activate(video);
      expect(fs.isActive()).toBe(true);

      const result = fs.deactivate();
      expect(result).toBe(true);
      expect(fs.isActive()).toBe(false);
      expect(document.body.classList.contains('lockin-fake-fullscreen')).toBe(false);
      expect(video.classList.contains('lockin-fake-fullscreen-video')).toBe(false);

      fs.destroy();
      video.remove();
    });

    it('shows toggle button when activated', () => {
      const video = document.createElement('video');
      document.body.appendChild(video);

      const fs = createFakeFullscreen({ Logger: mockLogger, stateStore: mockStateStore });
      fs.init();
      fs.activate(video);

      const btn = document.getElementById('lockin-fake-fs-toggle');
      expect(btn).not.toBeNull();
      expect(btn.classList.contains('lockin-fake-fs-toggle--visible')).toBe(true);

      fs.destroy();
      video.remove();
    });

    it('hides toggle button when deactivated', () => {
      const video = document.createElement('video');
      document.body.appendChild(video);

      const fs = createFakeFullscreen({ Logger: mockLogger, stateStore: mockStateStore });
      fs.init();
      fs.activate(video);
      fs.deactivate();

      const btn = document.getElementById('lockin-fake-fs-toggle');
      if (btn) {
        expect(btn.classList.contains('lockin-fake-fs-toggle--visible')).toBe(false);
      }

      fs.destroy();
      video.remove();
    });
  });

  describe('keyboard handling', () => {
    it('deactivates on Escape key', () => {
      const video = document.createElement('video');
      document.body.appendChild(video);

      const fs = createFakeFullscreen({ Logger: mockLogger, stateStore: mockStateStore });
      fs.init();
      fs.activate(video);
      expect(fs.isActive()).toBe(true);

      const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
      document.dispatchEvent(event);
      expect(fs.isActive()).toBe(false);

      fs.destroy();
      video.remove();
    });
  });

  describe('destroy', () => {
    it('cleans up active state on destroy', () => {
      const video = document.createElement('video');
      document.body.appendChild(video);

      const fs = createFakeFullscreen({ Logger: mockLogger, stateStore: mockStateStore });
      fs.init();
      fs.activate(video);
      expect(fs.isActive()).toBe(true);

      fs.destroy();
      expect(fs.isActive()).toBe(false);
      expect(document.body.classList.contains('lockin-fake-fullscreen')).toBe(false);

      video.remove();
    });
  });

  describe('fullscreenchange interception', () => {
    it('intercepts real fullscreen when sidebar is open', async () => {
      const iframe = document.createElement('iframe');
      document.body.appendChild(iframe);

      // Mock the Fullscreen API on document
      const origFSElement = Object.getOwnPropertyDescriptor(
        Document.prototype,
        'fullscreenElement',
      );
      let fakeFullscreenEl = null;
      Object.defineProperty(document, 'fullscreenElement', {
        get: () => fakeFullscreenEl,
        configurable: true,
      });
      document.exitFullscreen = vi.fn().mockResolvedValue(undefined);

      const fs = createFakeFullscreen({ Logger: mockLogger, stateStore: mockStateStore });
      fs.init();

      // Simulate native fullscreen being entered
      fakeFullscreenEl = iframe;
      document.dispatchEvent(new Event('fullscreenchange'));

      // Wait for the exitFullscreen promise to resolve
      await vi.waitFor(() => {
        expect(fs.isActive()).toBe(true);
      });

      expect(document.exitFullscreen).toHaveBeenCalled();
      expect(iframe.classList.contains('lockin-fake-fullscreen-video')).toBe(true);

      fs.destroy();
      iframe.remove();
      fakeFullscreenEl = null;

      // Restore original property
      if (origFSElement) {
        Object.defineProperty(Document.prototype, 'fullscreenElement', origFSElement);
      } else {
        delete document.fullscreenElement;
      }
    });

    it('does not intercept when sidebar is closed', () => {
      const div = document.createElement('div');
      document.body.appendChild(div);

      mockStateStore.getSnapshot.mockReturnValue({ isSidebarOpen: false });

      const origFSElement = Object.getOwnPropertyDescriptor(
        Document.prototype,
        'fullscreenElement',
      );
      Object.defineProperty(document, 'fullscreenElement', {
        get: () => div,
        configurable: true,
      });
      document.exitFullscreen = vi.fn().mockResolvedValue(undefined);

      const fs = createFakeFullscreen({ Logger: mockLogger, stateStore: mockStateStore });
      fs.init();

      document.dispatchEvent(new Event('fullscreenchange'));

      expect(document.exitFullscreen).not.toHaveBeenCalled();
      expect(fs.isActive()).toBe(false);

      fs.destroy();
      div.remove();
      if (origFSElement) {
        Object.defineProperty(Document.prototype, 'fullscreenElement', origFSElement);
      } else {
        delete document.fullscreenElement;
      }
    });
  });
});
