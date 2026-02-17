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

const MAX_MARKDOWN_HEADING_LEVEL = 6;
type DocumentBlock = NormalizedDocument['blocks'][number];
type ParagraphBlock = Extract<DocumentBlock, { type: 'paragraph' }>;
type HeadingBlock = Extract<DocumentBlock, { type: 'heading' }>;
type ListBlock = Extract<DocumentBlock, { type: 'list' }>;
type QuoteBlock = Extract<DocumentBlock, { type: 'quote' }>;
type CodeBlock = Extract<DocumentBlock, { type: 'code' }>;

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
  if (format.code === true) {
    // Don't escape inside code spans
    return `\`${run.text}\``;
  }

  if (format.bold === true && format.italic === true) {
    text = `***${text}***`;
  } else if (format.bold === true) {
    text = `**${text}**`;
  } else if (format.italic === true) {
    text = `*${text}*`;
  }

  if (format.strikethrough === true) {
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

function hasTextContent(value: string): boolean {
  return value.trim().length > 0;
}

function appendTitle(lines: string[], metadata: ExportMetadata): void {
  if (metadata.title.length > 0) {
    lines.push(`# ${metadata.title}`);
    lines.push('');
  }
}

function appendMetadata(lines: string[], metadata: ExportMetadata): void {
  const metadataFields = buildMetadataFields(metadata);
  if (metadataFields.length > 0) {
    const metaParts = metadataFields.map(({ label, value }) => `**${label}:** ${value}`);
    lines.push(`> ${metaParts.join(' | ')}`);
    lines.push('');
  }
}

function paragraphToMarkdownLines(block: ParagraphBlock): string[] {
  const text = inlineToMarkdown(block.children);
  return hasTextContent(text) ? [text, ''] : [];
}

function headingToMarkdownLines(block: HeadingBlock): string[] {
  const text = inlineToMarkdown(block.children);
  if (!hasTextContent(text)) return [];
  const level = Math.min(block.level + 1, MAX_MARKDOWN_HEADING_LEVEL);
  const prefix = '#'.repeat(level);
  return [`${prefix} ${text}`, ''];
}

function listToMarkdownLines(block: ListBlock): string[] {
  const lines = block.children.map((item, index) => {
    const prefix = block.ordered ? `${index + 1}. ` : '- ';
    return prefix + inlineToMarkdown(item.children);
  });
  lines.push('');
  return lines;
}

function quoteToMarkdownLines(block: QuoteBlock): string[] {
  const text = inlineToMarkdown(block.children);
  if (!hasTextContent(text)) return [];
  const quotedLines = text.split('\n').map((line) => `> ${line}`);
  return [...quotedLines, ''];
}

function codeToMarkdownLines(block: CodeBlock): string[] {
  const lang = block.language ?? '';
  return ['```' + lang, block.code, '```', ''];
}

function blockToMarkdownLines(block: DocumentBlock): string[] {
  switch (block.type) {
    case 'paragraph':
      return paragraphToMarkdownLines(block);
    case 'heading':
      return headingToMarkdownLines(block);
    case 'list':
      return listToMarkdownLines(block);
    case 'quote':
      return quoteToMarkdownLines(block);
    case 'code':
      return codeToMarkdownLines(block);
    case 'linebreak':
      return [''];
  }
}

/**
 * Generates Markdown from a normalized document.
 */
function documentToMarkdown(document: NormalizedDocument, metadata: ExportMetadata): string {
  const lines: string[] = [];
  appendTitle(lines, metadata);
  appendMetadata(lines, metadata);
  for (const block of document.blocks) {
    lines.push(...blockToMarkdownLines(block));
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
