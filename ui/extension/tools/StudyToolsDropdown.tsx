/**
 * StudyToolsDropdown Component
 *
 * Dropdown menu for selecting study tools.
 * Displayed in the top bar, right-aligned.
 */

import { useState, useEffect, useCallback } from 'react';
import { TOOLS } from './registry';
import { useToolContext } from './ToolContext';

function formatTypeTag(typeTag: string): string {
  return typeTag.charAt(0).toUpperCase() + typeTag.slice(1);
}

export function StudyToolsDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const { openTool } = useToolContext();

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isOpen) return;
    const handler = () => setIsOpen(false);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [isOpen]);

  const handleToggle = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const handleToolSelect = useCallback(
    (toolId: string, enabled: boolean) => {
      if (enabled) {
        openTool(toolId);
        setIsOpen(false);
      }
    },
    [openTool],
  );

  return (
    <div className="lockin-study-tools-container" onClick={(e) => e.stopPropagation()}>
      <button
        className="lockin-study-tools-btn"
        onClick={handleToggle}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span>Study Tools</span>
        <span className="lockin-study-tools-chevron" aria-hidden="true">
          ▼
        </span>
      </button>
      {isOpen && (
        <div className="lockin-study-tools-menu" role="listbox">
          {TOOLS.map((tool) => (
            <button
              key={tool.id}
              className={`lockin-study-tools-item ${!tool.enabled ? 'lockin-study-tools-item-disabled' : ''}`}
              onClick={() => handleToolSelect(tool.id, tool.enabled)}
              disabled={!tool.enabled}
              role="option"
              aria-disabled={!tool.enabled}
            >
              <span>
                {tool.label} ({formatTypeTag(tool.typeTag)})
              </span>
              {!tool.enabled && <span className="lockin-coming-soon">Coming soon</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
