import { useCallback } from 'react';
import { X } from 'lucide-react';
import { CHAT_TAB_ID, NOTES_TAB_ID, TOOL_TAB_ID } from './constants';
import type { SidebarTabId } from './types';

interface SidebarTabsProps {
  activeTab: SidebarTabId;
  onTabChange: (tabId: SidebarTabId) => void;
  activeToolId?: string | null;
  activeToolTitle?: string | null;
  onCloseTool?: () => void;
}

interface ToolTabProps {
  activeTab: SidebarTabId;
  activeToolTitle: string | null | undefined;
  onCloseTool: (() => void) | undefined;
  onTabChange: (tabId: SidebarTabId) => void;
}

function hasActiveTool(activeToolId?: string | null): activeToolId is string {
  return activeToolId !== undefined && activeToolId !== null && activeToolId.length > 0;
}

/**
 * ToolTab renders a closable study-tool tab.
 *
 * WHY a wrapper div + two sibling buttons (not a single div with role="tab"):
 * A single <div role="tab"> wrapping a <button> suffers from a persistent font
 * inconsistency: host-page CSS resets (e.g. button { font-family: inherit })
 * apply to <button> elements but not <div> elements, so the div and button end
 * up with different computed fonts regardless of what named-layer CSS we write.
 *
 * By putting the label text in a genuine <button role="tab">, it follows the
 * exact same CSS cascade path as the Chat and Notes tabs. The close <button> is
 * a sibling — valid HTML, no nested-button constraint. The wrapper <div> is a
 * purely presentational flex container that owns the visual active/hover state.
 */
function ToolTab({
  activeTab,
  activeToolTitle,
  onCloseTool,
  onTabChange,
}: ToolTabProps): JSX.Element {
  const resolvedToolTitle = activeToolTitle ?? 'Tool';
  const isActive = activeTab === TOOL_TAB_ID;

  const handleClose = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      onCloseTool?.();
      if (activeTab === TOOL_TAB_ID) {
        onTabChange(CHAT_TAB_ID);
      }
    },
    [activeTab, onCloseTool, onTabChange],
  );

  return (
    <div
      className={`lockin-tab-closable-wrapper${isActive ? ' lockin-tab-active' : ''}`}
      /*
       * role="presentation" removes this purely-visual wrapper from the
       * accessibility tree, satisfying the ARIA tablist → tab parent–child
       * contract. The inner <button role="tab"> is the actual interactive node.
       */
      role="presentation"
    >
      {/*
       * Label button — same element type as Chat/Notes tabs so all three follow
       * an identical font cascade path on every host page.
       * Native <button> handles Enter/Space keyboard activation automatically.
       */}
      <button
        type="button"
        className="lockin-tab"
        role="tab"
        tabIndex={0}
        aria-selected={isActive}
        onClick={() => onTabChange(TOOL_TAB_ID)}
      >
        {resolvedToolTitle}
      </button>
      <button
        type="button"
        className="lockin-tab-close"
        onClick={handleClose}
        aria-label={`Close ${resolvedToolTitle}`}
        title={`Close ${resolvedToolTitle}`}
        tabIndex={-1}
      >
        <X size={12} strokeWidth={2.5} aria-hidden="true" />
      </button>
    </div>
  );
}

export function SidebarTabs({
  activeTab,
  onTabChange,
  activeToolId,
  activeToolTitle,
  onCloseTool,
}: SidebarTabsProps): JSX.Element {
  return (
    <div className="lockin-tabs-wrapper" role="tablist">
      {[CHAT_TAB_ID, NOTES_TAB_ID].map((tabId) => {
        const label = tabId === CHAT_TAB_ID ? 'Chat' : 'Notes';
        const isActive = activeTab === tabId;
        return (
          <button
            key={tabId}
            className={`lockin-tab ${isActive ? 'lockin-tab-active' : ''}`}
            onClick={() => onTabChange(tabId)}
            role="tab"
            aria-selected={isActive}
          >
            {label}
          </button>
        );
      })}
      {hasActiveTool(activeToolId) && (
        <ToolTab
          activeTab={activeTab}
          activeToolTitle={activeToolTitle}
          onCloseTool={onCloseTool}
          onTabChange={onTabChange}
        />
      )}
    </div>
  );
}
