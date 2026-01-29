/**
 * Lexical Editor State Normalizer
 *
 * Converts Lexical's editor state JSON into a format-agnostic intermediate AST.
 * This decouples export logic from the editor implementation, making it easier
 * to test and extend with new export formats.
 */

import {
  AST_VERSION,
  type Block,
  type CodeBlock,
  type HeadingBlock,
  type InlineContent,
  type LineBreakBlock,
  type LinkNode,
  type ListBlock,
  type ListItemBlock,
  type NormalizedDocument,
  type ParagraphBlock,
  type QuoteBlock,
  type TextFormatting,
  type TextRun,
} from './types';

// ============================================================================
// Lexical Format Bitmask Constants
// ============================================================================

const FORMAT_BOLD = 1;
const FORMAT_ITALIC = 2;
const FORMAT_STRIKETHROUGH = 4;
const FORMAT_UNDERLINE = 8;
const FORMAT_CODE = 16;

// ============================================================================
// Type Guards for Lexical Nodes
// ============================================================================

interface LexicalNode {
  type: string;
  children?: LexicalNode[];
  text?: string;
  format?: number;
  url?: string;
  tag?: string;
  listType?: string;
  language?: string;
}

interface LexicalEditorState {
  root?: {
    children?: LexicalNode[];
  };
}

function isTextNode(node: LexicalNode): boolean {
  return node.type === 'text';
}

function isLinkNode(node: LexicalNode): boolean {
  return node.type === 'link';
}

function isLineBreakNode(node: LexicalNode): boolean {
  return node.type === 'linebreak';
}

function isParagraphNode(node: LexicalNode): boolean {
  return node.type === 'paragraph';
}

function isHeadingNode(node: LexicalNode): boolean {
  return node.type === 'heading';
}

function isListNode(node: LexicalNode): boolean {
  return node.type === 'list';
}

function isListItemNode(node: LexicalNode): boolean {
  return node.type === 'listitem';
}

function isQuoteNode(node: LexicalNode): boolean {
  return node.type === 'quote';
}

function isCodeNode(node: LexicalNode): boolean {
  return node.type === 'code';
}

// ============================================================================
// Format Parsing
// ============================================================================

/**
 * Parses Lexical's format bitmask into explicit formatting flags.
 */
function parseFormat(format: number | undefined): TextFormatting {
  if (!format) return {};

  return {
    bold: (format & FORMAT_BOLD) !== 0 || undefined,
    italic: (format & FORMAT_ITALIC) !== 0 || undefined,
    strikethrough: (format & FORMAT_STRIKETHROUGH) !== 0 || undefined,
    underline: (format & FORMAT_UNDERLINE) !== 0 || undefined,
    code: (format & FORMAT_CODE) !== 0 || undefined,
  };
}

// ============================================================================
// Node Normalization
// ============================================================================

/**
 * Normalizes inline children (text, links) from a Lexical node.
 */
function normalizeInlineChildren(children: LexicalNode[] | undefined): InlineContent[] {
  if (!children) return [];

  const result: InlineContent[] = [];

  for (const child of children) {
    if (isTextNode(child)) {
      const textRun: TextRun = {
        type: 'text',
        text: child.text || '',
        format: parseFormat(child.format),
      };
      result.push(textRun);
    } else if (isLinkNode(child)) {
      const linkNode: LinkNode = {
        type: 'link',
        url: child.url || '',
        children: normalizeInlineChildren(child.children) as TextRun[],
      };
      result.push(linkNode);
    } else if (isLineBreakNode(child)) {
      // Represent line breaks as text with newline for inline contexts
      result.push({
        type: 'text',
        text: '\n',
        format: {},
      });
    }
  }

  return result;
}

/**
 * Extracts heading level from Lexical's tag property.
 */
function parseHeadingLevel(tag: string | undefined): 1 | 2 | 3 | 4 | 5 | 6 {
  const match = tag?.match(/h(\d)/i);
  if (match) {
    const level = parseInt(match[1], 10);
    if (level >= 1 && level <= 6) {
      return level as 1 | 2 | 3 | 4 | 5 | 6;
    }
  }
  return 1;
}

/**
 * Normalizes a paragraph node.
 */
function normalizeParagraph(node: LexicalNode): ParagraphBlock {
  return {
    type: 'paragraph',
    children: normalizeInlineChildren(node.children),
  };
}

/**
 * Normalizes a heading node.
 */
function normalizeHeading(node: LexicalNode): HeadingBlock {
  return {
    type: 'heading',
    level: parseHeadingLevel(node.tag),
    children: normalizeInlineChildren(node.children),
  };
}

/**
 * Normalizes a list node.
 */
function normalizeList(node: LexicalNode): ListBlock {
  const items: ListItemBlock[] = [];

  for (const child of node.children || []) {
    if (isListItemNode(child)) {
      items.push({
        type: 'listItem',
        children: normalizeInlineChildren(child.children),
      });
    }
  }

  return {
    type: 'list',
    ordered: node.listType === 'number',
    children: items,
  };
}

