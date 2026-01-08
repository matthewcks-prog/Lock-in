import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SidebarInstance } from '../index';
import type { LockInSidebarProps } from '../LockInSidebar';

type LockInSidebarFactory = (props: LockInSidebarProps) => SidebarInstance;

type LockInUISurface = {
  createLockInSidebar: LockInSidebarFactory;
  LockInSidebar: typeof import('../LockInSidebar').LockInSidebar;
};

type TestWindow = typeof window & {
  LockInUI?: LockInUISurface;
};

describe('LockInUI global surface', () => {
  let testWindow: TestWindow;

  beforeEach(() => {
    vi.resetModules();
    testWindow = window as TestWindow;
    delete testWindow.LockInUI;
    document.body.innerHTML = '';
  });

  it('attaches a stable LockInUI object on window with exact keys', async () => {
    await import('../index');

    const lockInUI = testWindow.LockInUI;
    expect(lockInUI).toBeDefined();
    expect(Object.keys(lockInUI ?? {}).sort()).toEqual(
      ['LockInSidebar', 'createLockInSidebar'].sort(),
    );
    expect(typeof lockInUI?.createLockInSidebar).toBe('function');
    expect(typeof lockInUI?.LockInSidebar).toBe('function');
  });

  it('exposes a callable sidebar factory that returns the expected instance contract', async () => {
    await import('../index');
    const { createLockInSidebar } = testWindow.LockInUI ?? {};

    expect(createLockInSidebar).toBeDefined();

    const instance = createLockInSidebar?.({
      apiClient: null,
      isOpen: false,
      onToggle: vi.fn(),
      currentMode: 'explain',
    });

    expect(instance).toBeDefined();
    expect(typeof instance?.unmount).toBe('function');
    expect(typeof instance?.updateProps).toBe('function');
    expect(instance?.root).toBeDefined();

    expect(() => instance?.updateProps({ isOpen: true })).not.toThrow();
    instance?.unmount();

    expect(document.getElementById('lockin-root')).toBeNull();
  });
});
