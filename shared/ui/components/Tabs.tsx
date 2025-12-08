/**
 * Tabs Component
 *
 * Reusable tabbed interface component.
 * Uses Tailwind CSS for styling.
 */

import React from "react";

export interface Tab {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

export interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  variant?: "line" | "pill";
}

export function Tabs({
  tabs,
  activeTab,
  onTabChange,
  variant = "line",
}: TabsProps) {
  const containerClasses =
    variant === "line"
      ? "flex gap-0 border-b border-gray-200"
      : "flex gap-2 bg-gray-100 p-1 rounded-lg";

  const tabClasses = (isActive: boolean) =>
    variant === "line"
      ? `px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
          isActive
            ? "border-blue-600 text-blue-600"
            : "border-transparent text-gray-600 hover:text-gray-900"
        }`
      : `px-4 py-2 text-sm font-medium transition-colors rounded-md ${
          isActive
            ? "bg-white text-blue-600 shadow-sm"
            : "text-gray-600 hover:text-gray-900"
        }`;

  return (
    <div className={containerClasses}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={tabClasses(tab.id === activeTab)}
          onClick={() => onTabChange(tab.id)}
        >
          {tab.icon && <span className="inline mr-1">{tab.icon}</span>}
          {tab.label}
        </button>
      ))}
    </div>
  );
}
