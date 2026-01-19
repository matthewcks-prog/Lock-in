/**
 * Lock-in Extension UI Entry Point
 *
 * Exposes the React sidebar component + factory as `window.LockInUI`.
 * The actual sidebar implementation lives in `LockInSidebar.tsx`.
 */

import { createRoot, Root } from 'react-dom/client';
import { LockInSidebar } from './LockInSidebar';
import type { LockInSidebarProps } from './LockInSidebar';
import { initSentry } from '../../extension/src/sentry';

// Initialize Sentry for error tracking (sidebar surface)
// This runs early before the React app renders to catch all errors
initSentry('sidebar');

export interface SidebarInstance {
  root: Root;
  unmount: () => void;
  updateProps: (newProps: Partial<LockInSidebarProps>) => void;
}

export function createLockInSidebar(props: LockInSidebarProps): SidebarInstance {
  let container = document.getElementById('lockin-root');
  if (!container) {
    container = document.createElement('div');
    container.id = 'lockin-root';
    document.body.appendChild(container);
  }

  let currentProps: LockInSidebarProps | null = { ...props };
  const root = createRoot(container);

  const render = () => {
    if (currentProps) {
      root.render(<LockInSidebar {...currentProps} />);
    }
  };

  render();

  return {
    root,
    unmount: () => {
      root.unmount();
      container?.remove();
      currentProps = null;
    },
    updateProps: (newProps: Partial<LockInSidebarProps>) => {
      if (currentProps) {
        currentProps = { ...currentProps, ...newProps };
        render();
      }
    },
  };
}

if (typeof window !== 'undefined') {
  (window as any).LockInUI = {
    createLockInSidebar,
    LockInSidebar,
  };
}
