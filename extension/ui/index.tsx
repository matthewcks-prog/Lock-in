/**
 * Lock-in Extension UI Entry Point
 *
 * Exports React components and utilities for the Chrome extension sidebar widget.
 * These components are extension-specific and are NOT shared with the future web app.
 *
 * This file is built by Vite to extension/ui/index.js and loaded by content scripts.
 */

import "./global.css";
import React from "react";
import { createRoot } from "react-dom/client";
import { LockInSidebar } from "./components/LockInSidebar";
import type { ApiClient } from "@api/client";
import type { StudyMode, PageContext } from "@core/domain/types";

// Re-export components
export { LockInSidebar } from "./components/LockInSidebar";
export { ChatPanel } from "./components/ChatPanel";
export { NotesPanel } from "./components/NotesPanel";
export { ChatHistoryPanel } from "./components/ChatHistoryPanel";

// Re-export hooks
export { useChat } from "./hooks/useChat";
export { useNotes } from "./hooks/useNotes";
export { useChatHistory } from "./hooks/useChatHistory";

/**
 * Singleton instance management
 * Ensures only ONE React root exists for the sidebar across all tabs
 */
let sidebarRoot: ReturnType<typeof createRoot> | null = null;
let sidebarContainer: HTMLElement | null = null;
let currentProps: SidebarProps | null = null;

interface SidebarProps {
  apiClient: ApiClient;
  isOpen: boolean;
  onToggle: () => void;
  currentMode: StudyMode;
  selectedText?: string;
  pageContext?: PageContext;
  storage?: {
    get: (key: string) => Promise<any>;
    set: (key: string, value: any) => Promise<void>;
  };
}

/**
 * Mount the LockInSidebar component to a DOM element
 */
export function mountLockInSidebar(
  container: HTMLElement,
  props: SidebarProps
): () => void {
  const root = createRoot(container);
  root.render(React.createElement(LockInSidebar, props));

  return () => {
    root.unmount();
  };
}

/**
 * Create and mount sidebar to page - SINGLETON PATTERN
 *
 * This function ensures:
 * 1. Only ONE React root exists on the page
 * 2. Props are updated when called again (React re-renders)
 * 3. The widget state persists when switching tabs
 */
export function createLockInSidebar(props: SidebarProps): {
  root: HTMLElement;
  unmount: () => void;
  updateProps: (newProps: Partial<SidebarProps>) => void;
} {
  // First time initialization
  if (
    !sidebarRoot ||
    !sidebarContainer ||
    !document.body.contains(sidebarContainer)
  ) {
    // Create root container only once
    sidebarContainer = document.createElement("div");
    sidebarContainer.id = "lockin-root";
    document.body.appendChild(sidebarContainer);

    sidebarRoot = createRoot(sidebarContainer);
  }

  // Store current props for updates
  currentProps = props;

  // Render with current props
  if (sidebarRoot) {
    sidebarRoot.render(React.createElement(LockInSidebar, currentProps));
  }

  return {
    root: sidebarContainer,
    unmount: () => {
      if (sidebarRoot) {
        sidebarRoot.unmount();
        sidebarRoot = null;
      }
      if (sidebarContainer && document.body.contains(sidebarContainer)) {
        sidebarContainer.remove();
        sidebarContainer = null;
      }
      currentProps = null;
    },
    updateProps: (newProps: Partial<SidebarProps>) => {
      // Merge with existing props
      if (currentProps) {
        currentProps = { ...currentProps, ...newProps };
      } else {
        currentProps = { ...props, ...newProps };
      }

      // Re-render with updated props
      if (sidebarRoot && currentProps) {
        sidebarRoot.render(React.createElement(LockInSidebar, currentProps));
      }
    },
  };
}

// Make React available globally for content scripts
if (typeof window !== "undefined") {
  (window as any).React = React;
  (window as any).LockInUI = {
    mountLockInSidebar,
    createLockInSidebar,
    LockInSidebar,
  };
}
