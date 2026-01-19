/**
 * Study Tools - Tool Context
 *
 * Minimal context for active tool state.
 * Tool-specific state (e.g., selected video, transcript data) should live
 * inside the tool component, not here.
 */

import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from 'react';
import { getToolById } from './registry';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface ToolContextValue {
  /** Currently active tool ID, or null if no tool is open */
  activeToolId: string | null;
  /** Display label for active tool (for tab display) */
  activeToolTitle: string | null;
  /** Open a tool by ID */
  openTool: (toolId: string) => void;
  /** Close the current tool */
  closeTool: () => void;
}

// -----------------------------------------------------------------------------
// Context
// -----------------------------------------------------------------------------

const ToolContext = createContext<ToolContextValue | null>(null);

// -----------------------------------------------------------------------------
// Provider
// -----------------------------------------------------------------------------

interface ToolProviderProps {
  children: ReactNode;
}

export function ToolProvider({ children }: ToolProviderProps) {
  const [activeToolId, setActiveToolId] = useState<string | null>(null);
  const [activeToolTitle, setActiveToolTitle] = useState<string | null>(null);

  const openTool = useCallback((toolId: string) => {
    const tool = getToolById(toolId);
    if (tool && tool.enabled) {
      setActiveToolId(toolId);
      setActiveToolTitle(tool.label);
    }
  }, []);

  const closeTool = useCallback(() => {
    setActiveToolId(null);
    setActiveToolTitle(null);
  }, []);

  // Memoize context value to avoid unnecessary rerenders
  const value = useMemo<ToolContextValue>(
    () => ({
      activeToolId,
      activeToolTitle,
      openTool,
      closeTool,
    }),
    [activeToolId, activeToolTitle, openTool, closeTool],
  );

  return <ToolContext.Provider value={value}>{children}</ToolContext.Provider>;
}

// -----------------------------------------------------------------------------
// Hook
// -----------------------------------------------------------------------------

export function useToolContext(): ToolContextValue {
  const context = useContext(ToolContext);
  if (!context) {
    throw new Error('useToolContext must be used within a ToolProvider');
  }
  return context;
}
