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

/**
 * Generates plain text from a normalized document.
 */
function documentToText(document: NormalizedDocument, metadata: ExportMetadata): string {
  const lines: string[] = [];

  // Add title header
  if (metadata.title) {
    lines.push(metadata.title);
    lines.push('='.repeat(Math.min(metadata.title.length, 60)));
    lines.push('');
  }

  // Add metadata
  const metadataFields = buildMetadataFields(metadata);
  if (metadataFields.length > 0) {
    const metaParts = metadataFields.map(({ label, value }) => `${label}: ${value}`);
    lines.push(metaParts.join(' | '));
    lines.push('');
  }

  // Process blocks
  for (const block of document.blocks) {
    switch (block.type) {
      case 'paragraph': {
        // Include link URLs in plain text for reference
        const text = flattenInlineContent(block.children, { includeLinkUrls: true });
        if (text.trim()) {
          lines.push(text);
          lines.push('');
        }
        break;
      }

      case 'heading': {
        const text = flattenInlineContent(block.children);
        if (text.trim()) {
          lines.push('');
          lines.push(text.toUpperCase());
          lines.push('-'.repeat(Math.min(text.length, 40)));
          lines.push('');
        }
        break;
      }

      case 'list': {
        for (let i = 0; i < block.children.length; i++) {
          const item = block.children[i];
          const prefix = block.ordered ? `${i + 1}. ` : '* ';
          lines.push(prefix + flattenInlineContent(item.children, { includeLinkUrls: true }));
        }
        lines.push('');
        break;
      }

      case 'quote': {
        const text = flattenInlineContent(block.children);
        if (text.trim()) {
          // Indent quoted text
          const quotedLines = text.split('\n').map((line) => `  "${line}"`);
          lines.push(...quotedLines);
          lines.push('');
        }
        break;
      }

      case 'code': {
        lines.push('---');
        lines.push(block.code);
        lines.push('---');
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
