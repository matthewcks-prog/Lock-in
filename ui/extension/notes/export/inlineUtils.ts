/**
 * Inline Content Utilities
 *
 * Shared utilities for working with inline content in the normalized document.
 * Used by exporters for consistent text extraction.
 */

import type { InlineContent, NormalizedDocument } from './types';

// ============================================================================
// Inline Content Flattening
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
export function hasInlineText(content: InlineContent[]): boolean {
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
