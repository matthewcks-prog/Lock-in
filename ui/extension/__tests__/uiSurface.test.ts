import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import type { SidebarInstance } from '../index';
import type { LockInSidebarProps } from '../LockInSidebar';

type LockInSidebarFactory = (props: LockInSidebarProps) => SidebarInstance;

type LockInUISurface = {
  createLockInSidebar: LockInSidebarFactory;
  LockInSidebar: (props: LockInSidebarProps) => unknown;
};

type TestWindow = typeof window & {
  LockInUI?: LockInUISurface;
  LockInSentry?: {
    initSentry?: (surface: string) => Promise<boolean>;
  };
};
const UI_SURFACE_TEST_TIMEOUT_MS = 30000;

describe('LockInUI global surface', () => {
  let testWindow: TestWindow;

  beforeEach(() => {
    vi.resetModules();
    testWindow = window as TestWindow;
    delete testWindow.LockInUI;
    testWindow.LockInSentry = {
      initSentry: vi.fn().mockResolvedValue(false),
    };
    document.body.innerHTML = '';
  });

  it(
    'attaches a stable LockInUI object on window with exact keys',
    async () => {
      await import('../index');

      const lockInUI = testWindow.LockInUI;
      expect(lockInUI).toBeDefined();
      expect(Object.keys(lockInUI ?? {}).sort()).toEqual(
        ['LockInSidebar', 'createLockInSidebar'].sort(),
      );
      expect(typeof lockInUI?.createLockInSidebar).toBe('function');
      expect(typeof lockInUI?.LockInSidebar).toBe('function');
    },
    UI_SURFACE_TEST_TIMEOUT_MS,
  );

  it(
    'exposes a callable sidebar factory that returns the expected instance contract',
    async () => {
      await import('../index');
      const { createLockInSidebar } = testWindow.LockInUI ?? {};

      expect(createLockInSidebar).toBeDefined();

      let instance: SidebarInstance | undefined;
      await act(async () => {
        instance = createLockInSidebar?.({
          apiClient: null,
          isOpen: false,
          onToggle: vi.fn(),
        });
      });

      expect(instance).toBeDefined();
      expect(typeof instance?.unmount).toBe('function');
      expect(typeof instance?.updateProps).toBe('function');
      expect(instance?.root).toBeDefined();

      await act(async () => {
        instance?.updateProps({ isOpen: true });
      });

      await act(async () => {
        instance?.unmount();
      });

      expect(document.getElementById('lockin-root')).toBeNull();
    },
    UI_SURFACE_TEST_TIMEOUT_MS,
  );
});
