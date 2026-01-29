/**
 * Notes Export Module
 *
 * Provides functionality to export notes to various formats (PDF, Markdown, Text).
 *
 * Usage:
 * ```ts
 * import { exportAndDownload, getFormatDisplayInfo, hasExportableContent } from './export';
 *
 * // Check if note can be exported
 * if (hasExportableContent(note.content)) {
 *   // Export and download
 *   await exportAndDownload({
 *     content: note.content,
 *     format: 'pdf',
 *     metadata: {
 *       title: note.title,
 *       courseCode: note.courseCode,
 *       week: 5,
 *     },
 *   });
 * }
 * ```
 *
 * Extending with new formats:
 * 1. Create a new exporter class in ./exporters/ implementing the Exporter interface
 * 2. Add the format to ExportFormat type in ./types.ts
 * 3. Register the exporter in ./ExportManager.ts exporterRegistry
 * 4. Add display info in getFormatDisplayInfo()
 */

// Types
export type {
  ExportFormat,
  ExportMetadata,
  ExportResult,
  Exporter,
  NormalizedDocument,
} from './types';
export { AST_VERSION, ExportError } from './types';

// Manager functions
export {
  exportAndDownload,
  exportNote,
  generateFilename,
  getFormatDisplayInfo,
  hasExportableContent,
} from './ExportManager';

// Normalizer (for testing and advanced usage)
export {
  documentHasContent,
  extractPlainText,
  flattenInlineContent,
  normalizeEditorState,
} from './normalizer';

// Individual exporters (for direct use if needed)
export { MarkdownExporter, PdfExporter, TextExporter } from './exporters';

// UI Components
export { ExportDropdown } from './ExportDropdown';
