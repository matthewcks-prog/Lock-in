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

/**
 * Parses Lexical's format bitmask into explicit formatting flags.
 */
function parseFormat(format: number | undefined): TextFormatting {
  if (!format) return {};

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
  if (!style || style.trim() === '') return undefined;

  const styles: TextStyles = {};

  // Parse color property
  const colorMatch = style.match(/(?:^|;)\s*color\s*:\s*([^;]+)/i);
  if (colorMatch?.[1]) {
    styles.color = colorMatch[1].trim();
  }

  // Parse background-color property
  const bgMatch = style.match(/(?:^|;)\s*background-color\s*:\s*([^;]+)/i);
  if (bgMatch?.[1]) {
    styles.backgroundColor = bgMatch[1].trim();
  }

  return Object.keys(styles).length > 0 ? styles : undefined;
}

/**
 * Parses Lexical element format to text alignment.
 * Lexical uses numeric format for element alignment (1=left, 2=center, 3=right, 4=justify)
 */
function parseAlignment(format: number | undefined): TextAlignment | undefined {
  if (!format || format === 0 || format === ELEMENT_FORMAT_LEFT) return undefined; // default is left, don't store
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
function extractInlineContent(children: LexicalNode[] | undefined): InlineContent[] {
  if (!children || children.length === 0) return [];

  const result: InlineContent[] = [];

  for (const child of children) {
    // Case 1: Direct text node - extract text with formatting and styles
    if (isTextNode(child)) {
      const textRun: TextRun = {
        type: 'text',
        text: child.text || '',
        format: parseFormat(child.format),
      };
      const styles = parseStyles(child.style);
      if (styles) {
        textRun.styles = styles;
      }
      result.push(textRun);
      continue;
    }

    // Case 2: Link node - extract URL and recursively get text children
    if (isLinkNode(child)) {
      result.push({
        type: 'link',
        url: child.url || '',
        children: extractInlineContent(child.children) as TextRun[],
      });
      continue;
    }

    // Case 3: Line break - convert to newline text
    if (isLineBreakNode(child)) {
      result.push({
        type: 'text',
        text: '\n',
        format: {},
      });
      continue;
    }

    // Case 4: Container nodes (paragraph, heading, quote inside list items)
    // Recursively extract inline content from these containers
    if (isInlineContainerNode(child)) {
      const nestedContent = extractInlineContent(child.children);
      result.push(...nestedContent);
      continue;
    }

    // Case 5: Unknown nodes with children - attempt recursive extraction
    // This provides forward compatibility for new Lexical node types
    if (child.children && Array.isArray(child.children)) {
      const nestedContent = extractInlineContent(child.children);
      result.push(...nestedContent);
    }
  }

  return result;
}

/**
 * Extracts heading level from Lexical's tag property.
 */
function parseHeadingLevel(tag: string | undefined): 1 | 2 | 3 | 4 | 5 | 6 {
  const match = tag?.match(/h(\d)/i);
  if (match?.[1]) {
    const level = parseInt(match[1], 10);
    if (level >= 1 && level <= 6) {
      return level as 1 | 2 | 3 | 4 | 5 | 6;
    }
  }
  return 1;
}

function normalizeParagraph(node: LexicalNode): ParagraphBlock {
  const block: ParagraphBlock = {
    type: 'paragraph',
    children: extractInlineContent(node.children),
  };
  const alignment = parseAlignment(node.format);
  if (alignment) {
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
  if (alignment) {
    block.alignment = alignment;
  }
  return block;
}

function normalizeList(node: LexicalNode): ListBlock {
  const items: ListItemBlock[] = [];

  for (const child of node.children || []) {
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
  if (alignment) {
    block.alignment = alignment;
  }
  return block;
}

function normalizeCode(node: LexicalNode): CodeBlock {
  const codeText = (node.children || []).map((child) => child.text || '').join('\n');

  const block: CodeBlock = {
    type: 'code',
    code: codeText,
  };
  if (node.language) {
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

/**
 * Normalizes a Lexical editor state into the intermediate document format.
 *
 * @param editorState - The Lexical editor state (can be JSON object or string)
 * @returns NormalizedDocument ready for export
 */
export function normalizeEditorState(editorState: unknown): NormalizedDocument {
  if (!editorState) {
    return emptyDocument();
  }

  let state: LexicalEditorState;
  try {
    state = typeof editorState === 'string' ? JSON.parse(editorState) : editorState;
  } catch {
    return emptyDocument();
  }

  const rootChildren = state?.root?.children;
  if (!Array.isArray(rootChildren)) {
    return emptyDocument();
  }

  const blocks: Block[] = [];
  for (const node of rootChildren) {
    const block = normalizeBlockNode(node);
    if (block) {
      blocks.push(block);
    }
  }

  return { version: AST_VERSION, blocks };
}
