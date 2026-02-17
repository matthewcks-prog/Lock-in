/**
 * Plain Text Exporter
 *
 * Converts normalized documents to plain text format.
 * Strips all formatting while preserving document structure through
 * whitespace and simple markers.
 */

import type { Exporter, ExportMetadata, NormalizedDocument } from '../types';
import { buildMetadataFields } from '../metadata';
import { flattenInlineContent } from '../normalizer';

const TITLE_SEPARATOR_MAX_LENGTH = 60;
const HEADING_SEPARATOR_MAX_LENGTH = 40;
type DocumentBlock = NormalizedDocument['blocks'][number];
type ParagraphBlock = Extract<DocumentBlock, { type: 'paragraph' }>;
type HeadingBlock = Extract<DocumentBlock, { type: 'heading' }>;
type ListBlock = Extract<DocumentBlock, { type: 'list' }>;
type QuoteBlock = Extract<DocumentBlock, { type: 'quote' }>;
type CodeBlock = Extract<DocumentBlock, { type: 'code' }>;

function hasTextContent(value: string): boolean {
  return value.trim().length > 0;
}

function appendTitle(lines: string[], metadata: ExportMetadata): void {
  if (metadata.title.length > 0) {
    lines.push(metadata.title);
    lines.push('='.repeat(Math.min(metadata.title.length, TITLE_SEPARATOR_MAX_LENGTH)));
    lines.push('');
  }
}

function appendMetadata(lines: string[], metadata: ExportMetadata): void {
  const metadataFields = buildMetadataFields(metadata);
  if (metadataFields.length > 0) {
    const metaParts = metadataFields.map(({ label, value }) => `${label}: ${value}`);
    lines.push(metaParts.join(' | '));
    lines.push('');
  }
}

function paragraphToTextLines(block: ParagraphBlock): string[] {
  const text = flattenInlineContent(block.children, { includeLinkUrls: true });
  return hasTextContent(text) ? [text, ''] : [];
}

function headingToTextLines(block: HeadingBlock): string[] {
  const text = flattenInlineContent(block.children);
  if (!hasTextContent(text)) return [];
  return [
    '',
    text.toUpperCase(),
    '-'.repeat(Math.min(text.length, HEADING_SEPARATOR_MAX_LENGTH)),
    '',
  ];
}

function listToTextLines(block: ListBlock): string[] {
  const lines = block.children.map((item, index) => {
    const prefix = block.ordered ? `${index + 1}. ` : '* ';
    return prefix + flattenInlineContent(item.children, { includeLinkUrls: true });
  });
  lines.push('');
  return lines;
}

function quoteToTextLines(block: QuoteBlock): string[] {
  const text = flattenInlineContent(block.children);
  if (!hasTextContent(text)) return [];
  const quotedLines = text.split('\n').map((line) => `  "${line}"`);
  return [...quotedLines, ''];
}

function codeToTextLines(block: CodeBlock): string[] {
  return ['---', block.code, '---', ''];
}

function blockToTextLines(block: DocumentBlock): string[] {
  switch (block.type) {
    case 'paragraph':
      return paragraphToTextLines(block);
    case 'heading':
      return headingToTextLines(block);
    case 'list':
      return listToTextLines(block);
    case 'quote':
      return quoteToTextLines(block);
    case 'code':
      return codeToTextLines(block);
    case 'linebreak':
      return [''];
  }
}

/**
 * Generates plain text from a normalized document.
 */
function documentToText(document: NormalizedDocument, metadata: ExportMetadata): string {
  const lines: string[] = [];
  appendTitle(lines, metadata);
  appendMetadata(lines, metadata);
  for (const block of document.blocks) {
    lines.push(...blockToTextLines(block));
  }

  return lines.join('\n').trim() + '\n';
}

/**
 * Plain text exporter implementation.
 */
export class TextExporter implements Exporter {
  readonly format = 'text' as const;
  readonly extension = 'txt';
  readonly mimeType = 'text/plain';

  async export(document: NormalizedDocument, metadata: ExportMetadata): Promise<Blob> {
    const text = documentToText(document, metadata);
    return new Blob([text], { type: this.mimeType });
  }
}
