import { useCallback, useEffect, useRef, useState } from 'react';
import type { SidebarTabId, StorageAdapter } from './types';
import {
  SIDEBAR_ACTIVE_TAB_KEY,
  SELECTED_NOTE_ID_KEY,
  LEGACY_SELECTED_NOTE_ID_KEY,
  SIDEBAR_OPEN_KEY,
} from './constants';
import { coerceTab, isValidUUID } from './utils';

const LAYOUT_TRANSITION_MS = 320;
const FORCE_OPEN_DEBOUNCE_MS = 400;

interface UseSidebarStateOptions {
  activeTabExternal?: string;
  storage?: StorageAdapter;
  isOpen: boolean;
  onToggle: () => void;
}

interface UseSidebarStateResult {
  activeTab: SidebarTabId;
  setActiveTab: React.Dispatch<React.SetStateAction<SidebarTabId>>;
  handleTabChange: (tabId: SidebarTabId) => void;
  selectedNoteId: string | null;
  setSelectedNoteId: React.Dispatch<React.SetStateAction<string | null>>;
  isNoteEditing: boolean;
  setIsNoteEditing: React.Dispatch<React.SetStateAction<boolean>>;
}

function applySplitLayout(
  open: boolean,
  layoutTimeoutRef: React.MutableRefObject<number | null>,
): void {
  const body = document.body;
  const html = document.documentElement;

  if (open) {
    body.classList.add('lockin-sidebar-open');
    html.classList.add('lockin-sidebar-transitioning');
  } else {
    body.classList.remove('lockin-sidebar-open');
  }

  if (layoutTimeoutRef.current !== null) {
    window.clearTimeout(layoutTimeoutRef.current);
  }

  layoutTimeoutRef.current = window.setTimeout(() => {
    html.classList.remove('lockin-sidebar-transitioning');
  }, LAYOUT_TRANSITION_MS);
}

function useHydrateActiveTab(
  storage: StorageAdapter | undefined,
  setActiveTab: React.Dispatch<React.SetStateAction<SidebarTabId>>,
): void {
  useEffect(() => {
    if (storage === undefined) return;
    storage
      .get(SIDEBAR_ACTIVE_TAB_KEY)
      .then((tab) => {
        if (typeof tab !== 'string') return;
        setActiveTab(coerceTab(tab));
      })
      .catch(() => {
        /* ignore */
      });
  }, [setActiveTab, storage]);
}

function useHydrateSelectedNoteId({
  storage,
  setSelectedNoteId,
  setIsNoteIdLoaded,
}: {
  storage: StorageAdapter | undefined;
  setSelectedNoteId: React.Dispatch<React.SetStateAction<string | null>>;
  setIsNoteIdLoaded: React.Dispatch<React.SetStateAction<boolean>>;
}): void {
  useEffect(() => {
    if (storage === undefined) {
      setIsNoteIdLoaded(true);
      return;
    }

    storage
      .get(SELECTED_NOTE_ID_KEY)
      .then(async (noteId) => {
        const canonicalNoteId = typeof noteId === 'string' ? noteId : null;
        if (
          canonicalNoteId !== null &&
          canonicalNoteId.length > 0 &&
          isValidUUID(canonicalNoteId)
        ) {
          setSelectedNoteId(canonicalNoteId);
          setIsNoteIdLoaded(true);
          return;
        }

        const legacyNoteId = await storage.get<string>(LEGACY_SELECTED_NOTE_ID_KEY);
        const storedNoteId = typeof legacyNoteId === 'string' ? legacyNoteId : null;
        if (storedNoteId !== null && storedNoteId.length > 0 && isValidUUID(storedNoteId)) {
          setSelectedNoteId(storedNoteId);
        }
        setIsNoteIdLoaded(true);
      })
      .catch(() => {
        setIsNoteIdLoaded(true);
      });
  }, [setIsNoteIdLoaded, setSelectedNoteId, storage]);
}

function usePersistSelectedNoteId({
  storage,
  isNoteIdLoaded,
  selectedNoteId,
}: {
  storage: StorageAdapter | undefined;
  isNoteIdLoaded: boolean;
  selectedNoteId: string | null;
}): void {
  useEffect(() => {
    if (storage === undefined || isNoteIdLoaded === false) return;
    storage.set(SELECTED_NOTE_ID_KEY, selectedNoteId).catch(() => {
      /* ignore */
    });
  }, [selectedNoteId, storage, isNoteIdLoaded]);
}

