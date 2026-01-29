/**
 * Export Types
 *
 * Defines the intermediate AST format used to decouple the Lexical editor
 * from export logic. This allows exporters to work with a normalized structure
 * independent of the editor implementation.
 */

// ============================================================================
// AST Version
// ============================================================================

/**
 * Current AST schema version. Increment when making breaking changes
 * to the normalized document structure.
 */
export const AST_VERSION = 1 as const;

// ============================================================================
// Intermediate AST Types
// ============================================================================

/**
 * Text formatting flags that can be combined.
 * Mirrors Lexical's format bitmask but as explicit booleans for clarity.
 */
export interface TextFormatting {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  code?: boolean;
}

/**
 * A run of text with consistent formatting.
 */
export interface TextRun {
  type: 'text';
  text: string;
  format: TextFormatting;
}

/**
 * A link containing text runs.
 */
export interface LinkNode {
  type: 'link';
  url: string;
  children: TextRun[];
}

/**
 * Inline content can be text runs or links.
 */
export type InlineContent = TextRun | LinkNode;

/**
 * A paragraph containing inline content.
 */
export interface ParagraphBlock {
  type: 'paragraph';
  children: InlineContent[];
}

/**
 * A heading with level 1-6.
 */
export interface HeadingBlock {
  type: 'heading';
  level: 1 | 2 | 3 | 4 | 5 | 6;
  children: InlineContent[];
}

/**
 * A list item containing inline content.
 */
export interface ListItemBlock {
  type: 'listItem';
  children: InlineContent[];
}

/**
 * A list (ordered or unordered) containing list items.
 */
export interface ListBlock {
  type: 'list';
  ordered: boolean;
  children: ListItemBlock[];
}

/**
 * A block quote containing inline content.
 */
export interface QuoteBlock {
  type: 'quote';
  children: InlineContent[];
}

/**
 * A code block with optional language.
 */
export interface CodeBlock {
  type: 'code';
  language?: string;
  code: string;
}

/**
 * A line break (hard break within content).
 */
export interface LineBreakBlock {
  type: 'linebreak';
}

/**
 * All possible block types in the intermediate AST.
 */
export type Block =
  | ParagraphBlock
  | HeadingBlock
  | ListBlock
  | QuoteBlock
  | CodeBlock
  | LineBreakBlock;

/**
 * The normalized document structure.
 * Includes version for forward compatibility.
 */
export interface NormalizedDocument {
  /** Schema version for migration support */
  version: typeof AST_VERSION;
  blocks: Block[];
}

// ============================================================================
// Export Types
// ============================================================================

/**
 * Supported export formats.
 */
export type ExportFormat = 'pdf' | 'markdown' | 'text';

/**
 * Metadata about the note being exported.
 */
export interface ExportMetadata {
  title: string;
  courseCode: string | null;
  week: number | null;
}

/**
 * Result of an export operation.
 */
export interface ExportResult {
  blob: Blob;
  filename: string;
  mimeType: string;
}

/**
 * Interface that all exporters must implement.
 * Uses strategy pattern for extensibility.
 */
export interface Exporter {
  readonly format: ExportFormat;
  readonly extension: string;
  readonly mimeType: string;

  /**
   * Exports the normalized document to the target format.
   */
  export(document: NormalizedDocument, metadata: ExportMetadata): Promise<Blob>;
}

/**
 * Options for the export manager.
 */
export interface ExportOptions {
  format: ExportFormat;
  metadata: ExportMetadata;
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * Error codes for export failures.
 * Enables programmatic error handling and user-friendly messages.
 */
export type ExportErrorCode =
  | 'EMPTY_CONTENT'
  | 'UNSUPPORTED_FORMAT'
  | 'GENERATION_FAILED'
  | 'INVALID_INPUT';

/**
 * Structured export error with code and user-friendly message.
 */
export class ExportError extends Error {
  readonly code: ExportErrorCode;
  readonly userMessage: string;

  constructor(code: ExportErrorCode, userMessage: string, technicalMessage?: string) {
    super(technicalMessage ?? userMessage);
    this.name = 'ExportError';
    this.code = code;
    this.userMessage = userMessage;
  }

  /** User-friendly error messages by code */
  static readonly messages: Record<ExportErrorCode, string> = {
    EMPTY_CONTENT: 'Cannot export an empty note. Add some content first.',
    UNSUPPORTED_FORMAT: 'This export format is not supported.',
    GENERATION_FAILED: 'Failed to generate the export file. Please try again.',
    INVALID_INPUT: 'The note content is invalid or corrupted.',
  };

  static empty(): ExportError {
    return new ExportError('EMPTY_CONTENT', this.messages.EMPTY_CONTENT);
  }

  static unsupportedFormat(format: string): ExportError {
    return new ExportError(
      'UNSUPPORTED_FORMAT',
      `Export format "${format}" is not supported.`,
      `Unsupported export format: ${format}`,
    );
  }

  static generationFailed(format: string, cause?: unknown): ExportError {
    const causeMessage = cause instanceof Error ? cause.message : String(cause);
    return new ExportError(
      'GENERATION_FAILED',
      `Failed to generate ${format.toUpperCase()} file. Please try again.`,
      `Export generation failed for ${format}: ${causeMessage}`,
    );
  }

  static invalidInput(): ExportError {
    return new ExportError('INVALID_INPUT', this.messages.INVALID_INPUT);
  }
}
