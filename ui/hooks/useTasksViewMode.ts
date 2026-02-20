/**
 * useTasksViewMode Hook
 *
 * Manages the view mode toggle (list vs board) for the Tasks panel.
 * Persists preference via StorageAdapter or localStorage fallback.
 */

import { useCallback, useEffect, useState } from 'react';
import type { TasksViewMode } from '@core/domain/Task';

const STORAGE_KEY = 'lockin_tasks_viewMode';

interface UseTasksViewModeOptions {
  storage?:
    | {
        get: <T = unknown>(key: string) => Promise<T | null>;
        set: (key: string, value: unknown) => Promise<void>;
      }
    | undefined;
}

interface UseTasksViewModeReturn {
  viewMode: TasksViewMode;
  setViewMode: (mode: TasksViewMode) => void;
  toggleViewMode: () => void;
}

export function useTasksViewMode(options: UseTasksViewModeOptions = {}): UseTasksViewModeReturn {
  const { storage } = options;
  const [viewMode, setViewModeState] = useState<TasksViewMode>('list');

  // Load persisted preference on mount
  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      try {
        if (storage !== undefined && storage !== null) {
          const saved = await storage.get<string>(STORAGE_KEY);
          if (!cancelled && (saved === 'list' || saved === 'board')) {
            setViewModeState(saved);
          }
        } else if (typeof localStorage !== 'undefined') {
          const saved = localStorage.getItem(STORAGE_KEY);
          if (!cancelled && (saved === 'list' || saved === 'board')) {
            setViewModeState(saved);
          }
        }
      } catch {
        // Ignore storage errors
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [storage]);

  const setViewMode = useCallback(
    (mode: TasksViewMode): void => {
      setViewModeState(mode);
      try {
        if (storage !== undefined && storage !== null) {
          void storage.set(STORAGE_KEY, mode).catch(() => {});
        } else if (typeof localStorage !== 'undefined') {
          localStorage.setItem(STORAGE_KEY, mode);
        }
      } catch {
        // Ignore storage errors
      }
    },
    [storage],
  );

  const toggleViewMode = useCallback((): void => {
    setViewMode(viewMode === 'list' ? 'board' : 'list');
  }, [viewMode, setViewMode]);

  return { viewMode, setViewMode, toggleViewMode };
}
