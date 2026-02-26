/**
 * useTranscriptTimestampsPreference
 *
 * Manages user preference for showing/hiding transcript timestamps.
 * Persists to localStorage when available; falls back to in-memory state.
 * Single responsibility: read/write one boolean with safe storage access.
 */

import { useState, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'lockin_transcript_show_timestamps';
const DEFAULT = true;

function readStored(): boolean {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    if (raw === 'true') return true;
    if (raw === 'false') return false;
  } catch {
    // localStorage unavailable (private mode, SSR, etc.)
  }
  return DEFAULT;
}

function writeStored(value: boolean): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, value ? 'true' : 'false');
    }
  } catch {
    // Persist best-effort; state still updates for this session
  }
}

/**
 * Returns [showTimestamps, setShowTimestamps].
 * Preference is persisted to localStorage under lockin_transcript_show_timestamps.
 * Default is true (timestamps visible). Syncs across tabs via storage events.
 */
export function useTranscriptTimestampsPreference(): [
  showTimestamps: boolean,
  setShowTimestamps: (value: boolean) => void,
] {
  const [value, setValueState] = useState(readStored);

  useEffect((): (() => void) => {
    const handler = (e: StorageEvent): void => {
      if (e.key === STORAGE_KEY) setValueState(readStored());
    };
    window.addEventListener('storage', handler);
    return (): void => window.removeEventListener('storage', handler);
  }, []);

  const setValue = useCallback((next: boolean) => {
    setValueState(next);
    writeStored(next);
  }, []);

  return [value, setValue];
}
