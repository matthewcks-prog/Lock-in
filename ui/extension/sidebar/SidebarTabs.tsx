import { CHAT_TAB_ID, NOTES_TAB_ID, STUDY_TAB_ID } from './constants';
import type { SidebarTabId } from './types';

interface SidebarTabsProps {
  activeTab: SidebarTabId;
  onTabChange: (tabId: SidebarTabId) => void;
}

const TOP_LEVEL_TABS: ReadonlyArray<{ id: SidebarTabId; label: string }> = [
  { id: CHAT_TAB_ID, label: 'Chat' },
  { id: NOTES_TAB_ID, label: 'Notes' },
  { id: STUDY_TAB_ID, label: 'Study' },
];

export function SidebarTabs({ activeTab, onTabChange }: SidebarTabsProps): JSX.Element {
  return (
    <div className="lockin-tabs-wrapper" role="tablist">
      {TOP_LEVEL_TABS.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            className={`lockin-tab ${isActive ? 'lockin-tab-active' : ''}`}
            onClick={() => onTabChange(tab.id)}
            role="tab"
            aria-selected={isActive}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
