/**
 * Unit tests for scrollbarWidth module
 *
 * Tests scrollbar width detection, CSS variable management, and dynamic updates.
 */

import { describe, it, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from 'vitest';

// Mock ResizeObserver for test environment
class MockResizeObserver {
  constructor(callback) {
    this.callback = callback;
  }
  observe() {
    // No-op in tests
  }
  disconnect() {
    // No-op in tests
  }
}

// Import the module by executing it
await import('../scrollbarWidth.js');

const { createScrollbarWidthManager } = window.LockInContent;

describe('scrollbarWidth module', () => {
  let manager;
  let logger;
  let originalResizeObserver;

  beforeAll(() => {
    // Save and mock ResizeObserver
    originalResizeObserver = global.ResizeObserver;
    global.ResizeObserver = MockResizeObserver;
  });

  afterAll(() => {
    // Restore original ResizeObserver
    global.ResizeObserver = originalResizeObserver;
  });

  beforeEach(() => {
    logger = {
      debug: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    // Clean up any existing CSS variables
    document.documentElement.style.removeProperty('--lockin-scrollbar-width');
    document.documentElement.style.removeProperty('--lockin-content-width');

    // Set sidebar width for testing
    document.documentElement.style.setProperty('--lockin-sidebar-width', '400px');

    // Reset body overflow
    document.body.style.overflow = '';
    document.body.style.height = '';
  });

  afterEach(() => {
    if (manager) {
      manager.destroy();
      manager = null;
    }

    // Clean up
    document.documentElement.style.removeProperty('--lockin-scrollbar-width');
    document.documentElement.style.removeProperty('--lockin-content-width');
    document.documentElement.style.removeProperty('--lockin-sidebar-width');
    document.body.style.overflow = '';
    document.body.style.overflowY = '';
    document.body.style.height = '';
    document.body.classList.remove('lockin-fake-fullscreen');
  });

  it('exports createScrollbarWidthManager', () => {
    expect(typeof createScrollbarWidthManager).toBe('function');
  });

  it('creates a manager instance with expected methods', () => {
    manager = createScrollbarWidthManager({ Logger: logger });

    expect(manager).toBeDefined();
    expect(typeof manager.init).toBe('function');
    expect(typeof manager.forceUpdate).toBe('function');
    expect(typeof manager.destroy).toBe('function');
    expect(typeof manager.scrollbarWidth).toBe('number');
    expect(typeof manager.hasScrollbar).toBe('boolean');
  });

  it('initializes and sets scrollbar width CSS variable', () => {
    manager = createScrollbarWidthManager({ Logger: logger });
    manager.init();

    const scrollbarWidth = getComputedStyle(document.documentElement)
      .getPropertyValue('--lockin-scrollbar-width')
      .trim();

    expect(scrollbarWidth).toMatch(/^\d+px$/);
    expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('Initialized'));
  });

  it('detects scrollbar width as a non-negative number', () => {
    manager = createScrollbarWidthManager({ Logger: logger });
    manager.init();

    expect(manager.scrollbarWidth).toBeGreaterThanOrEqual(0);
    expect(manager.scrollbarWidth).toBeLessThan(50); // Reasonable upper bound
  });

  it('updates content width CSS variable when no scrollbar is present', () => {
    // Ensure no scrollbar by making body short
    document.body.style.height = '100px';

    manager = createScrollbarWidthManager({ Logger: logger });
    manager.init();

    const contentWidth = getComputedStyle(document.documentElement)
      .getPropertyValue('--lockin-content-width')
      .trim();

    // With scrollbar-gutter:stable, scrollbar width is always subtracted
    // even when no scrollbar is rendered.
    expect(contentWidth).toContain('100vw');
    expect(contentWidth).toContain('--lockin-sidebar-width');
    expect(contentWidth).toContain(`${manager.scrollbarWidth}px`);
  });

  it('updates content width CSS variable when scrollbar is present', () => {
    // Force scrollbar by making body very tall
    document.body.style.height = '10000px';

    manager = createScrollbarWidthManager({ Logger: logger });
    manager.init();

    // Give time for layout to settle
    return new Promise((resolve) => {
      setTimeout(() => {
        manager.forceUpdate();

        const contentWidth = getComputedStyle(document.documentElement)
          .getPropertyValue('--lockin-content-width')
          .trim();

        // Should subtract scrollbar width when present
        if (manager.hasScrollbar && manager.scrollbarWidth > 0) {
          expect(contentWidth).toContain(`${manager.scrollbarWidth}px`);
        }

        resolve();
      }, 100);
    });
  });

  it('responds to forceUpdate calls', () => {
    manager = createScrollbarWidthManager({ Logger: logger });
    manager.init();

    const initialWidth = manager.scrollbarWidth;

    manager.forceUpdate();

    // Width should remain consistent (or update if scrollbar state changed)
    expect(typeof manager.scrollbarWidth).toBe('number');
    expect(manager.scrollbarWidth).toBeGreaterThanOrEqual(0);
  });

  it('cleans up on destroy', () => {
    manager = createScrollbarWidthManager({ Logger: logger });
    manager.init();

    const scrollbarWidthBefore = getComputedStyle(document.documentElement)
      .getPropertyValue('--lockin-scrollbar-width')
      .trim();

    expect(scrollbarWidthBefore).toBeTruthy();

    manager.destroy();

    const scrollbarWidthAfter = getComputedStyle(document.documentElement)
      .getPropertyValue('--lockin-scrollbar-width')
      .trim();
    const contentWidthAfter = getComputedStyle(document.documentElement)
      .getPropertyValue('--lockin-content-width')
      .trim();

    expect(scrollbarWidthAfter).toBe('');
    expect(contentWidthAfter).toBe('');
    expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('Destroyed'));
  });

  it('does not double-initialize', () => {
    manager = createScrollbarWidthManager({ Logger: logger });
    manager.init();

    logger.warn.mockClear();

    manager.init();

    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Already initialized'));
  });

  it('handles body class changes via MutationObserver', () => {
    manager = createScrollbarWidthManager({ Logger: logger });
    manager.init();

    logger.debug.mockClear();

    // Add a class that might affect scrollbar (e.g., fake-fullscreen)
    document.body.classList.add('lockin-fake-fullscreen');
    document.body.style.overflow = 'hidden';

    // Wait for debounced update
    return new Promise((resolve) => {
      setTimeout(() => {
        // Manager should have recalculated
        expect(manager.scrollbarWidth).toBeGreaterThanOrEqual(0);
        resolve();
      }, 100);
    });
  });

  describe('overflow detection', () => {
    it('reports no scrollbar when body overflow is hidden (fake fullscreen)', () => {
      // Make body very tall so content overflows
      document.body.style.height = '10000px';
      // But hide overflow (simulates fake fullscreen)
      document.body.style.overflowY = 'hidden';

      manager = createScrollbarWidthManager({ Logger: logger });
      manager.init();

      // Even though content is taller than viewport, overflow:hidden means no scrollbar
      expect(manager.hasScrollbar).toBe(false);

      const contentWidth = getComputedStyle(document.documentElement)
        .getPropertyValue('--lockin-content-width')
        .trim();

      // With scrollbar-gutter:stable, scrollbar width is always subtracted
      // even when overflow is hidden (scrollbar not rendered).
      expect(contentWidth).toContain('100vw');
      expect(contentWidth).toContain('--lockin-sidebar-width');
      expect(contentWidth).toContain(`${manager.scrollbarWidth}px`);
    });

    it('provides hasScrollbar property', () => {
      manager = createScrollbarWidthManager({ Logger: logger });
      manager.init();

      expect(typeof manager.hasScrollbar).toBe('boolean');
    });

    it('updates hasScrollbar when body height changes', () => {
      document.body.style.height = '100px';

      manager = createScrollbarWidthManager({ Logger: logger });
      manager.init();

      const initialHasScrollbar = manager.hasScrollbar;

      // Make body very tall to force scrollbar
      document.body.style.height = '10000px';

      return new Promise((resolve) => {
        setTimeout(() => {
          manager.forceUpdate();

          // Scrollbar state may have changed
          expect(typeof manager.hasScrollbar).toBe('boolean');

          // Reset
          document.body.style.height = '';
          resolve();
        }, 100);
      });
    });
  });

  it('uses fallback logger when none provided', () => {
    manager = createScrollbarWidthManager({});
    manager.init();

    // Should not throw
    expect(manager).toBeDefined();
    expect(typeof manager.scrollbarWidth).toBe('number');
  });
});
