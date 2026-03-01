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
  type ListBlock,
  type ListItemBlock,
  type NormalizedDocument,
  type ParagraphBlock,
  type QuoteBlock,
  type TextAlignment,
  type TextFormatting,
  type TextRun,
  type TextStyles,
} from './types';

import {
  ELEMENT_FORMAT_CENTER,
  ELEMENT_FORMAT_JUSTIFY,
  ELEMENT_FORMAT_LEFT,
  ELEMENT_FORMAT_RIGHT,
  FORMAT_BOLD,
  FORMAT_CODE,
  FORMAT_ITALIC,
  FORMAT_STRIKETHROUGH,
  FORMAT_UNDERLINE,
  isCodeNode,
  isHeadingNode,
  isLineBreakNode,
  isLinkNode,
  isListItemNode,
  isListNode,
  isParagraphNode,
  isQuoteNode,
  isTextNode,
  type LexicalEditorState,
  type LexicalNode,
} from './lexicalTypes';

// Re-export utilities for backward compatibility
export { documentHasContent, extractPlainText, flattenInlineContent } from './inlineUtils';
export type { FlattenOptions } from './inlineUtils';

// ============================================================================
// Format Parsing
// ============================================================================

const DECIMAL_RADIX = 10;
const HEADING_LEVEL_ONE = 1;
const HEADING_LEVEL_TWO = 2;
const HEADING_LEVEL_THREE = 3;
const HEADING_LEVEL_FOUR = 4;
const HEADING_LEVEL_FIVE = 5;
const HEADING_LEVEL_SIX = 6;
const HEADING_LEVELS = [
  HEADING_LEVEL_ONE,
  HEADING_LEVEL_TWO,
  HEADING_LEVEL_THREE,
  HEADING_LEVEL_FOUR,
  HEADING_LEVEL_FIVE,
  HEADING_LEVEL_SIX,
] as const;
type HeadingLevel = (typeof HEADING_LEVELS)[number];
const DEFAULT_HEADING_LEVEL: HeadingLevel = HEADING_LEVEL_ONE;
const MAX_HEADING_LEVEL: HeadingLevel = HEADING_LEVEL_SIX;

/**
 * Parses Lexical's format bitmask into explicit formatting flags.
 */
function parseFormat(format: number | undefined): TextFormatting {
  if (format === undefined || format === 0) return {};

  const formatting: TextFormatting = {};
  if ((format & FORMAT_BOLD) !== 0) formatting.bold = true;
  if ((format & FORMAT_ITALIC) !== 0) formatting.italic = true;
  if ((format & FORMAT_STRIKETHROUGH) !== 0) formatting.strikethrough = true;
  if ((format & FORMAT_UNDERLINE) !== 0) formatting.underline = true;
  if ((format & FORMAT_CODE) !== 0) formatting.code = true;
  return formatting;
}

/**
 * Parses CSS style string to extract text styles (color, background-color).
 * Lexical stores styles as CSS strings like "color: #ff0000; background-color: yellow;"
 */
function parseStyles(style: string | undefined): TextStyles | undefined {
  if (style === undefined || style.trim().length === 0) return undefined;

  const styles: TextStyles = {};

  // Parse color property
  const colorMatch = style.match(/(?:^|;)\s*color\s*:\s*([^;]+)/i);
  const colorToken = colorMatch?.[1];
  if (colorToken !== undefined && colorToken.trim().length > 0) {
    styles.color = colorToken.trim();
  }

  // Parse background-color property
  const bgMatch = style.match(/(?:^|;)\s*background-color\s*:\s*([^;]+)/i);
  const bgToken = bgMatch?.[1];
  if (bgToken !== undefined && bgToken.trim().length > 0) {
    styles.backgroundColor = bgToken.trim();
  }

  return Object.keys(styles).length > 0 ? styles : undefined;
}

/**
 * Parses Lexical element format to text alignment.
 * Lexical uses numeric format for element alignment (1=left, 2=center, 3=right, 4=justify)
 */
function parseAlignment(format: number | undefined): TextAlignment | undefined {
  if (format === undefined || format === 0 || format === ELEMENT_FORMAT_LEFT) return undefined; // default is left, don't store
  if (format === ELEMENT_FORMAT_CENTER) return 'center';
  if (format === ELEMENT_FORMAT_RIGHT) return 'right';
  if (format === ELEMENT_FORMAT_JUSTIFY) return 'justify';
  return undefined;
}

// ============================================================================
// Node Normalization
// ============================================================================

/**
 * Checks if a node is a container that holds inline content.
 * These nodes don't contribute content themselves but wrap inline children.
 */
function isInlineContainerNode(node: LexicalNode): boolean {
  return isParagraphNode(node) || isHeadingNode(node) || isQuoteNode(node);
}

/**
 * Recursively extracts inline content from a Lexical node tree.
 *
 * Lexical's structure can be deeply nested. For example, a list item might contain:
 * - Direct text nodes (simple case)
 * - Paragraph nodes containing text (common case from rich editing)
 * - Multiple paragraphs or mixed content
 *
 * This function handles all cases by recursively descending into container nodes
 * and collecting all inline content (text, links, linebreaks).
 *
 * @param children - Array of Lexical nodes to process
 * @returns Flattened array of inline content
 */
function buildTextRun(node: LexicalNode): TextRun {
  const textRun: TextRun = {
    type: 'text',
    text: node.text ?? '',
    format: parseFormat(node.format),
  };
  const styles = parseStyles(node.style);
  if (styles !== undefined) {
    textRun.styles = styles;
  }
  return textRun;
}

