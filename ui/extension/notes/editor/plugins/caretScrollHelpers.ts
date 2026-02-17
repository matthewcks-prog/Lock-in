import { useEffect } from 'react';
import type { MutableRefObject } from 'react';
import type { LexicalEditor } from 'lexical';

const SCROLL_CONTAINER_SELECTOR = '.lockin-note-editor-scroll';

export interface CaretScrollConfig {
  topRatio?: number;
  bottomRatio?: number;
  scrollCushion?: number;
  smoothThreshold?: number;
}

export interface CaretScrollRuntimeConfig {
  topRatio: number;
  bottomRatio: number;
  scrollCushion: number;
  smoothThreshold: number;
  minScrollDelta: number;
  scrollThrottleMs: number;
}

export interface CaretScrollRefs {
  prefersReducedMotion: MutableRefObject<boolean>;
  lastScrollTime: MutableRefObject<number>;
}

interface ScrollContext {
  caretRect: DOMRect;
  containerRect: DOMRect;
  scrollContainer: HTMLElement;
}

interface ScrollBand {
  top: number;
  bottom: number;
}

interface RafDebouncer {
  schedule: () => void;
  cancel: () => void;
}

function getCollapsedSelectionRange(): Range | null {
  const selection = window.getSelection();
  if (selection === null || selection.rangeCount === 0) {
    return null;
  }
  const range = selection.getRangeAt(0);
  if (!range.collapsed) {
    return null;
  }
  return range;
}

function getScrollContainer(editor: LexicalEditor): HTMLElement | null {
  const rootElement = editor.getRootElement();
  if (rootElement === null) {
    return null;
  }
  return rootElement.closest(SCROLL_CONTAINER_SELECTOR) as HTMLElement | null;
}

function getScrollContext(editor: LexicalEditor): ScrollContext | null {
  const scrollContainer = getScrollContainer(editor);
  if (scrollContainer === null) {
    return null;
  }

  const range = getCollapsedSelectionRange();
  if (range === null) {
    return null;
  }

  const caretRect = range.getBoundingClientRect();
  if (caretRect.height === 0 && caretRect.width === 0) {
    return null;
  }

  return {
    caretRect,
    containerRect: scrollContainer.getBoundingClientRect(),
    scrollContainer,
  };
}

function getScrollBand(containerRect: DOMRect, topRatio: number, bottomRatio: number): ScrollBand {
  const containerHeight = containerRect.height;
  return {
    top: containerRect.top + containerHeight * topRatio,
    bottom: containerRect.top + containerHeight * bottomRatio,
  };
}

function getScrollDelta(caretRect: DOMRect, scrollBand: ScrollBand, scrollCushion: number): number {
  if (caretRect.top < scrollBand.top) {
    return caretRect.top - scrollBand.top - scrollCushion;
  }
  if (caretRect.bottom > scrollBand.bottom) {
    return caretRect.bottom - scrollBand.bottom + scrollCushion;
  }
  return 0;
}

function isThrottled(
  lastScrollTimeRef: MutableRefObject<number>,
  scrollThrottleMs: number,
): boolean {
  const now = Date.now();
  if (now - lastScrollTimeRef.current < scrollThrottleMs) {
    return true;
  }
  lastScrollTimeRef.current = now;
  return false;
}

function getScrollBehavior(
  prefersReducedMotion: boolean,
  scrollDelta: number,
  smoothThreshold: number,
): ScrollBehavior {
  if (prefersReducedMotion) {
    return 'auto';
  }
  return Math.abs(scrollDelta) > smoothThreshold ? 'smooth' : 'auto';
}

export function scrollCaretIntoComfortBand(
  editor: LexicalEditor,
  config: CaretScrollRuntimeConfig,
  refs: CaretScrollRefs,
): void {
  const context = getScrollContext(editor);
  if (context === null) {
    return;
  }

  const scrollBand = getScrollBand(context.containerRect, config.topRatio, config.bottomRatio);
  const scrollDelta = getScrollDelta(context.caretRect, scrollBand, config.scrollCushion);
  if (
    Math.abs(scrollDelta) < config.minScrollDelta ||
    isThrottled(refs.lastScrollTime, config.scrollThrottleMs)
  ) {
    return;
  }

  context.scrollContainer.scrollBy({
    top: scrollDelta,
    behavior: getScrollBehavior(
      refs.prefersReducedMotion.current,
      scrollDelta,
      config.smoothThreshold,
    ),
  });
}

export function useReducedMotionPreference(
  prefersReducedMotionRef: MutableRefObject<boolean>,
): void {
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    prefersReducedMotionRef.current = mediaQuery.matches;

    const handleChange = (event: MediaQueryListEvent): void => {
      prefersReducedMotionRef.current = event.matches;
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, [prefersReducedMotionRef]);
}

export function createRafDebouncer(callback: () => void): RafDebouncer {
  let rafId: number | null = null;

  return {
    schedule: (): void => {
      if (rafId !== null) {
        return;
      }
      rafId = requestAnimationFrame(() => {
        rafId = null;
        callback();
      });
    },
    cancel: (): void => {
      if (rafId === null) {
        return;
      }
      cancelAnimationFrame(rafId);
      rafId = null;
    },
  };
}