/**
 * Normalizes a quote node.
 */
function normalizeQuote(node: LexicalNode): QuoteBlock {
  return {
    type: 'quote',
    children: normalizeInlineChildren(node.children),
  };
}

/**
 * Normalizes a code block node.
 */
function normalizeCode(node: LexicalNode): CodeBlock {
  // Extract text content from code block children
  const codeText = (node.children || []).map((child) => child.text || '').join('\n');

  return {
    type: 'code',
    language: node.language,
    code: codeText,
  };
}

/**
 * Normalizes a single Lexical block node.
 */
function normalizeBlockNode(node: LexicalNode): Block | null {
  if (isParagraphNode(node)) {
    return normalizeParagraph(node);
  }
  if (isHeadingNode(node)) {
    return normalizeHeading(node);
  }
  if (isListNode(node)) {
    return normalizeList(node);
  }
  if (isQuoteNode(node)) {
    return normalizeQuote(node);
  }
  if (isCodeNode(node)) {
    return normalizeCode(node);
  }
  if (isLineBreakNode(node)) {
    return { type: 'linebreak' } as LineBreakBlock;
  }

  // Unknown node type - skip
  return null;
}

// ============================================================================
// Main Normalizer Function
// ============================================================================

/**
 * Creates an empty normalized document.
 */
function emptyDocument(): NormalizedDocument {
  return { version: AST_VERSION, blocks: [] };
}

/**
 * Normalizes a Lexical editor state into the intermediate document format.
 *
 * @param editorState - The Lexical editor state (can be JSON object or string)
 * @returns NormalizedDocument ready for export
 */
export function normalizeEditorState(editorState: unknown): NormalizedDocument {
  // Handle null/undefined
  if (!editorState) {
    return emptyDocument();
  }

  // Parse string if needed
  let state: LexicalEditorState;
  try {
    state = typeof editorState === 'string' ? JSON.parse(editorState) : editorState;
  } catch {
    return emptyDocument();
  }

  // Extract root children
  const rootChildren = state?.root?.children;
  if (!Array.isArray(rootChildren)) {
    return emptyDocument();
  }

  // Normalize each block
  const blocks: Block[] = [];
  for (const node of rootChildren) {
    const block = normalizeBlockNode(node);
    if (block) {
      blocks.push(block);
    }
  }

  return { version: AST_VERSION, blocks };
}

// ============================================================================
// Inline Content Utilities (Shared by Exporters)
// ============================================================================

/**
 * Options for flattening inline content to plain text.
 */
export interface FlattenOptions {
  /** Whether to include link URLs in output (default: false) */
  includeLinkUrls?: boolean;
}

/**
 * Flattens inline content to plain text.
 * This is the shared utility used by all exporters for consistent text extraction.
 *
 * @param content - Array of inline content nodes
 * @param options - Flattening options
 * @returns Plain text representation
 */
export function flattenInlineContent(
  content: InlineContent[],
  options: FlattenOptions = {},
): string {
  const { includeLinkUrls = false } = options;

  return content
    .map((item) => {
      if (item.type === 'text') {
        return item.text;
      }
      if (item.type === 'link') {
        const linkText = item.children.map((c) => c.text).join('');
        return includeLinkUrls ? `${linkText} (${item.url})` : linkText;
      }
      return '';
    })
    .join('');
}

/**
 * Extracts plain text from a normalized document.
 * Useful for text export or preview generation.
 */
export function extractPlainText(document: NormalizedDocument): string {
  const lines: string[] = [];

  for (const block of document.blocks) {
    switch (block.type) {
      case 'paragraph':
      case 'heading':
      case 'quote':
        lines.push(flattenInlineContent(block.children));
        break;
      case 'list':
        for (let i = 0; i < block.children.length; i++) {
          const prefix = block.ordered ? `${i + 1}. ` : '- ';
          lines.push(prefix + flattenInlineContent(block.children[i].children));
        }
        break;
      case 'code':
        lines.push(block.code);
        break;
      case 'linebreak':
        lines.push('');
        break;
    }
  }

  return lines.join('\n');
}

// ============================================================================
// Content Validation
// ============================================================================

/**
 * Checks if inline content has any meaningful text.
 */
function hasInlineText(content: InlineContent[]): boolean {
  return content.some((item) => {
    if (item.type === 'text') {
      return item.text.trim().length > 0;
    }
    if (item.type === 'link') {
      return item.children.some((c) => c.text.trim().length > 0);
    }
    return false;
  });
}

/**
 * Checks if a normalized document has any exportable content.
 * Used to prevent exporting empty notes.
 */
export function documentHasContent(document: NormalizedDocument): boolean {
  return document.blocks.some((block) => {
    switch (block.type) {
      case 'linebreak':
        return false;
      case 'code':
        return block.code.trim().length > 0;
      case 'list':
        return block.children.some((item) => hasInlineText(item.children));
      case 'paragraph':
      case 'heading':
      case 'quote':
        return hasInlineText(block.children);
      default:
        return false;
    }
  });
}
