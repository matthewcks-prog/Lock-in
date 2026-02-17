import {
  useCallback,
  useEffect,
  useRef,
  type MutableRefObject,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import type { StorageAdapter } from './types';

interface UseResizeOptions {
  storage?: StorageAdapter;
  minWidth?: number;
  maxWidth?: number;
  maxVw?: number;
  defaultWidth?: number;
  storageKey?: string;
}

interface UseResizeReturn {
  handleResizeStart: (event: ReactPointerEvent<HTMLDivElement>) => void;
}

/** Debounce delay (ms) for window resize re-clamping. */
const RESIZE_DEBOUNCE_MS = 150;
const DEFAULT_MIN_WIDTH = 380;
const DEFAULT_MAX_WIDTH = 1500;
const DEFAULT_MAX_VIEWPORT_WIDTH_RATIO = 0.75;
const DEFAULT_WIDTH = 480;

interface ResizeRefs {
  isResizingRef: MutableRefObject<boolean>;
  resizeRafRef: MutableRefObject<number | null>;
  pendingWidthRef: MutableRefObject<number | null>;
  currentWidthRef: MutableRefObject<number | null>;
  cleanupRef: MutableRefObject<(() => void) | null>;
  resizeDebounceRef: MutableRefObject<number | null>;
}

function useResizeRefs(): ResizeRefs {
  return {
    isResizingRef: useRef(false),
    resizeRafRef: useRef<number | null>(null),
    pendingWidthRef: useRef<number | null>(null),
    currentWidthRef: useRef<number | null>(null),
    cleanupRef: useRef<(() => void) | null>(null),
    resizeDebounceRef: useRef<number | null>(null),
  };
}

function useSidebarWidthHelpers({
  minWidth,
  maxWidth,
  maxVw,
  currentWidthRef,
}: {
  minWidth: number;
  maxWidth: number;
  maxVw: number;
  currentWidthRef: MutableRefObject<number | null>;
}): {
  clampSidebarWidth: (width: number) => number;
  applySidebarWidth: (width: number) => void;
} {
  const getMaxSidebarWidth = useCallback((): number => {
    if (typeof window === 'undefined') return maxWidth;
    return Math.min(maxWidth, Math.floor(window.innerWidth * maxVw));
  }, [maxWidth, maxVw]);

  const clampSidebarWidth = useCallback(
    (width: number): number => {
      const computedMax = getMaxSidebarWidth();
      const computedMin = Math.min(minWidth, computedMax);
      return Math.min(computedMax, Math.max(computedMin, Math.round(width)));
    },
    [getMaxSidebarWidth, minWidth],
  );

  const applySidebarWidth = useCallback(
    (width: number): void => {
      if (typeof document === 'undefined') return;
      const clamped = clampSidebarWidth(width);
      currentWidthRef.current = clamped;
      document.documentElement.style.setProperty('--lockin-sidebar-width', `${clamped}px`);
    },
    [clampSidebarWidth, currentWidthRef],
  );

  return { clampSidebarWidth, applySidebarWidth };
}

function createRafWidthUpdater({
  applySidebarWidth,
  pendingWidthRef,
  resizeRafRef,
}: {
  applySidebarWidth: (width: number) => void;
  pendingWidthRef: MutableRefObject<number | null>;
  resizeRafRef: MutableRefObject<number | null>;
}): (clientX: number) => void {
  return (clientX: number): void => {
    pendingWidthRef.current = window.innerWidth - clientX;
    if (resizeRafRef.current !== null) return;

    resizeRafRef.current = window.requestAnimationFrame(() => {
      resizeRafRef.current = null;
      if (pendingWidthRef.current === null) return;
      applySidebarWidth(pendingWidthRef.current);
      pendingWidthRef.current = null;
    });
  };
}

function finalizeResizeSession({
  handle,
  pointerId,
  refs,
  applySidebarWidth,
  storage,
  storageKey,
  handlePointerMove,
}: {
  handle: HTMLDivElement;
  pointerId: number;
  refs: ResizeRefs;
  applySidebarWidth: (width: number) => void;
  storage: StorageAdapter | undefined;
  storageKey: string;
  handlePointerMove: (event: PointerEvent) => void;
}): void {
  if (!refs.isResizingRef.current) return;
  refs.isResizingRef.current = false;
  refs.cleanupRef.current = null;

  if (handle.hasPointerCapture?.(pointerId)) {
    handle.releasePointerCapture?.(pointerId);
  }

  document.documentElement.classList.remove('lockin-sidebar-resizing');
  window.removeEventListener('pointermove', handlePointerMove);

  if (refs.resizeRafRef.current !== null) {
    window.cancelAnimationFrame(refs.resizeRafRef.current);
    refs.resizeRafRef.current = null;
  }

  if (refs.pendingWidthRef.current !== null) {
    applySidebarWidth(refs.pendingWidthRef.current);
    refs.pendingWidthRef.current = null;
  }

  if (refs.currentWidthRef.current !== null) {
    storage?.setLocal?.(storageKey, refs.currentWidthRef.current).catch(() => {
      /* ignore */
    });
  }
}

function beginResizeSession({
  event,
  refs,
  applySidebarWidth,
  storage,
  storageKey,
}: {
  event: ReactPointerEvent<HTMLDivElement>;
  refs: ResizeRefs;
  applySidebarWidth: (width: number) => void;
  storage: StorageAdapter | undefined;
  storageKey: string;
}): void {
  const handle = event.currentTarget;
  const pointerId = event.pointerId;
  const updateWidth = createRafWidthUpdater({
    applySidebarWidth,
    pendingWidthRef: refs.pendingWidthRef,
    resizeRafRef: refs.resizeRafRef,
  });

  const handlePointerMove = (moveEvent: PointerEvent): void => {
    if (!refs.isResizingRef.current) return;
    updateWidth(moveEvent.clientX);
  };

  const stopResize = (): void => {
    window.removeEventListener('pointerup', stopResize);
    window.removeEventListener('pointercancel', stopResize);
    finalizeResizeSession({
      handle,
      pointerId,
      refs,
      applySidebarWidth,
      storage,
      storageKey,
      handlePointerMove,
    });
  };

  refs.isResizingRef.current = true;
  refs.cleanupRef.current = stopResize;

  handle.setPointerCapture?.(pointerId);
  document.documentElement.classList.add('lockin-sidebar-resizing');
  window.addEventListener('pointermove', handlePointerMove);
  window.addEventListener('pointerup', stopResize);
  window.addEventListener('pointercancel', stopResize);
  updateWidth(event.clientX);
}

function useRestoreSidebarWidth({
  storage,
  storageKey,
  defaultWidth,
  applySidebarWidth,
}: {
  storage: StorageAdapter | undefined;
  storageKey: string;
  defaultWidth: number;
  applySidebarWidth: (width: number) => void;
}): void {
  useEffect(() => {
    if (storage === undefined || storage.getLocal === undefined) {
      applySidebarWidth(defaultWidth);
      return;
    }

    let cancelled = false;
    storage
      .getLocal(storageKey)
      .then((storedWidth) => {
        if (cancelled) return;
        const numeric =
          typeof storedWidth === 'number'
            ? storedWidth
            : typeof storedWidth === 'string'
              ? Number.parseFloat(storedWidth)
              : null;
        if (typeof numeric === 'number' && !Number.isNaN(numeric) && numeric > 0) {
          applySidebarWidth(numeric);
        } else {
          applySidebarWidth(defaultWidth);
        }
      })
      .catch(() => {
        applySidebarWidth(defaultWidth);
      });

    return () => {
      cancelled = true;
    };
  }, [applySidebarWidth, defaultWidth, storage, storageKey]);
}

function useReclampOnWindowResize({
  refs,
  applySidebarWidth,
}: {
  refs: ResizeRefs;
  applySidebarWidth: (width: number) => void;
}): void {
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const handleWindowResize = (): void => {
      if (refs.isResizingRef.current || refs.currentWidthRef.current === null) return;
      if (document.documentElement.classList.contains('lockin-sidebar-transitioning')) return;

      if (refs.resizeDebounceRef.current !== null) {
        window.clearTimeout(refs.resizeDebounceRef.current);
      }

      refs.resizeDebounceRef.current = window.setTimeout(() => {
        refs.resizeDebounceRef.current = null;
        if (refs.currentWidthRef.current === null) return;
        applySidebarWidth(refs.currentWidthRef.current);
      }, RESIZE_DEBOUNCE_MS);
    };

    window.addEventListener('resize', handleWindowResize);
    return () => {
      window.removeEventListener('resize', handleWindowResize);
      if (refs.resizeDebounceRef.current !== null) {
        window.clearTimeout(refs.resizeDebounceRef.current);
      }
    };
  }, [applySidebarWidth, refs]);
}

