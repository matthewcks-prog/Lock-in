import { useCallback, useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react';
import type { StorageAdapter } from './types';

interface UseResizeOptions {
  storage?: StorageAdapter;
  minWidth?: number;
  maxWidth?: number;
  maxVw?: number;
  storageKey?: string;
}

export function useResize({
  storage,
  minWidth = 360,
  maxWidth = 1500,
  maxVw = 0.75,
  storageKey = 'lockin_sidebar_width',
}: UseResizeOptions) {
  const isResizingRef = useRef(false);
  const resizeRafRef = useRef<number | null>(null);
  const pendingWidthRef = useRef<number | null>(null);
  const currentWidthRef = useRef<number | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  const getMaxSidebarWidth = useCallback(() => {
    if (typeof window === 'undefined') return maxWidth;
    return Math.min(maxWidth, Math.floor(window.innerWidth * maxVw));
  }, [maxWidth, maxVw]);

  const clampSidebarWidth = useCallback(
    (width: number) => {
      const computedMax = getMaxSidebarWidth();
      const computedMin = Math.min(minWidth, computedMax);
      return Math.min(computedMax, Math.max(computedMin, Math.round(width)));
    },
    [getMaxSidebarWidth, minWidth],
  );

  const applySidebarWidth = useCallback(
    (width: number) => {
      if (typeof document === 'undefined') return;
      const clamped = clampSidebarWidth(width);
      currentWidthRef.current = clamped;
      document.documentElement.style.setProperty('--lockin-sidebar-width', `${clamped}px`);
    },
    [clampSidebarWidth],
  );

  const handleResizeStart = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      if (typeof window === 'undefined') return;
      event.preventDefault();
      event.stopPropagation();

      const handle = event.currentTarget;
      const pointerId = event.pointerId;

      const updateWidth = (clientX: number) => {
        const nextWidth = window.innerWidth - clientX;
        pendingWidthRef.current = nextWidth;
        if (resizeRafRef.current !== null) return;
        resizeRafRef.current = window.requestAnimationFrame(() => {
          resizeRafRef.current = null;
          if (pendingWidthRef.current === null) return;
          applySidebarWidth(pendingWidthRef.current);
          pendingWidthRef.current = null;
        });
      };

      const handlePointerMove = (moveEvent: PointerEvent) => {
        if (!isResizingRef.current) return;
        updateWidth(moveEvent.clientX);
      };

      const stopResize = () => {
        if (!isResizingRef.current) return;
        isResizingRef.current = false;
        cleanupRef.current = null;

        if (handle.hasPointerCapture?.(pointerId)) {
          handle.releasePointerCapture?.(pointerId);
        }

        document.documentElement.classList.remove('lockin-sidebar-resizing');
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', stopResize);
        window.removeEventListener('pointercancel', stopResize);

        if (resizeRafRef.current !== null) {
          window.cancelAnimationFrame(resizeRafRef.current);
          resizeRafRef.current = null;
        }

        if (pendingWidthRef.current !== null) {
          applySidebarWidth(pendingWidthRef.current);
          pendingWidthRef.current = null;
        }

        if (currentWidthRef.current !== null) {
          storage?.setLocal?.(storageKey, currentWidthRef.current).catch(() => {
            /* ignore */
          });
        }
      };

      isResizingRef.current = true;
      cleanupRef.current = stopResize;

      handle.setPointerCapture?.(pointerId);
      document.documentElement.classList.add('lockin-sidebar-resizing');
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', stopResize);
      window.addEventListener('pointercancel', stopResize);

      updateWidth(event.clientX);
    },
    [applySidebarWidth, storage, storageKey],
  );

  useEffect(() => {
    if (!storage?.getLocal) return;
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
        }
      })
      .catch(() => {
        /* ignore */
      });
    return () => {
      cancelled = true;
    };
  }, [applySidebarWidth, storage, storageKey]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handleResize = () => {
      if (currentWidthRef.current === null) return;
      applySidebarWidth(currentWidthRef.current);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [applySidebarWidth]);

  useEffect(() => {
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
      }
    };
  }, []);

  return { handleResizeStart };
}
