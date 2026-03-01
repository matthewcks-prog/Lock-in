/**
 * Lexical Editor Types and Type Guards
 *
 * Type definitions for parsing Lexical editor state.
 * Separated for better modularity and reusability.
 */

// ============================================================================
// Lexical Format Bitmask Constants
// ============================================================================

export const FORMAT_BOLD = 1;
export const FORMAT_ITALIC = 2;
export const FORMAT_STRIKETHROUGH = 4;
export const FORMAT_UNDERLINE = 8;
export const FORMAT_CODE = 16;

// Lexical element alignment constants (mapped from FORMAT_ELEMENT_COMMAND)
export const ELEMENT_FORMAT_LEFT = 1;
export const ELEMENT_FORMAT_CENTER = 2;
export const ELEMENT_FORMAT_RIGHT = 3;
export const ELEMENT_FORMAT_JUSTIFY = 4;

// ============================================================================
// Type Definitions
// ============================================================================

export interface LexicalNode {
  type: string;
  children?: LexicalNode[];
  text?: string;
  /** Text format bitmask (bold=1, italic=2, etc.) */
  format?: number;
  /** CSS style string for colors, etc. (e.g., "color: #ff0000;") */
  style?: string;
  url?: string;
  tag?: string;
  listType?: string;
  language?: string;
  /** Element alignment (1=left, 2=center, 3=right, 4=justify) - for paragraph/heading nodes */
  direction?: string;
  /** Indent level for lists */
  indent?: number;
}

export interface LexicalEditorState {
  root?: {
    children?: LexicalNode[];
  };
}

// ============================================================================
// Type Guards
// ============================================================================

export function isTextNode(node: LexicalNode): boolean {
  return node.type === 'text';
}

export function isLinkNode(node: LexicalNode): boolean {
  return node.type === 'link';
}

export function isLineBreakNode(node: LexicalNode): boolean {
  return node.type === 'linebreak';
}

export function isParagraphNode(node: LexicalNode): boolean {
  return node.type === 'paragraph';
}

export function isHeadingNode(node: LexicalNode): boolean {
  return node.type === 'heading';
}

export function isListNode(node: LexicalNode): boolean {
  return node.type === 'list';
}

export function isListItemNode(node: LexicalNode): boolean {
  return node.type === 'listitem';
}

export function isQuoteNode(node: LexicalNode): boolean {
  return node.type === 'quote';
}

export function isCodeNode(node: LexicalNode): boolean {
  return node.type === 'code';
}
