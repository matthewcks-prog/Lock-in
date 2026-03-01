import { useCallback, useEffect, useState, type MouseEvent as ReactMouseEvent } from 'react';
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

interface ExportMenuProps {
  exportingFormat: ExportFormat | null;
  onExport: (format: ExportFormat) => void;
}

function getFormatIcon(format: ExportFormat): JSX.Element {
  if (format === 'markdown') return <FileType size={14} />;
  return <FileText size={14} />;
}

function getExportTitle(note: Note | null): string {
  if (note === null) return 'No note to export';
  if (!hasExportableContent(note.content)) return 'Note is empty';
  return 'Export note';
}

function getExportErrorMessage(error: unknown): string {
  if (error instanceof ExportError) return error.userMessage;
  if (error instanceof Error) return error.message;
  return 'Export failed. Please try again.';
}

function useDropdownDismiss(isOpen: boolean, closeDropdown: () => void): void {
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent): void => {
      const target = event.target as HTMLElement;
      if (target.closest('.lockin-export-dropdown') === null) {
        closeDropdown();
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [closeDropdown, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        closeDropdown();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [closeDropdown, isOpen]);
}

async function runExport({
  note,
  format,
  week,
  onExportComplete,
  onExportError,
}: {
  note: Note;
  format: ExportFormat;
  week: number | null;
  onExportComplete: (() => void) | undefined;
  onExportError: ((error: string) => void) | undefined;
}): Promise<void> {
  try {
    await exportAndDownload({
      content: note.content,
      format,
      metadata: {
        title: note.title.length > 0 ? note.title : 'Untitled Note',
        courseCode: note.courseCode,
        week,
      },
    });
    onExportComplete?.();
  } catch (error) {
    onExportError?.(getExportErrorMessage(error));
  }
}

function useExportHandler({
  note,
  week,
  onExportStart,
  onExportComplete,
  onExportError,
  closeDropdown,
}: {
  note: Note | null;
  week: number | null;
  onExportStart: (() => void) | undefined;
  onExportComplete: (() => void) | undefined;
  onExportError: ((error: string) => void) | undefined;
  closeDropdown: () => void;
}): {
  isExporting: boolean;
  exportingFormat: ExportFormat | null;
  handleExport: (format: ExportFormat) => void;
} {
  const [isExporting, setIsExporting] = useState(false);
  const [exportingFormat, setExportingFormat] = useState<ExportFormat | null>(null);

  const handleExport = useCallback(
    (format: ExportFormat) => {
      if (note === null || isExporting) return;
      closeDropdown();
      setIsExporting(true);
      setExportingFormat(format);
      onExportStart?.();

      void (async () => {
        try {
          await runExport({ note, format, week, onExportComplete, onExportError });
        } finally {
          setIsExporting(false);
          setExportingFormat(null);
        }
      })();
    },
    [closeDropdown, isExporting, note, onExportComplete, onExportError, onExportStart, week],
  );

  return { isExporting, exportingFormat, handleExport };
}

function ExportMenu({ exportingFormat, onExport }: ExportMenuProps): JSX.Element {
  const formats = getFormatDisplayInfo();

  return (
    <div className="lockin-export-menu" role="listbox">
      {formats.map((format) => (
        <button
          key={format.format}
          type="button"
          className={`lockin-export-item ${exportingFormat === format.format ? 'is-active' : ''}`}
          onClick={() => {
            void onExport(format.format);
          }}
          role="option"
          aria-selected={exportingFormat === format.format}
        >
          {getFormatIcon(format.format)}
          <span className="lockin-export-item-label">{format.label}</span>
          <span className="lockin-export-item-ext">.{format.extension}</span>
        </button>
      ))}
    </div>
  );
}

function ExportTriggerButton({
  canExport,
  isExporting,
  isOpen,
  onClick,
  title,
}: {
  canExport: boolean;
  isExporting: boolean;
  isOpen: boolean;
  onClick: (event: ReactMouseEvent) => void;
  title: string;
}): JSX.Element {
  return (
    <button
      type="button"
      className={`lockin-export-btn ${isExporting ? 'is-exporting' : ''} ${!canExport || isExporting ? 'is-disabled' : ''}`}
      onClick={onClick}
      disabled={!canExport || isExporting}
      aria-haspopup="listbox"
      aria-expanded={isOpen}
      title={title}
    >
      {isExporting ? (
        <span className="lockin-inline-spinner" aria-hidden="true" />
      ) : (
        <>
          <Download size={14} />
          <span className="lockin-export-chevron" aria-hidden="true">
            {'\u25BC'}
          </span>
        </>
      )}
    </button>
  );
}

export function ExportDropdown({
  note,
  week,
  disabled = false,
  onExportStart,
  onExportComplete,
  onExportError,
}: ExportDropdownProps): JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const closeDropdown = useCallback(() => setIsOpen(false), []);
  const canExport = note !== null && hasExportableContent(note.content) && disabled === false;

  useDropdownDismiss(isOpen, closeDropdown);

  const { isExporting, exportingFormat, handleExport } = useExportHandler({
    note,
    week,
    onExportStart,
    onExportComplete,
    onExportError,
    closeDropdown,
  });

  const handleToggle = useCallback(
    (event: ReactMouseEvent) => {
      event.stopPropagation();
      if (!canExport || isExporting) return;
      setIsOpen((value) => !value);
    },
    [canExport, isExporting],
  );

  return (
    <div className="lockin-export-dropdown">
      <ExportTriggerButton
        canExport={canExport}
        isExporting={isExporting}
        isOpen={isOpen}
        onClick={handleToggle}
        title={getExportTitle(note)}
      />
      {isOpen ? <ExportMenu exportingFormat={exportingFormat} onExport={handleExport} /> : null}
    </div>
  );
}
