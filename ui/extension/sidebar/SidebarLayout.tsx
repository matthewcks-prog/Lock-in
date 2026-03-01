import type { ReactNode, PointerEvent as ReactPointerEvent } from 'react';
import { CloseButton } from '../components/CloseButton';

interface SidebarLayoutProps {
  isOpen: boolean;
  onToggle: () => void;
  onResizeStart: (event: ReactPointerEvent<HTMLDivElement>) => void;
  headerLeft: ReactNode;
  headerRight?: ReactNode;
  children: ReactNode;
}

export function SidebarLayout({
  isOpen,
  onToggle,
  onResizeStart,
  headerLeft,
  headerRight,
  children,
}: SidebarLayoutProps): JSX.Element {
  return (
    <>
      {!isOpen && (
        <button id="lockin-toggle-pill" onClick={onToggle} aria-label="Open Lock-in sidebar">
          Lock-in
        </button>
      )}

      {isOpen && (
        <div
          id="lockin-sidebar"
          className="lockin-sidebar"
          data-state={isOpen ? 'expanded' : 'collapsed'}
        >
          <div
            className="lockin-sidebar-resize-handle"
            onPointerDown={onResizeStart}
            aria-hidden="true"
          />
          <div className="lockin-top-bar">
            <div className="lockin-top-bar-left">{headerLeft}</div>
            <div className="lockin-top-bar-right">{headerRight}</div>
            <CloseButton onClick={onToggle} label="Close sidebar" />
          </div>
          {children}
        </div>
      )}
    </>
  );
}
