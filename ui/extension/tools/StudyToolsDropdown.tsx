/**
 * StudyToolsDropdown Component
 *
 * Dropdown menu for selecting study tools.
 * Displayed in the top bar, right-aligned.
 */

import { useState, useEffect, useCallback } from 'react';
import { ChevronDown } from 'lucide-react';
import { TOOLS } from './registry';
import { useToolContext } from './ToolContext';

function formatTypeTag(typeTag: string): string {
  return typeTag.charAt(0).toUpperCase() + typeTag.slice(1);
}

function useCloseOnOutsideClick(isOpen: boolean, setIsOpen: (isOpen: boolean) => void): void {
  useEffect(() => {
    if (!isOpen) return;
    const handler = (): void => setIsOpen(false);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [isOpen, setIsOpen]);
}

function StudyToolMenu({
  onSelect,
}: {
  onSelect: (toolId: string, enabled: boolean) => void;
}): JSX.Element {
  return (
    <div className="lockin-study-tools-menu" role="listbox">
      {TOOLS.map((tool) => (
        <button
          key={tool.id}
          className={`lockin-study-tools-item ${!tool.enabled ? 'lockin-study-tools-item-disabled' : ''}`}
          onClick={() => onSelect(tool.id, tool.enabled)}
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
  );
}

export function StudyToolsDropdown(): JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const { openTool } = useToolContext();
  useCloseOnOutsideClick(isOpen, setIsOpen);

  const handleToggle = useCallback((): void => {
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
    <div className="lockin-study-tools-container" onClick={(event) => event.stopPropagation()}>
      <button
        className="lockin-study-tools-btn"
        onClick={handleToggle}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="lockin-study-tools-btn-label">Study Tools</span>
        <ChevronDown
          size={12}
          strokeWidth={2}
          className="lockin-study-tools-chevron"
          aria-hidden="true"
        />
      </button>
      {isOpen && <StudyToolMenu onSelect={handleToolSelect} />}
    </div>
  );
}
