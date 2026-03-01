/**
 * useMoreOptionsMenu
 *
 * Encapsulates open/close state, keyboard navigation (Escape, ArrowDown/Up),
 * click-outside dismissal, and auto-focus-first for an accessible popup menu.
 * Extracted from the component so each unit of code stays within line budgets.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

export interface UseMoreOptionsMenuReturn {
  isOpen: boolean;
  triggerRef: React.RefObject<HTMLButtonElement>;
  menuRef: React.RefObject<HTMLDivElement>;
  close: () => void;
  toggle: () => void;
}

export function useMoreOptionsMenu(): UseMoreOptionsMenuReturn {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setIsOpen(false);
    triggerRef.current?.focus();
  }, []);

  const toggle = useCallback(() => setIsOpen((p) => !p), []);

  // Keyboard: Escape closes; ArrowDown/Up moves focus between menu items
  useEffect(() => {
    if (!isOpen) return;

    function onKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        close();
        return;
      }
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      e.preventDefault();
      const ns = menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]');
      if (ns === undefined) return;
      const arr = Array.from(ns);
      const i = arr.indexOf(document.activeElement as HTMLButtonElement);
      const next = e.key === 'ArrowDown' ? (i + 1) % arr.length : (i - 1 + arr.length) % arr.length;
      arr[next]?.focus();
    }

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, close]);

  // Click / tap outside both the trigger and the menu dismisses it
  useEffect(() => {
    if (!isOpen) return;

    function onPointerDown(e: MouseEvent): void {
      const t = e.target as Node;
      const inTrigger = triggerRef.current?.contains(t) === true;
      const inMenu = menuRef.current?.contains(t) === true;
      if (!inTrigger && !inMenu) close();
    }

    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [isOpen, close]);

  // Focus the first item when the menu opens
  useEffect(() => {
    if (!isOpen) return;
    menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
  }, [isOpen]);

  return { isOpen, triggerRef, menuRef, close, toggle };
}