function usePersistActiveTab(storage: StorageAdapter | undefined, activeTab: SidebarTabId): void {
  useEffect(() => {
    if (storage === undefined) return;
    storage.set(SIDEBAR_ACTIVE_TAB_KEY, activeTab).catch(() => {
      /* ignore */
    });
  }, [activeTab, storage]);
}

function usePersistOpenState(storage: StorageAdapter | undefined, isOpen: boolean): void {
  useEffect(() => {
    if (storage === undefined || storage.setLocal === undefined) return;
    storage.setLocal(SIDEBAR_OPEN_KEY, isOpen).catch(() => {
      /* ignore */
    });
  }, [isOpen, storage]);
}

function useSplitLayoutState(
  isOpen: boolean,
  layoutTimeoutRef: React.MutableRefObject<number | null>,
): void {
  useEffect(() => {
    applySplitLayout(isOpen, layoutTimeoutRef);
    return () => {
      applySplitLayout(false, layoutTimeoutRef);
      if (layoutTimeoutRef.current !== null) {
        window.clearTimeout(layoutTimeoutRef.current);
      }
    };
  }, [isOpen, layoutTimeoutRef]);
}

function useExternalTabSync(
  activeTabExternal: string | undefined,
  setActiveTab: React.Dispatch<React.SetStateAction<SidebarTabId>>,
): void {
  useEffect(() => {
    if (
      activeTabExternal === undefined ||
      activeTabExternal === null ||
      activeTabExternal.length === 0
    ) {
      return;
    }
    const nextTab = coerceTab(activeTabExternal);
    setActiveTab((current) => (current === nextTab ? current : nextTab));
  }, [activeTabExternal, setActiveTab]);
}

function useEscapeToClose(isOpen: boolean, onToggle: () => void): void {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && isOpen) {
        onToggle();
      }
    };

    if (!isOpen) return undefined;

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onToggle]);
}

function useForceOpenWhileEditing({
  isNoteEditing,
  isOpen,
  onToggle,
  lastForceOpenRef,
}: {
  isNoteEditing: boolean;
  isOpen: boolean;
  onToggle: () => void;
  lastForceOpenRef: React.MutableRefObject<number>;
}): void {
  useEffect(() => {
    if (!isNoteEditing || isOpen) return;

    const now = Date.now();
    if (now - lastForceOpenRef.current <= FORCE_OPEN_DEBOUNCE_MS) return;

    lastForceOpenRef.current = now;
    onToggle();
  }, [isNoteEditing, isOpen, lastForceOpenRef, onToggle]);
}

export function useSidebarState({
  activeTabExternal,
  storage,
  isOpen,
  onToggle,
}: UseSidebarStateOptions): UseSidebarStateResult {
  const [activeTab, setActiveTab] = useState<SidebarTabId>(coerceTab(activeTabExternal));
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [isNoteIdLoaded, setIsNoteIdLoaded] = useState(false);
  const [isNoteEditing, setIsNoteEditing] = useState(false);
  const lastForceOpenRef = useRef<number>(0);
  const layoutTimeoutRef = useRef<number | null>(null);

  const handleTabChange = useCallback((tabId: SidebarTabId) => {
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;

    setActiveTab(tabId);
    requestAnimationFrame(() => {
      window.scrollTo(scrollX, scrollY);
    });
  }, []);

  useHydrateActiveTab(storage, setActiveTab);
  useHydrateSelectedNoteId({ storage, setSelectedNoteId, setIsNoteIdLoaded });
  usePersistSelectedNoteId({ storage, isNoteIdLoaded, selectedNoteId });
  usePersistActiveTab(storage, activeTab);
  usePersistOpenState(storage, isOpen);
  useSplitLayoutState(isOpen, layoutTimeoutRef);
  useExternalTabSync(activeTabExternal, setActiveTab);
  useEscapeToClose(isOpen, onToggle);
  useForceOpenWhileEditing({ isNoteEditing, isOpen, onToggle, lastForceOpenRef });

  return {
    activeTab,
    setActiveTab,
    handleTabChange,
    selectedNoteId,
    setSelectedNoteId,
    isNoteEditing,
    setIsNoteEditing,
  };
}