function buildLineBreakRun(): TextRun {
  return {
    type: 'text',
    text: '\n',
    format: {},
  };
}

function extractLinkChildren(children: LexicalNode[] | undefined): TextRun[] {
  return extractInlineContent(children).filter((child): child is TextRun => child.type === 'text');
}

function extractInlineFromNode(node: LexicalNode): InlineContent[] {
  if (isTextNode(node)) {
    return [buildTextRun(node)];
  }

  if (isLinkNode(node)) {
    return [
      {
        type: 'link',
        url: node.url ?? '',
        children: extractLinkChildren(node.children),
      },
    ];
  }

  if (isLineBreakNode(node)) {
    return [buildLineBreakRun()];
  }

  if (isInlineContainerNode(node)) {
    return extractInlineContent(node.children);
  }

  if (Array.isArray(node.children)) {
    return extractInlineContent(node.children);
  }

  return [];
}

function extractInlineContent(children: LexicalNode[] | undefined): InlineContent[] {
  if (children === undefined || children.length === 0) return [];

  const result: InlineContent[] = [];

  for (const child of children) {
    result.push(...extractInlineFromNode(child));
  }

  return result;
}

/**
 * Extracts heading level from Lexical's tag property.
 */
function isHeadingLevel(level: number): level is HeadingLevel {
  return HEADING_LEVELS.includes(level as HeadingLevel);
}

function parseHeadingLevel(tag: string | undefined): HeadingLevel {
  const match = tag?.match(/h(\d)/i);
  const token = match?.[1];
  if (token !== undefined) {
    const level = parseInt(token, DECIMAL_RADIX);
    if (level >= DEFAULT_HEADING_LEVEL && level <= MAX_HEADING_LEVEL && isHeadingLevel(level)) {
      return level;
    }
  }
  return DEFAULT_HEADING_LEVEL;
}

function normalizeParagraph(node: LexicalNode): ParagraphBlock {
  const block: ParagraphBlock = {
    type: 'paragraph',
    children: extractInlineContent(node.children),
  };
  const alignment = parseAlignment(node.format);
  if (alignment !== undefined) {
    block.alignment = alignment;
  }
  return block;
}

function normalizeHeading(node: LexicalNode): HeadingBlock {
  const block: HeadingBlock = {
    type: 'heading',
    level: parseHeadingLevel(node.tag),
    children: extractInlineContent(node.children),
  };
  const alignment = parseAlignment(node.format);
  if (alignment !== undefined) {
    block.alignment = alignment;
  }
  return block;
}

function normalizeList(node: LexicalNode): ListBlock {
  const items: ListItemBlock[] = [];

  for (const child of node.children ?? []) {
    if (isListItemNode(child)) {
      items.push({
        type: 'listItem',
        children: extractInlineContent(child.children),
      });
    }
  }

  return {
    type: 'list',
    ordered: node.listType === 'number',
    children: items,
  };
}

function normalizeQuote(node: LexicalNode): QuoteBlock {
  const block: QuoteBlock = {
    type: 'quote',
    children: extractInlineContent(node.children),
  };
  const alignment = parseAlignment(node.format);
  if (alignment !== undefined) {
    block.alignment = alignment;
  }
  return block;
}

function normalizeCode(node: LexicalNode): CodeBlock {
  const codeText = (node.children ?? []).map((child) => child.text ?? '').join('\n');

  const block: CodeBlock = {
    type: 'code',
    code: codeText,
  };
  if (typeof node.language === 'string' && node.language.trim().length > 0) {
    block.language = node.language;
  }
  return block;
}

function normalizeBlockNode(node: LexicalNode): Block | null {
  if (isParagraphNode(node)) return normalizeParagraph(node);
  if (isHeadingNode(node)) return normalizeHeading(node);
  if (isListNode(node)) return normalizeList(node);
  if (isQuoteNode(node)) return normalizeQuote(node);
  if (isCodeNode(node)) return normalizeCode(node);
  if (isLineBreakNode(node)) return { type: 'linebreak' } as LineBreakBlock;

  return null;
}

// ============================================================================
// Main Normalizer Function
// ============================================================================

function emptyDocument(): NormalizedDocument {
  return { version: AST_VERSION, blocks: [] };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

function isLexicalEditorState(value: unknown): value is LexicalEditorState {
  if (!isRecord(value)) return false;
  const root = value['root'];
  if (root === undefined) return true;
  if (!isRecord(root)) return false;
  const children = root['children'];
  return children === undefined || Array.isArray(children);
}

function parseEditorState(editorState: unknown): LexicalEditorState | null {
  if (editorState === null || editorState === undefined) {
    return null;
  }

  if (typeof editorState === 'string') {
    try {
      const parsed: unknown = JSON.parse(editorState);
      return isLexicalEditorState(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  return isLexicalEditorState(editorState) ? editorState : null;
}

/**
 * Normalizes a Lexical editor state into the intermediate document format.
 *
 * @param editorState - The Lexical editor state (can be JSON object or string)
 * @returns NormalizedDocument ready for export
 */
export function normalizeEditorState(editorState: unknown): NormalizedDocument {
  const state = parseEditorState(editorState);
  if (state === null) return emptyDocument();

  const rootChildren = state?.root?.children;
  if (!Array.isArray(rootChildren)) {
    return emptyDocument();
  }

  const blocks: Block[] = [];
  for (const node of rootChildren) {
    const block = normalizeBlockNode(node);
    if (block !== null) {
      blocks.push(block);
    }
  }

  return { version: AST_VERSION, blocks };
}
