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

import {
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

function normalizeParagraph(node: LexicalNode): ParagraphBlock {
  return {
    type: 'paragraph',
    children: normalizeInlineChildren(node.children),
  };
}

function normalizeHeading(node: LexicalNode): HeadingBlock {
  return {
    type: 'heading',
    level: parseHeadingLevel(node.tag),
    children: normalizeInlineChildren(node.children),
  };
}

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

function normalizeQuote(node: LexicalNode): QuoteBlock {
  return {
    type: 'quote',
    children: normalizeInlineChildren(node.children),
  };
}

function normalizeCode(node: LexicalNode): CodeBlock {
  const codeText = (node.children || []).map((child) => child.text || '').join('\n');

  return {
    type: 'code',
    language: node.language,
    code: codeText,
  };
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
