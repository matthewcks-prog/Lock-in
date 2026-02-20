import { StudyToolsDropdown } from '../tools';
import { TASKS_TAB_ID } from './constants';
import type { SidebarTabId } from './types';

interface SidebarHeaderActionsProps {
  activeTab: SidebarTabId;
  onTabChange: (tabId: SidebarTabId) => void;
}

export function SidebarHeaderActions({
  activeTab,
  onTabChange,
}: SidebarHeaderActionsProps): JSX.Element {
  const isTasksActive = activeTab === TASKS_TAB_ID;
  return (
    <>
      <StudyToolsDropdown />
      <button
        className={`lockin-tasks-trigger-btn${isTasksActive ? ' is-active' : ''}`}
        onClick={() => onTabChange(TASKS_TAB_ID)}
        aria-label="Tasks"
        title="Tasks"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M9 11l3 3L22 4" />
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
        </svg>
      </button>
    </>
  );
}