function useResizeCleanup(refs: ResizeRefs): void {
  useEffect(() => {
    return () => {
      const cleanup = refs.cleanupRef.current;
      if (cleanup !== null) {
        cleanup();
      }
    };
  }, [refs]);
}

export function useResize({
  storage,
  minWidth = DEFAULT_MIN_WIDTH,
  maxWidth = DEFAULT_MAX_WIDTH,
  maxVw = DEFAULT_MAX_VIEWPORT_WIDTH_RATIO,
  defaultWidth = DEFAULT_WIDTH,
  storageKey = 'lockin_sidebar_width',
}: UseResizeOptions): UseResizeReturn {
  const refs = useResizeRefs();
  const { applySidebarWidth } = useSidebarWidthHelpers({
    minWidth,
    maxWidth,
    maxVw,
    currentWidthRef: refs.currentWidthRef,
  });

  const handleResizeStart = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.button !== 0 || typeof window === 'undefined') return;
      event.preventDefault();
      event.stopPropagation();
      beginResizeSession({ event, refs, applySidebarWidth, storage, storageKey });
    },
    [applySidebarWidth, refs, storage, storageKey],
  );

  useRestoreSidebarWidth({ storage, storageKey, defaultWidth, applySidebarWidth });
  useReclampOnWindowResize({ refs, applySidebarWidth });
  useResizeCleanup(refs);

  return { handleResizeStart };
}
