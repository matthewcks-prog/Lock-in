import { useEffect, useRef } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { COMMAND_PRIORITY_LOW, KEY_DOWN_COMMAND, SELECTION_CHANGE_COMMAND } from 'lexical';

/**
 * CaretScrollPlugin: Smart scrolling that keeps the caret within a "comfort band"
 *
 * UX principles:
 * - Wide comfort band (15%-85%) so scrolling is rare during normal editing
 * - When scrolling IS needed, scroll minimally (just bring caret slightly inside the band)
 * - Use 'auto' for small/medium moves to avoid laggy feel; 'smooth' only for big jumps
 * - Respects prefers-reduced-motion
 * - Debounced with RAF to prevent jitter
 */
export function CaretScrollPlugin({
  topRatio = 0.15,
  bottomRatio = 0.85,
  scrollCushion = 24,
  smoothThreshold = 150,
}: {
  /** Top boundary of comfort band (0-1, default 0.15 = 15% from top) */
  topRatio?: number;
  /** Bottom boundary of comfort band (0-1, default 0.85 = 85% from top) */
  bottomRatio?: number;
  /** Extra pixels to scroll past the band edge for breathing room */
  scrollCushion?: number;
  /** Scroll distance threshold above which to use smooth scrolling */
  smoothThreshold?: number;
}) {
  const [editor] = useLexicalComposerContext();
  const prefersReducedMotion = useRef(false);
  const lastScrollTime = useRef(0);

  // Check reduced motion preference
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    prefersReducedMotion.current = mediaQuery.matches;
    const handler = (e: MediaQueryListEvent) => {
      prefersReducedMotion.current = e.matches;
    };
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    const scrollToCaret = () => {
      const rootElement = editor.getRootElement();
      if (!rootElement) return;

      // Find the scroll container
      const scrollContainer = rootElement.closest(
        '.lockin-note-editor-scroll',
      ) as HTMLElement | null;
      if (!scrollContainer) return;

      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return;

      const range = selection.getRangeAt(0);
      if (!range.collapsed) return; // Only scroll for caret, not text selections

      // Get caret position relative to viewport
      const caretRect = range.getBoundingClientRect();
      const containerRect = scrollContainer.getBoundingClientRect();

      // Skip if caret rect is invalid (can happen during DOM updates)
      if (caretRect.height === 0 && caretRect.width === 0) return;

      // Calculate the comfort band boundaries (in viewport coordinates)
      const containerHeight = containerRect.height;
      const topBand = containerRect.top + containerHeight * topRatio;
      const bottomBand = containerRect.top + containerHeight * bottomRatio;

      const caretY = caretRect.top;
      const caretBottom = caretRect.bottom;

      // Check if caret is within the comfort band
      if (caretY >= topBand && caretBottom <= bottomBand) {
        return; // Caret is comfortable, no scroll needed
      }

      // Calculate minimal scroll to bring caret just inside the band
      // We add a small cushion so user sees some context
      let scrollDelta = 0;

      if (caretY < topBand) {
        // Caret is above the band - scroll up
        // Scroll just enough to put caret at topBand + cushion
        scrollDelta = caretY - topBand - scrollCushion;
      } else if (caretBottom > bottomBand) {
        // Caret is below the band - scroll down
        // Scroll just enough to put caret bottom at bottomBand - cushion
        scrollDelta = caretBottom - bottomBand + scrollCushion;
      }

      // Ignore tiny scroll amounts (prevents micro-jitter)
      if (Math.abs(scrollDelta) < 4) return;

      // Throttle scrolls slightly to prevent rapid-fire during fast typing
      const now = Date.now();
      if (now - lastScrollTime.current < 50) return;
      lastScrollTime.current = now;

      // Determine scroll behavior:
      // - Always 'auto' if user prefers reduced motion
      // - 'auto' for small moves (feels snappier)
      // - 'smooth' only for larger jumps (feels intentional)
      const useSmooth = !prefersReducedMotion.current && Math.abs(scrollDelta) > smoothThreshold;

      scrollContainer.scrollBy({
        top: scrollDelta,
        behavior: useSmooth ? 'smooth' : 'auto',
      });
    };

    // Debounce with RAF to batch updates within a frame
    let rafId: number | null = null;
    const debouncedScroll = () => {
      if (rafId !== null) return; // Already scheduled
      rafId = requestAnimationFrame(() => {
        rafId = null;
        scrollToCaret();
      });
    };

    // Listen for selection changes (clicks, arrow keys, etc.)
    const unregister = editor.registerCommand(
      SELECTION_CHANGE_COMMAND,
      () => {
        debouncedScroll();
        return false;
      },
      COMMAND_PRIORITY_LOW,
    );

    // Handle keyboard input - check scroll after keystroke is processed
    const unregisterKey = editor.registerCommand(
      KEY_DOWN_COMMAND,
      () => {
        // Use setTimeout to check after the DOM update from the keystroke
        window.setTimeout(debouncedScroll, 0);
        return false;
      },
      COMMAND_PRIORITY_LOW,
    );

    return () => {
      unregister();
      unregisterKey();
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [editor, topRatio, bottomRatio, scrollCushion, smoothThreshold]);

  return null;
}
