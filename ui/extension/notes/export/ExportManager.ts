/**
 * Export Manager
 *
 * Coordinates the export process: normalizes note content, selects the
 * appropriate exporter based on format, and triggers the browser download.
 *
 * Design notes:
 * - Uses strategy pattern for format selection
 * - Decoupled from editor implementation via normalizer
 * - Easy to extend with new formats (e.g., DOCX)
 */

import type { NoteContent } from '@core/domain/Note';
import type {
  Exporter,
  ExportFormat,
  ExportMetadata,
  ExportResult,
  NormalizedDocument,
} from './types';
import { ExportError } from './types';
import { documentHasContent, normalizeEditorState } from './normalizer';
import { MarkdownExporter, PdfExporter, TextExporter } from './exporters';

// ============================================================================
// Exporter Registry
// ============================================================================

/**
 * Registry of available exporters by format.
 * To add a new format:
 * 1. Create a new exporter class implementing the Exporter interface
 * 2. Register it here
 */
const exporterRegistry: Record<ExportFormat, Exporter> = {
  pdf: new PdfExporter(),
  markdown: new MarkdownExporter(),
  text: new TextExporter(),
};

/**
 * Returns display info for export formats.
 */
export function getFormatDisplayInfo(): Array<{
  format: ExportFormat;
  label: string;
  extension: string;
}> {
  return [
    { format: 'pdf', label: 'PDF Document', extension: 'pdf' },
    { format: 'markdown', label: 'Markdown', extension: 'md' },
    { format: 'text', label: 'Plain Text', extension: 'txt' },
  ];
}

// ============================================================================
// Filename Generation
// ============================================================================

/**
 * Characters that are illegal in filenames across Windows, macOS, and Linux.
 * Also includes control characters and other problematic characters.
 */
const ILLEGAL_FILENAME_CHARS = /[<>:"/\\|?*\x00-\x1f]/g;

/**
 * Emoji and other Unicode symbols that may cause issues in filenames.
 * Matches emoji, dingbats, symbols, and other non-letter/number Unicode.
 */
const EMOJI_AND_SYMBOLS =
  /[\u{1F000}-\u{1FFFF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{FE00}-\u{FE0F}]|[\u{1F900}-\u{1F9FF}]/gu;

/**
 * Slugifies a string for use in filenames.
 * - Removes emoji and special symbols
 * - Removes illegal filename characters
 * - Converts to lowercase ASCII
 * - Replaces spaces with dashes
 * - Collapses consecutive dashes
 *
 * @param text - The text to slugify
 * @returns A filesystem-safe slug
 */
function slugify(text: string): string {
  return (
    text
      // Normalize Unicode to decomposed form (separate base chars from diacritics)
      .normalize('NFD')
      // Remove diacritical marks (accents)
      .replace(/[\u0300-\u036f]/g, '')
      // Remove emoji and symbols
      .replace(EMOJI_AND_SYMBOLS, '')
      // Remove illegal filename characters
      .replace(ILLEGAL_FILENAME_CHARS, '')
      // Convert to lowercase
      .toLowerCase()
      // Trim whitespace
      .trim()
      // Replace spaces and underscores with dashes
      .replace(/[\s_]+/g, '-')
      // Remove any remaining non-alphanumeric except dashes
      .replace(/[^a-z0-9-]/g, '')
      // Collapse multiple dashes
      .replace(/-+/g, '-')
      // Trim leading/trailing dashes
      .replace(/^-+|-+$/g, '')
  );
}

/**
 * Generates a meaningful filename for the export.
 * Format: lock-in_<course>_<week>_<title>.<ext>
 */
export function generateFilename(metadata: ExportMetadata, extension: string): string {
  const parts: string[] = ['lock-in'];

  if (metadata.courseCode) {
    parts.push(slugify(metadata.courseCode));
  }

  if (metadata.week) {
    parts.push(`week${metadata.week}`);
  }

  if (metadata.title) {
    const titleSlug = slugify(metadata.title);
    // Limit title length in filename
    const truncatedTitle = titleSlug.slice(0, 50);
    if (truncatedTitle) {
      parts.push(truncatedTitle);
    }
  }

  // Fallback if no meaningful parts
  if (parts.length === 1) {
    parts.push('note');
    parts.push(Date.now().toString());
  }

  return `${parts.join('_')}.${extension}`;
}

// ============================================================================
// Download Helper
// ============================================================================

/**
 * Triggers a browser download for a blob.
 * Creates a temporary anchor element and clicks it.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);

  try {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } finally {
    // Clean up the object URL after a short delay
    // to ensure the download has started
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

// ============================================================================
// Export Manager
// ============================================================================

export interface ExportNoteOptions {
  content: NoteContent;
  format: ExportFormat;
  metadata: ExportMetadata;
}

export interface ExportDocumentOptions {
  document: NormalizedDocument;
  format: ExportFormat;
  metadata: ExportMetadata;
}

/**
 * Exports a normalized document to the specified format and returns the result.
 *
 * @throws {ExportError} If content is empty, format is unsupported, or generation fails
 */
export async function exportDocument(options: ExportDocumentOptions): Promise<ExportResult> {
  const { document, format, metadata } = options;

  const exporter = exporterRegistry[format];
  if (!exporter) {
    throw ExportError.unsupportedFormat(format);
  }

  if (!documentHasContent(document)) {
    throw ExportError.empty();
  }

  let blob: Blob;
  try {
    blob = await exporter.export(document, metadata);
  } catch (error) {
    throw ExportError.generationFailed(format, error);
  }

  const filename = generateFilename(metadata, exporter.extension);

  return {
    blob,
    filename,
    mimeType: exporter.mimeType,
  };
}

/**
 * Exports a note to the specified format and returns the result.
 * Does not trigger download - use downloadBlob for that.
 *
 * @throws {ExportError} If content is empty, format is unsupported, or generation fails
 */
export async function exportNote(options: ExportNoteOptions): Promise<ExportResult> {
  const { content, format, metadata } = options;

  // Normalize the editor state to intermediate AST
  const normalizedDocument = normalizeEditorState(content.editorState);
  return exportDocument({ document: normalizedDocument, format, metadata });
}

/**
 * Exports a note and triggers browser download.
 * This is the main entry point for the export feature.
 */
export async function exportAndDownload(options: ExportNoteOptions): Promise<void> {
  const result = await exportNote(options);
  downloadBlob(result.blob, result.filename);
}

/**
 * Checks if a note has exportable content.
 * This is a lightweight check used by the UI to enable/disable export buttons.
 */
export function hasExportableContent(content: NoteContent | null | undefined): boolean {
  if (!content?.editorState) return false;

  const normalizedDocument = normalizeEditorState(content.editorState);
  return documentHasContent(normalizedDocument);
}
