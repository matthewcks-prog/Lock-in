/**
 * Canonical client storage keys for extension + UI surfaces.
 * Keep this file as the single source of truth for client-side persistence.
 */

export const CLIENT_STORAGE_KEYS = {
  SIDEBAR_IS_OPEN: 'lockin_sidebar_isOpen',
  SIDEBAR_ACTIVE_TAB: 'lockin_sidebar_activeTab',
  SIDEBAR_WIDTH: 'lockin_sidebar_width',
  CURRENT_CHAT_ID: 'lockinCurrentChatId',
  ACTIVE_CHAT_ID: 'lockin_sidebar_activeChatId',
  SELECTED_NOTE_ID: 'lockin_selectedNoteId',
  HIGHLIGHTING_ENABLED: 'highlightingEnabled',
  TELEMETRY_DISABLED: 'lockin_telemetry_disabled',
  TERMS_ACCEPTED_AT: 'lockin_acceptedTermsAt',
  MONASH_NOTICE_DISMISSED: 'dismissed.monashNotice',
  SUPABASE_SESSION: 'lockinSupabaseSession',
  TASKS_VIEW_MODE: 'lockin_tasks_viewMode',
  TRANSCRIPT_SHOW_TIMESTAMPS: 'lockin_transcript_show_timestamps',
  OFFLINE_NOTES_QUEUE: 'lockin_offline_notes_queue',
  PREFERRED_LANGUAGE: 'preferredLanguage',
} as const;

export const CLIENT_STORAGE_LEGACY_KEYS = {
  SIDEBAR_SELECTED_NOTE_ID: 'lockin_sidebar_selectedNoteId',
} as const;

export const CLIENT_STORAGE_KEY_ALIASES: Record<string, readonly string[]> = {
  [CLIENT_STORAGE_KEYS.SELECTED_NOTE_ID]: [CLIENT_STORAGE_LEGACY_KEYS.SIDEBAR_SELECTED_NOTE_ID],
} as const;

export const CLIENT_STORAGE_PREFIXES = {
  SESSION: 'lockin_session_',
} as const;

export const CLIENT_STORAGE_CLEAR_SCOPE = {
  sync: [
    CLIENT_STORAGE_KEYS.SIDEBAR_IS_OPEN,
    CLIENT_STORAGE_KEYS.SIDEBAR_ACTIVE_TAB,
    CLIENT_STORAGE_KEYS.ACTIVE_CHAT_ID,
    CLIENT_STORAGE_KEYS.SELECTED_NOTE_ID,
    CLIENT_STORAGE_KEYS.HIGHLIGHTING_ENABLED,
    CLIENT_STORAGE_KEYS.TELEMETRY_DISABLED,
    CLIENT_STORAGE_KEYS.SUPABASE_SESSION,
    CLIENT_STORAGE_KEYS.PREFERRED_LANGUAGE,
  ],
  local: [
    CLIENT_STORAGE_KEYS.CURRENT_CHAT_ID,
    CLIENT_STORAGE_KEYS.SIDEBAR_IS_OPEN,
    CLIENT_STORAGE_KEYS.SIDEBAR_WIDTH,
    CLIENT_STORAGE_KEYS.TERMS_ACCEPTED_AT,
    CLIENT_STORAGE_KEYS.MONASH_NOTICE_DISMISSED,
  ],
  localStorage: [
    CLIENT_STORAGE_KEYS.TASKS_VIEW_MODE,
    CLIENT_STORAGE_KEYS.TRANSCRIPT_SHOW_TIMESTAMPS,
    CLIENT_STORAGE_KEYS.OFFLINE_NOTES_QUEUE,
  ],
  localPrefixes: [CLIENT_STORAGE_PREFIXES.SESSION],
} as const;

const CLIENT_STORAGE_CANONICAL_LOOKUP = new Map<string, string>();

for (const [canonicalKey, aliases] of Object.entries(CLIENT_STORAGE_KEY_ALIASES)) {
  CLIENT_STORAGE_CANONICAL_LOOKUP.set(canonicalKey, canonicalKey);
  aliases.forEach((alias) => CLIENT_STORAGE_CANONICAL_LOOKUP.set(alias, canonicalKey));
}

export function canonicalizeClientStorageKey(key: string): string {
  return CLIENT_STORAGE_CANONICAL_LOOKUP.get(key) ?? key;
}

export function expandClientStorageKeyAliases(key: string): string[] {
  const canonicalKey = canonicalizeClientStorageKey(key);
  const aliases = CLIENT_STORAGE_KEY_ALIASES[canonicalKey] ?? [];
  return [canonicalKey, ...aliases.filter((alias) => alias !== canonicalKey)];
}

export function expandClientStorageKeyList(keys: readonly string[]): string[] {
  const expanded = new Set<string>();
  keys.forEach((key) => {
    expandClientStorageKeyAliases(key).forEach((expandedKey) => expanded.add(expandedKey));
  });
  return [...expanded];
}
