import { useCallback, useEffect, useRef } from 'react';

const DEFAULT_SYNC_KEY = 'lockin_sync_event';

export interface CrossTabSyncEvent<T = unknown> {
  type: string;
  ts: number;
  source: string;
  payload?: T;
}

interface UseCrossTabSyncOptions {
  onEvent: (event: CrossTabSyncEvent) => void;
  storageKey?: string;
}

export function useCrossTabSync(options: UseCrossTabSyncOptions) {
  const { onEvent, storageKey = DEFAULT_SYNC_KEY } = options;
  const handlerRef = useRef(onEvent);
  const instanceIdRef = useRef(`sync-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const lastSeenRef = useRef<Record<string, number>>({});
  const lastSentRef = useRef<Record<string, number>>({});

  useEffect(() => {
    handlerRef.current = onEvent;
  }, [onEvent]);

  const broadcast = useCallback(
    (type: string, payload?: unknown, throttleMs = 0) => {
      if (typeof chrome === 'undefined' || !chrome.storage?.local) return;
      const now = Date.now();
      const lastSent = lastSentRef.current[type] || 0;
      if (throttleMs > 0 && now - lastSent < throttleMs) {
        return;
      }
      lastSentRef.current[type] = now;
      const event: CrossTabSyncEvent = {
        type,
        ts: now,
        source: instanceIdRef.current,
        payload,
      };
      chrome.storage.local.set({ [storageKey]: event });
    },
    [storageKey],
  );

  useEffect(() => {
    if (typeof chrome === 'undefined' || !chrome.storage?.onChanged) return;

    const handleStorageChange = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string,
    ) => {
      if (areaName !== 'local') return;
      const change = changes[storageKey];
      if (!change?.newValue) return;
      const event = change.newValue as CrossTabSyncEvent;
      if (!event?.type) return;
      if (event.source === instanceIdRef.current) return;
      const lastSeen = lastSeenRef.current[event.type] || 0;
      if (event.ts && event.ts <= lastSeen) return;
      lastSeenRef.current[event.type] = event.ts || Date.now();
      handlerRef.current(event);
    };

    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => chrome.storage.onChanged.removeListener(handleStorageChange);
  }, [storageKey]);

  return { broadcast };
}
