/**
 * useTranscriptTimestampsPreference – unit tests.
 * Mocks localStorage and storage events for persistence and cross-tab sync.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTranscriptTimestampsPreference } from '../useTranscriptTimestampsPreference';

const STORAGE_KEY = 'lockin_transcript_show_timestamps';

function makeStorageMock(): Storage {
  let store: Record<string, string> = {};
  return {
    getItem(key: string): string | null {
      return store[key] ?? null;
    },
    setItem(key: string, value: string): void {
      store[key] = value;
    },
    removeItem(key: string): void {
      delete store[key];
    },
    clear(): void {
      store = {};
    },
    get length(): number {
      return Object.keys(store).length;
    },
    key(index: number): string | null {
      return Object.keys(store)[index] ?? null;
    },
  };
}

describe('useTranscriptTimestampsPreference', () => {
  let mockStorage: Storage;

  beforeEach(() => {
    mockStorage = makeStorageMock();
    vi.stubGlobal('localStorage', mockStorage);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns default true when storage is empty', () => {
    const { result } = renderHook(() => useTranscriptTimestampsPreference());
    expect(result.current[0]).toBe(true);
  });

  it('returns false when storage has "false"', () => {
    mockStorage.setItem(STORAGE_KEY, 'false');
    const { result } = renderHook(() => useTranscriptTimestampsPreference());
    expect(result.current[0]).toBe(false);
  });

  it('returns true when storage has "true"', () => {
    mockStorage.setItem(STORAGE_KEY, 'true');
    const { result } = renderHook(() => useTranscriptTimestampsPreference());
    expect(result.current[0]).toBe(true);
  });

  it('setShowTimestamps updates state and persists to localStorage', () => {
    const { result } = renderHook(() => useTranscriptTimestampsPreference());
    expect(result.current[0]).toBe(true);

    act(() => {
      result.current[1](false);
    });
    expect(result.current[0]).toBe(false);
    expect(mockStorage.getItem(STORAGE_KEY)).toBe('false');

    act(() => {
      result.current[1](true);
    });
    expect(result.current[0]).toBe(true);
    expect(mockStorage.getItem(STORAGE_KEY)).toBe('true');
  });

  it('syncs when storage event fires (other tab)', () => {
    let storageHandler: ((e: StorageEvent) => void) | null = null;
    const addSpy = vi.spyOn(window, 'addEventListener').mockImplementation((event, handler) => {
      if (event === 'storage') storageHandler = handler as (e: StorageEvent) => void;
    });

    const { result } = renderHook(() => useTranscriptTimestampsPreference());
    expect(result.current[0]).toBe(true);

    addSpy.mockRestore();
    expect(storageHandler).not.toBeNull();

    mockStorage.setItem(STORAGE_KEY, 'false');
    act(() => {
      storageHandler!(new StorageEvent('storage', { key: STORAGE_KEY, newValue: 'false' }));
    });
    expect(result.current[0]).toBe(false);
  });
});
