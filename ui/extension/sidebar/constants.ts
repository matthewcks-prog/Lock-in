import type { SidebarTabId } from './types';

export const CHAT_TAB_ID: SidebarTabId = 'chat';
export const NOTES_TAB_ID: SidebarTabId = 'notes';
export const STUDY_TAB_ID: SidebarTabId = 'study';
export const TASKS_TAB_ID: SidebarTabId = 'tasks';

export const SIDEBAR_ACTIVE_TAB_KEY = 'lockin_sidebar_activeTab';
export const SELECTED_NOTE_ID_KEY = 'lockin_sidebar_selectedNoteId';
export const SIDEBAR_WIDTH_KEY = 'lockin_sidebar_width';
export const SIDEBAR_OPEN_KEY = 'lockin_sidebar_isOpen';
export const SIDEBAR_MIN_WIDTH = 420;
export const SIDEBAR_MAX_WIDTH = 1500;
export const SIDEBAR_MAX_VW = 0.75;

/**
 * Default sidebar width (px) used when no persisted width exists.
 * Matches the CSS --lockin-sidebar-ideal: max(560px, 35vw).
 */
export const SIDEBAR_DEFAULT_WIDTH = 560;
