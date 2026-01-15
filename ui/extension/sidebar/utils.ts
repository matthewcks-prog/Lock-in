import { CHAT_TAB_ID, NOTES_TAB_ID, TOOL_TAB_ID } from './constants';
import type { SidebarTabId } from './types';

export function isValidUUID(value: string | null | undefined): boolean {
  if (!value) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function coerceTab(value?: string | null): SidebarTabId {
  if (value === NOTES_TAB_ID || value === TOOL_TAB_ID || value === CHAT_TAB_ID) return value;
  return CHAT_TAB_ID;
}
