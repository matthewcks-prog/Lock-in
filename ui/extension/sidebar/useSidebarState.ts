import { useCallback, useEffect, useRef, useState } from 'react';
import type { SidebarTabId, StorageAdapter } from './types';
import {
  CHAT_TAB_ID,
  NOTES_TAB_ID,
  TOOL_TAB_ID,
  SIDEBAR_ACTIVE_TAB_KEY,
  SELECTED_NOTE_ID_KEY,
  SIDEBAR_OPEN_KEY,
} from './constants';
import { coerceTab, isValidUUID } from './utils';

interface UseSidebarStateOptions {
  activeTabExternal?: string;
  storage?: StorageAdapter;
  isOpen: boolean;
  onToggle: () => void;
}

export function useSidebarState({
  activeTabExternal,
  storage,
  isOpen,
  onToggle,
}: UseSidebarStateOptions) {
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

  const applySplitLayout = useCallback((open: boolean) => {
    const body = document.body;
    const html = document.documentElement;
    if (!body || !html) return;
    if (open) {
      body.classList.add('lockin-sidebar-open');
      html.classList.add('lockin-sidebar-transitioning');
    } else {
      body.classList.remove('lockin-sidebar-open');
    }
    if (layoutTimeoutRef.current) {
      window.clearTimeout(layoutTimeoutRef.current);
    }
    layoutTimeoutRef.current = window.setTimeout(() => {
      html.classList.remove('lockin-sidebar-transitioning');
    }, 320);
  }, []);

  useEffect(() => {
    if (!storage) return;
    storage
      .get(SIDEBAR_ACTIVE_TAB_KEY)
      .then((tab) => {
        if (typeof tab !== 'string') return;
        if (tab === CHAT_TAB_ID || tab === NOTES_TAB_ID || tab === TOOL_TAB_ID) {
          setActiveTab(tab);
        }
      })
      .catch(() => {
        /* ignore */
      });
  }, [storage]);

  useEffect(() => {
    if (!storage) {
      setIsNoteIdLoaded(true);
      return;
    }
    storage
      .get(SELECTED_NOTE_ID_KEY)
      .then((noteId) => {
        const storedNoteId = typeof noteId === 'string' ? noteId : null;
        if (storedNoteId && isValidUUID(storedNoteId)) {
          setSelectedNoteId(storedNoteId);
        }
        setIsNoteIdLoaded(true);
      })
      .catch(() => {
        setIsNoteIdLoaded(true);
      });
  }, [storage]);

  useEffect(() => {
    if (!storage || !isNoteIdLoaded) return;
    storage.set(SELECTED_NOTE_ID_KEY, selectedNoteId).catch(() => {
      /* ignore */
    });
  }, [selectedNoteId, storage, isNoteIdLoaded]);

  useEffect(() => {
    if (!storage) return;
    storage.set(SIDEBAR_ACTIVE_TAB_KEY, activeTab).catch(() => {
      /* ignore */
    });
  }, [activeTab, storage]);

  useEffect(() => {
    if (!storage?.setLocal) return;
    storage.setLocal(SIDEBAR_OPEN_KEY, isOpen).catch(() => {
      /* ignore */
    });
  }, [isOpen, storage]);

  useEffect(() => {
    applySplitLayout(isOpen);
    return () => {
      applySplitLayout(false);
      if (layoutTimeoutRef.current) {
        window.clearTimeout(layoutTimeoutRef.current);
      }
    };
  }, [applySplitLayout, isOpen]);

  useEffect(() => {
    if (!activeTabExternal) return;
    const nextTab = coerceTab(activeTabExternal);
    setActiveTab((current) => (current === nextTab ? current : nextTab));
  }, [activeTabExternal]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onToggle();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }

    return undefined;
  }, [isOpen, onToggle]);

  useEffect(() => {
    if (isNoteEditing && !isOpen) {
      const now = Date.now();
      if (now - lastForceOpenRef.current > 400) {
        lastForceOpenRef.current = now;
        onToggle();
      }
    }
  }, [isNoteEditing, isOpen, onToggle]);

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
