import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

window.LockInContent = window.LockInContent || {};
await import('../fakeFullscreenExitButton.js');

const { createExitButton, removeExitButton } = window.LockInContent;

describe('fakeFullscreenExitButton', () => {
  let state;

  beforeEach(() => {
    state = { exitButton: null, exitVisibilityTimer: null };
  });

  afterEach(() => {
    removeExitButton(state);
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('exports createExitButton and removeExitButton', () => {
    expect(typeof createExitButton).toBe('function');
    expect(typeof removeExitButton).toBe('function');
  });

  it('creates a button with correct id and aria-label', () => {
    createExitButton(state, vi.fn());
    const btn = document.getElementById('lockin-fake-fullscreen-exit');
    expect(btn).toBeTruthy();
    expect(btn.getAttribute('aria-label')).toBe('Exit fullscreen');
    expect(btn.tagName).toBe('BUTTON');
  });

  it('calls onExit callback when clicked', () => {
    const onExit = vi.fn();
    createExitButton(state, onExit);
    const btn = document.getElementById('lockin-fake-fullscreen-exit');
    btn.click();
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it('removes button from DOM on removeExitButton', () => {
    createExitButton(state, vi.fn());
    expect(document.getElementById('lockin-fake-fullscreen-exit')).toBeTruthy();

    removeExitButton(state);
    expect(document.getElementById('lockin-fake-fullscreen-exit')).toBeFalsy();
    expect(state.exitButton).toBeNull();
  });

  it('cleans up stale button even without state reference', () => {
    const orphan = document.createElement('button');
    orphan.id = 'lockin-fake-fullscreen-exit';
    document.body.appendChild(orphan);

    removeExitButton(state);
    expect(document.getElementById('lockin-fake-fullscreen-exit')).toBeFalsy();
  });

  it('flashes with visibility class then removes it', async () => {
    vi.useFakeTimers();
    createExitButton(state, vi.fn());
    const btn = document.getElementById('lockin-fake-fullscreen-exit');

    expect(btn.classList.contains('lockin-exit-visible')).toBe(true);

    vi.advanceTimersByTime(2600);

    expect(btn.classList.contains('lockin-exit-visible')).toBe(false);
    vi.useRealTimers();
  });
});
