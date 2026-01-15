import { CHAT_TAB_ID, NOTES_TAB_ID, TOOL_TAB_ID } from './constants';
import type { SidebarTabId } from './types';

interface SidebarTabsProps {
  activeTab: SidebarTabId;
  onTabChange: (tabId: SidebarTabId) => void;
  activeToolId?: string | null;
  activeToolTitle?: string | null;
  onCloseTool?: () => void;
}

export function SidebarTabs({
  activeTab,
  onTabChange,
  activeToolId,
  activeToolTitle,
  onCloseTool,
}: SidebarTabsProps) {
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
      {activeToolId && (
        <button
          className={`lockin-tab lockin-tab-closable ${
            activeTab === TOOL_TAB_ID ? 'lockin-tab-active' : ''
          }`}
          onClick={() => onTabChange(TOOL_TAB_ID)}
          role="tab"
          aria-selected={activeTab === TOOL_TAB_ID}
        >
          <span>{activeToolTitle}</span>
          <span
            className="lockin-tab-close"
            onClick={(event) => {
              event.stopPropagation();
              onCloseTool?.();
              if (activeTab === TOOL_TAB_ID) {
                onTabChange(CHAT_TAB_ID);
              }
            }}
            role="button"
            aria-label={`Close ${activeToolTitle}`}
          >
            A-
          </span>
        </button>
      )}
    </div>
  );
}
