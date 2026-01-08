/**
 * Tabs Component
 *
 * Reusable tabbed interface component.
 * Uses Tailwind CSS for styling.
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
      ? 'flex gap-0 border-b border-gray-200'
      : 'flex gap-2 bg-gray-100 p-1 rounded-lg';

  const tabClasses = (isActive: boolean) =>
    variant === 'line'
      ? `px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
          isActive
            ? 'border-blue-600 text-blue-600'
            : 'border-transparent text-gray-600 hover:text-gray-900'
        }`
      : `px-4 py-2 text-sm font-medium transition-colors rounded-md ${
          isActive ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
        }`;

  const tabRefs = React.useRef<(HTMLButtonElement | null)[]>([]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (tabs.length === 0) return;

    const focusTab = (targetIndex: number) => {
      const nextIndex = (targetIndex + tabs.length) % tabs.length;
      onTabChange(tabs[nextIndex].id);
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
