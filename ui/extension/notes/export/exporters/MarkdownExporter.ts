/**
 * Markdown Exporter
 *
 * Converts normalized documents to CommonMark-compliant Markdown.
 * Preserves formatting, links, and document structure.
 *
 * Note on formatting support:
 * - Supported: bold, italic, strikethrough, code, links
 * - Not supported (no native Markdown equivalent):
 *   - Text colors (would require HTML <span> tags)
 *   - Background/highlight colors (would require HTML)
 *   - Underline (would require HTML <u> tags)
 *   - Text alignment (would require HTML or non-standard extensions)
 */

import type {
  Exporter,
  ExportMetadata,
  InlineContent,
  NormalizedDocument,
  TextRun,
} from '../types';
import { buildMetadataFields } from '../metadata';

/**
 * Escapes special Markdown characters in text.
 */
function escapeMarkdown(text: string): string {
  // Escape characters that have special meaning in Markdown
  return text.replace(/([\\`*_{}[\]()#+\-.!])/g, '\\$1');
}

/**
 * Converts a text run to Markdown with formatting.
 */
function textRunToMarkdown(run: TextRun, escapeText = true): string {
  let text = escapeText ? escapeMarkdown(run.text) : run.text;
  const { format } = run;

  // Apply formatting in order: code, then bold/italic
  // Code formatting takes precedence and shouldn't nest other formatting
  if (format.code) {
    // Don't escape inside code spans
    return `\`${run.text}\``;
  }

  if (format.bold && format.italic) {
    text = `***${text}***`;
  } else if (format.bold) {
    text = `**${text}**`;
  } else if (format.italic) {
    text = `*${text}*`;
  }

  if (format.strikethrough) {
    text = `~~${text}~~`;
  }

  // Underline doesn't have native Markdown support, skip it

  return text;
}

/**
 * Converts inline content to Markdown.
 */
function inlineToMarkdown(content: InlineContent[]): string {
  return content
    .map((item) => {
      if (item.type === 'text') {
        return textRunToMarkdown(item);
      }
      if (item.type === 'link') {
        const linkText = item.children.map((c) => textRunToMarkdown(c, false)).join('');
        return `[${linkText}](${item.url})`;
      }
      return '';
    })
    .join('');
}

/**
 * Generates Markdown from a normalized document.
 */
function documentToMarkdown(document: NormalizedDocument, metadata: ExportMetadata): string {
  const lines: string[] = [];

  // Add title as H1
  if (metadata.title) {
    lines.push(`# ${metadata.title}`);
    lines.push('');
  }

  // Add metadata as blockquote
  const metadataFields = buildMetadataFields(metadata);
  if (metadataFields.length > 0) {
    const metaParts = metadataFields.map(({ label, value }) => `**${label}:** ${value}`);
    lines.push(`> ${metaParts.join(' | ')}`);
    lines.push('');
  }

  // Process blocks
  for (const block of document.blocks) {
    switch (block.type) {
      case 'paragraph': {
        const text = inlineToMarkdown(block.children);
        if (text.trim()) {
          lines.push(text);
          lines.push('');
        }
        break;
      }

      case 'heading': {
        const text = inlineToMarkdown(block.children);
        if (text.trim()) {
          // Offset by 1 since title uses H1
          const level = Math.min(block.level + 1, 6);
          const prefix = '#'.repeat(level);
          lines.push(`${prefix} ${text}`);
          lines.push('');
        }
        break;
      }

      case 'list': {
        for (let i = 0; i < block.children.length; i++) {
          const item = block.children[i];
          const prefix = block.ordered ? `${i + 1}. ` : '- ';
          lines.push(prefix + inlineToMarkdown(item.children));
        }
        lines.push('');
        break;
      }

      case 'quote': {
        const text = inlineToMarkdown(block.children);
        if (text.trim()) {
          // Split into lines and prefix each with >
          const quotedLines = text.split('\n').map((line) => `> ${line}`);
          lines.push(...quotedLines);
          lines.push('');
        }
        break;
      }

      case 'code': {
        const lang = block.language || '';
        lines.push('```' + lang);
        lines.push(block.code);
        lines.push('```');
        lines.push('');
        break;
      }

      case 'linebreak': {
        lines.push('');
        break;
      }
    }
  }

  return lines.join('\n').trim() + '\n';
}

/**
 * Markdown exporter implementation.
 */
export class MarkdownExporter implements Exporter {
  readonly format = 'markdown' as const;
  readonly extension = 'md';
  readonly mimeType = 'text/markdown';

  async export(document: NormalizedDocument, metadata: ExportMetadata): Promise<Blob> {
    const markdown = documentToMarkdown(document, metadata);
    return new Blob([markdown], { type: this.mimeType });
  }
}
