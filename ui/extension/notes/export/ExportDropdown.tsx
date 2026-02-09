/**
 * Export Dropdown Component
 *
 * A dropdown menu for selecting note export format.
 * Shows available formats with icons and triggers export on selection.
 */

import { useCallback, useEffect, useState } from 'react';
import { Download, FileText, FileType } from 'lucide-react';
import type { Note } from '@core/domain/Note';
import type { ExportFormat } from './types';
import { ExportError } from './types';
import { exportAndDownload, getFormatDisplayInfo, hasExportableContent } from './ExportManager';

interface ExportDropdownProps {
  note: Note | null;
  week: number | null;
  disabled?: boolean;
  onExportStart?: () => void;
  onExportComplete?: () => void;
  onExportError?: (error: string) => void;
}

/**
 * Returns the icon component for a given format.
 */
function getFormatIcon(format: ExportFormat) {
  switch (format) {
    case 'pdf':
      return <FileText size={14} />;
    case 'markdown':
      return <FileType size={14} />;
    case 'text':
      return <FileText size={14} />;
    default:
      return <FileText size={14} />;
  }
}

export function ExportDropdown({
  note,
  week,
  disabled = false,
  onExportStart,
  onExportComplete,
  onExportError,
}: ExportDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportingFormat, setExportingFormat] = useState<ExportFormat | null>(null);

  const formats = getFormatDisplayInfo();
  const canExport = note && hasExportableContent(note.content) && !disabled && !isExporting;

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.lockin-export-dropdown')) {
        setIsOpen(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [isOpen]);

  // Close dropdown on escape
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  const handleToggle = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (canExport) {
        setIsOpen((prev) => !prev);
      }
    },
    [canExport],
  );

  const handleExport = useCallback(
    async (format: ExportFormat) => {
      if (!note || isExporting) return;

      setIsOpen(false);
      setIsExporting(true);
      setExportingFormat(format);
      onExportStart?.();

      try {
        await exportAndDownload({
          content: note.content,
          format,
          metadata: {
            title: note.title || 'Untitled Note',
            courseCode: note.courseCode,
            week,
          },
        });
        onExportComplete?.();
      } catch (error) {
        // Use user-friendly message from ExportError, or fallback to generic message
        const message =
          error instanceof ExportError
            ? error.userMessage
            : error instanceof Error
              ? error.message
              : 'Export failed. Please try again.';
        onExportError?.(message);
      } finally {
        setIsExporting(false);
        setExportingFormat(null);
      }
    },
    [note, week, isExporting, onExportStart, onExportComplete, onExportError],
  );

  return (
    <div className="lockin-export-dropdown">
      <button
        type="button"
        className={`lockin-export-btn ${isExporting ? 'is-exporting' : ''} ${!canExport ? 'is-disabled' : ''}`}
        onClick={handleToggle}
        disabled={!canExport}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        title={
          !note
            ? 'No note to export'
            : !hasExportableContent(note.content)
              ? 'Note is empty'
              : 'Export note'
        }
      >
        {isExporting ? (
          <>
            <span className="lockin-inline-spinner" aria-hidden="true" />
            <span>Exporting...</span>
          </>
        ) : (
          <>
            <Download size={14} />
            <span>Export</span>
            <span className="lockin-export-chevron" aria-hidden="true">
              {'\u25BC'}
            </span>
          </>
        )}
      </button>

      {isOpen && (
        <div className="lockin-export-menu" role="listbox">
          {formats.map((format) => (
            <button
              key={format.format}
              type="button"
              className={`lockin-export-item ${exportingFormat === format.format ? 'is-active' : ''}`}
              onClick={async () => handleExport(format.format)}
              role="option"
              aria-selected={exportingFormat === format.format}
            >
              {getFormatIcon(format.format)}
              <span className="lockin-export-item-label">{format.label}</span>
              <span className="lockin-export-item-ext">.{format.extension}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
