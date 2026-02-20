import type { PageContext } from '@core/domain/types';
import type { StorageAdapter } from './types';
import type { useResize } from './useResize';
import type { useSidebarState } from './useSidebarState';
import {
  SIDEBAR_WIDTH_KEY,
  SIDEBAR_MIN_WIDTH,
  SIDEBAR_MAX_WIDTH,
  SIDEBAR_MAX_VW,
  SIDEBAR_DEFAULT_WIDTH,
} from './constants';

interface SidebarPropsSlice {
  isOpen: boolean;
  onToggle: () => void;
  activeTabExternal?: string;
  storage?: StorageAdapter;
}

export function buildSidebarStateOptions({
  isOpen,
  onToggle,
  activeTabExternal,
  storage,
}: SidebarPropsSlice): Parameters<typeof useSidebarState>[0] {
  const options: Parameters<typeof useSidebarState>[0] = { isOpen, onToggle };
  if (activeTabExternal !== undefined && activeTabExternal.length > 0) {
    options.activeTabExternal = activeTabExternal;
  }
  if (storage !== undefined) {
    options.storage = storage;
  }
  return options;
}

export function buildResizeOptions(storage?: StorageAdapter): Parameters<typeof useResize>[0] {
  const options: Parameters<typeof useResize>[0] = {
    minWidth: SIDEBAR_MIN_WIDTH,
    maxWidth: SIDEBAR_MAX_WIDTH,
    maxVw: SIDEBAR_MAX_VW,
    defaultWidth: SIDEBAR_DEFAULT_WIDTH,
    storageKey: SIDEBAR_WIDTH_KEY,
  };
  if (storage !== undefined) {
    options.storage = storage;
  }
  return options;
}

export function getPageContextValues(pageContext?: PageContext): {
  courseCode: string | null;
  currentWeek: number | null;
  pageUrl: string;
} {
  return {
    courseCode: pageContext?.courseContext.courseCode ?? null,
    currentWeek: pageContext?.courseContext?.week ?? null,
    pageUrl: pageContext?.url ?? (typeof window !== 'undefined' ? window.location.href : ''),
  };
}
