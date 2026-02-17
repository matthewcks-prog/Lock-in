/**
 * Tabs Component
 *
 * Reusable tabbed interface component.
 * Uses Tailwind CSS with lockin design tokens for styling.
 */

import React from 'react';
import type { MutableRefObject } from 'react';

export interface Tab {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

export interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  variant?: 'line' | 'pill';
  ariaLabel?: string;
}

function getContainerClasses(variant: TabsProps['variant']): string {
  return variant === 'line'
    ? 'flex gap-0 border-b border-line'
    : 'flex gap-lockin-1 bg-surface-muted p-lockin-1 rounded-lockin-lg';
}

function getTabClasses(variant: TabsProps['variant'], isActive: boolean): string {
  return variant === 'line'
    ? `px-lockin-4 py-lockin-2 text-lockin-sm font-medium transition-colors duration-lockin-base border-b-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
        isActive
          ? 'border-accent text-accent'
          : 'border-transparent text-text-secondary hover:text-text-body'
      }`
    : `px-lockin-4 py-lockin-2 text-lockin-sm font-medium transition-colors duration-lockin-base rounded-lockin-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
        isActive
          ? 'bg-surface text-accent shadow-lockin-xs'
          : 'text-text-secondary hover:text-text-body'
      }`;
}

function useTabKeyboardNavigation(
  tabs: Tab[],
  onTabChange: (tabId: string) => void,
  tabRefs: MutableRefObject<(HTMLButtonElement | null)[]>,
): (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => void {
  const focusTab = React.useCallback(
    (targetIndex: number): void => {
      if (tabs.length === 0) return;
      const nextIndex = (targetIndex + tabs.length) % tabs.length;
      const nextTab = tabs[nextIndex];
      if (nextTab === undefined) return;
      onTabChange(nextTab.id);
      tabRefs.current[nextIndex]?.focus();
    },
    [onTabChange, tabRefs, tabs],
  );

  return React.useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>, index: number): void => {
      switch (event.key) {
        case 'ArrowRight':
        case 'ArrowDown':
          event.preventDefault();
          focusTab(index + 1);
          break;
        case 'ArrowLeft':
        case 'ArrowUp':
          event.preventDefault();
          focusTab(index - 1);
          break;
        case 'Home':
          event.preventDefault();
          focusTab(0);
          break;
        case 'End':
          event.preventDefault();
          focusTab(tabs.length - 1);
          break;
        default:
          break;
      }
    },
    [focusTab, tabs.length],
  );
}

export function Tabs({
  tabs,
  activeTab,
  onTabChange,
  variant = 'line',
  ariaLabel,
}: TabsProps): JSX.Element {
  const tabRefs = React.useRef<(HTMLButtonElement | null)[]>([]);
  const handleKeyDown = useTabKeyboardNavigation(tabs, onTabChange, tabRefs);

  return (
    <div className={getContainerClasses(variant)} role="tablist" aria-label={ariaLabel}>
      {tabs.map((tab, index) => (
        <button
          key={tab.id}
          ref={(node): void => {
            tabRefs.current[index] = node;
          }}
          className={getTabClasses(variant, tab.id === activeTab)}
          onClick={() => onTabChange(tab.id)}
          onKeyDown={(event) => handleKeyDown(event, index)}
          type="button"
          role="tab"
          aria-selected={tab.id === activeTab}
          tabIndex={tab.id === activeTab ? 0 : -1}
        >
          {tab.icon !== undefined && tab.icon !== null && (
            <span className="inline mr-1">{tab.icon}</span>
          )}
          {tab.label}
        </button>
      ))}
    </div>
  );
}
