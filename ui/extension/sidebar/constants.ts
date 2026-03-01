import type { SidebarTabId } from './types';
import { CLIENT_STORAGE_KEYS, CLIENT_STORAGE_LEGACY_KEYS } from '@core/storage/clientStorageKeys';

export const CHAT_TAB_ID: SidebarTabId = 'chat';
export const NOTES_TAB_ID: SidebarTabId = 'notes';
export const STUDY_TAB_ID: SidebarTabId = 'study';
export const TASKS_TAB_ID: SidebarTabId = 'tasks';

export const SIDEBAR_ACTIVE_TAB_KEY = CLIENT_STORAGE_KEYS.SIDEBAR_ACTIVE_TAB;
export const SELECTED_NOTE_ID_KEY = CLIENT_STORAGE_KEYS.SELECTED_NOTE_ID;
export const LEGACY_SELECTED_NOTE_ID_KEY = CLIENT_STORAGE_LEGACY_KEYS.SIDEBAR_SELECTED_NOTE_ID;
export const SIDEBAR_WIDTH_KEY = CLIENT_STORAGE_KEYS.SIDEBAR_WIDTH;
export const SIDEBAR_OPEN_KEY = CLIENT_STORAGE_KEYS.SIDEBAR_IS_OPEN;
export const SIDEBAR_MIN_WIDTH = 420;
export const SIDEBAR_MAX_WIDTH = 1500;
export const SIDEBAR_MAX_VW = 0.75;

/**
 * Default sidebar width (px) used when no persisted width exists.
 * Matches the CSS --lockin-sidebar-ideal: max(560px, 35vw).
 */
export const SIDEBAR_DEFAULT_WIDTH = 560;
