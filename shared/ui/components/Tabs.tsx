/**
 * Tabs Component
 *
 * Reusable tabbed interface component.
 * Uses Tailwind CSS with lockin design tokens for styling.
 */

import React from 'react';

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

export function Tabs({ tabs, activeTab, onTabChange, variant = 'line', ariaLabel }: TabsProps) {
  const containerClasses =
    variant === 'line'
      ? 'flex gap-0 border-b border-line'
      : 'flex gap-lockin-1 bg-surface-muted p-lockin-1 rounded-lockin-lg';

  const tabClasses = (isActive: boolean) =>
    variant === 'line'
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

  const tabRefs = React.useRef<(HTMLButtonElement | null)[]>([]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (tabs.length === 0) return;

    const focusTab = (targetIndex: number) => {
      const nextIndex = (targetIndex + tabs.length) % tabs.length;
      const nextTab = tabs[nextIndex];
      if (!nextTab) return;
      onTabChange(nextTab.id);
      tabRefs.current[nextIndex]?.focus();
    };

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
  };

  return (
    <div className={containerClasses} role="tablist" aria-label={ariaLabel}>
      {tabs.map((tab, index) => (
        <button
          key={tab.id}
          ref={(node) => {
            tabRefs.current[index] = node;
          }}
          className={tabClasses(tab.id === activeTab)}
          onClick={() => onTabChange(tab.id)}
          onKeyDown={(event) => handleKeyDown(event, index)}
          type="button"
          role="tab"
          aria-selected={tab.id === activeTab}
          tabIndex={tab.id === activeTab ? 0 : -1}
        >
          {tab.icon && <span className="inline mr-1">{tab.icon}</span>}
          {tab.label}
        </button>
      ))}
    </div>
  );
}
