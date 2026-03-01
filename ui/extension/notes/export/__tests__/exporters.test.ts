/**
 * Tests for Markdown and Text exporters
 */

import { describe, expect, it } from 'vitest';
import { MarkdownExporter } from '../exporters/MarkdownExporter';
import { TextExporter } from '../exporters/TextExporter';
import type { NormalizedDocument, ExportMetadata } from '../types';
import { AST_VERSION } from '../types';

/**
 * Helper to read Blob content as text.
 * Works in both Node.js and browser environments.
 */
async function blobToText(blob: Blob): Promise<string> {
  // Try the standard text() method first (browser)
  if (typeof blob.text === 'function') {
    return blob.text();
  }
  // Fallback for Node.js environments where Blob.text() might not exist
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsText(blob);
  });
}

/**
 * Creates a NormalizedDocument with the correct version.
 */
function makeDoc(blocks: NormalizedDocument['blocks']): NormalizedDocument {
  return { version: AST_VERSION, blocks };
}

const metadata: ExportMetadata = {
  title: 'Test Note',
  courseCode: 'FIT1045',
  week: 3,
};

const emptyMetadata: ExportMetadata = {
  title: '',
  courseCode: null,
  week: null,
};

describe('MarkdownExporter', () => {
  const exporter = new MarkdownExporter();

  it('has correct format properties', () => {
    expect(exporter.format).toBe('markdown');
    expect(exporter.extension).toBe('md');
    expect(exporter.mimeType).toBe('text/markdown');
  });

  it('exports a simple document with title and metadata', async () => {
    const doc = makeDoc([
      { type: 'paragraph', children: [{ type: 'text', text: 'Hello world', format: {} }] },
    ]);

    const blob = await exporter.export(doc, metadata);
    const text = await blobToText(blob);

    expect(text).toContain('# Test Note');
    expect(text).toContain('**Course:** FIT1045');
    expect(text).toContain('**Week:** 3');
    expect(text).toContain('Hello world');
  });

  it('exports headings with correct markdown syntax', async () => {
    const doc = makeDoc([
      { type: 'heading', level: 1, children: [{ type: 'text', text: 'Main Title', format: {} }] },
      { type: 'heading', level: 2, children: [{ type: 'text', text: 'Subtitle', format: {} }] },
    ]);

    const blob = await exporter.export(doc, emptyMetadata);
    const text = await blobToText(blob);

    // Level 1 heading becomes ## (offset by 1 since title uses #)
    expect(text).toContain('## Main Title');
    expect(text).toContain('### Subtitle');
  });

  it('exports formatted text with markdown syntax', async () => {
    const doc = makeDoc([
      {
        type: 'paragraph',
        children: [
          { type: 'text', text: 'bold text', format: { bold: true } },
          { type: 'text', text: ' ', format: {} },
          { type: 'text', text: 'italic text', format: { italic: true } },
          { type: 'text', text: ' ', format: {} },
          { type: 'text', text: 'both', format: { bold: true, italic: true } },
        ],
      },
    ]);

    const blob = await exporter.export(doc, emptyMetadata);
    const text = await blobToText(blob);

    expect(text).toContain('**bold text**');
    expect(text).toContain('*italic text*');
    expect(text).toContain('***both***');
  });

  it('exports strikethrough text', async () => {
    const doc = makeDoc([
      {
        type: 'paragraph',
        children: [{ type: 'text', text: 'deleted', format: { strikethrough: true } }],
      },
    ]);

    const blob = await exporter.export(doc, emptyMetadata);
    const text = await blobToText(blob);

    expect(text).toContain('~~deleted~~');
  });

  it('exports code inline with backticks', async () => {
    const doc = makeDoc([
      {
        type: 'paragraph',
        children: [
          { type: 'text', text: 'Use ', format: {} },
          { type: 'text', text: 'console.log()', format: { code: true } },
          { type: 'text', text: ' to debug', format: {} },
        ],
      },
    ]);

    const blob = await exporter.export(doc, emptyMetadata);
    const text = await blobToText(blob);

    expect(text).toContain('`console.log()`');
  });

  it('exports unordered lists', async () => {
    const doc = makeDoc([
      {
        type: 'list',
        ordered: false,
        children: [
          { type: 'listItem', children: [{ type: 'text', text: 'First item', format: {} }] },
          { type: 'listItem', children: [{ type: 'text', text: 'Second item', format: {} }] },
        ],
      },
    ]);

    const blob = await exporter.export(doc, emptyMetadata);
    const text = await blobToText(blob);

    expect(text).toContain('- First item');
    expect(text).toContain('- Second item');
  });

  it('exports ordered lists', async () => {
    const doc = makeDoc([
      {
        type: 'list',
        ordered: true,
        children: [
          { type: 'listItem', children: [{ type: 'text', text: 'First', format: {} }] },
          { type: 'listItem', children: [{ type: 'text', text: 'Second', format: {} }] },
        ],
      },
    ]);

    const blob = await exporter.export(doc, emptyMetadata);
    const text = await blobToText(blob);

    expect(text).toContain('1. First');
    expect(text).toContain('2. Second');
  });

  it('exports blockquotes', async () => {
    const doc = makeDoc([
      { type: 'quote', children: [{ type: 'text', text: 'Famous quote', format: {} }] },
    ]);

    const blob = await exporter.export(doc, emptyMetadata);
    const text = await blobToText(blob);

    expect(text).toContain('> Famous quote');
  });

  it('exports code blocks with language', async () => {
    const doc = makeDoc([{ type: 'code', language: 'python', code: 'print("hello")' }]);

    const blob = await exporter.export(doc, emptyMetadata);
    const text = await blobToText(blob);

    expect(text).toContain('```python');
    expect(text).toContain('print("hello")');
    expect(text).toContain('```');
  });

  it('exports code blocks without language', async () => {
    const doc = makeDoc([{ type: 'code', code: 'some code' }]);

    const blob = await exporter.export(doc, emptyMetadata);
    const text = await blobToText(blob);

    expect(text).toContain('```\n');
    expect(text).toContain('some code');
  });

  it('exports links with markdown syntax', async () => {
    const doc = makeDoc([
      {
        type: 'paragraph',
        children: [
          {
            type: 'link',
            url: 'https://example.com',
            children: [{ type: 'text', text: 'Example', format: {} }],
          },
        ],
      },
    ]);

    const blob = await exporter.export(doc, emptyMetadata);
    const text = await blobToText(blob);

    expect(text).toContain('[Example](https://example.com)');
  });

  it('escapes special markdown characters in text', async () => {
    const doc = makeDoc([
      {
        type: 'paragraph',
        children: [{ type: 'text', text: 'Use *asterisks* and [brackets]', format: {} }],
      },
    ]);

    const blob = await exporter.export(doc, emptyMetadata);
    const text = await blobToText(blob);

    // Should escape special characters
    expect(text).toContain('\\*asterisks\\*');
    expect(text).toContain('\\[brackets\\]');
  });

  it('handles empty document gracefully', async () => {
    const doc = makeDoc([]);

    const blob = await exporter.export(doc, emptyMetadata);
    const text = await blobToText(blob);

    // Should produce valid (minimal) output
    expect(text).toBeDefined();
    expect(text.length).toBeGreaterThanOrEqual(0);
  });
});

describe('TextExporter', () => {
  const exporter = new TextExporter();

  it('has correct format properties', () => {
    expect(exporter.format).toBe('text');
    expect(exporter.extension).toBe('txt');
    expect(exporter.mimeType).toBe('text/plain');
  });

  it('exports a simple document with title and metadata', async () => {
    const doc = makeDoc([
      { type: 'paragraph', children: [{ type: 'text', text: 'Hello world', format: {} }] },
    ]);

    const blob = await exporter.export(doc, metadata);
    const text = await blobToText(blob);

    expect(text).toContain('Test Note');
    expect(text).toContain('='); // Title underline
    expect(text).toContain('Course: FIT1045');
    expect(text).toContain('Week: 3');
    expect(text).toContain('Hello world');
  });

  it('exports headings in uppercase with underline', async () => {
    const doc = makeDoc([
      {
        type: 'heading',
        level: 1,
        children: [{ type: 'text', text: 'Section Title', format: {} }],
      },
    ]);

    const blob = await exporter.export(doc, emptyMetadata);
    const text = await blobToText(blob);

    expect(text).toContain('SECTION TITLE');
    expect(text).toContain('-'); // Heading underline
  });

  it('strips formatting from text', async () => {
    const doc = makeDoc([
      {
        type: 'paragraph',
        children: [
          { type: 'text', text: 'bold', format: { bold: true } },
          { type: 'text', text: ' and ', format: {} },
          { type: 'text', text: 'italic', format: { italic: true } },
        ],
      },
    ]);

    const blob = await exporter.export(doc, emptyMetadata);
    const text = await blobToText(blob);

    // Should not contain markdown formatting
    expect(text).not.toContain('**');
    expect(text).not.toContain('*');
    expect(text).toContain('bold and italic');
  });

  it('exports lists with bullet points or numbers', async () => {
    const doc = makeDoc([
      {
        type: 'list',
        ordered: false,
        children: [
          { type: 'listItem', children: [{ type: 'text', text: 'Bullet item', format: {} }] },
        ],
      },
      {
        type: 'list',
        ordered: true,
        children: [
          { type: 'listItem', children: [{ type: 'text', text: 'Numbered item', format: {} }] },
        ],
      },
    ]);

    const blob = await exporter.export(doc, emptyMetadata);
    const text = await blobToText(blob);

    expect(text).toContain('* Bullet item');
    expect(text).toContain('1. Numbered item');
  });

  it('exports quotes with indentation', async () => {
    const doc = makeDoc([
      { type: 'quote', children: [{ type: 'text', text: 'Quoted text', format: {} }] },
    ]);

    const blob = await exporter.export(doc, emptyMetadata);
    const text = await blobToText(blob);

    expect(text).toContain('"Quoted text"');
  });

  it('exports code blocks with separators', async () => {
    const doc = makeDoc([{ type: 'code', code: 'const x = 1;' }]);

    const blob = await exporter.export(doc, emptyMetadata);
    const text = await blobToText(blob);

    expect(text).toContain('---');
    expect(text).toContain('const x = 1;');
  });

  it('includes link URLs in parentheses', async () => {
    const doc = makeDoc([
      {
        type: 'paragraph',
        children: [
          {
            type: 'link',
            url: 'https://example.com',
            children: [{ type: 'text', text: 'Example', format: {} }],
          },
        ],
      },
    ]);

    const blob = await exporter.export(doc, emptyMetadata);
    const text = await blobToText(blob);

    expect(text).toContain('Example (https://example.com)');
  });

  it('handles empty document gracefully', async () => {
    const doc = makeDoc([]);

    const blob = await exporter.export(doc, emptyMetadata);
    const text = await blobToText(blob);

    expect(text).toBeDefined();
  });

  it('handles long titles with truncated underline', async () => {
    const longTitle = 'This is a very long title that exceeds sixty characters in total length';
    const doc = makeDoc([]);

    const blob = await exporter.export(doc, { ...emptyMetadata, title: longTitle });
    const text = await blobToText(blob);

    expect(text).toContain(longTitle);
    // Underline should be capped at 60 characters
    expect(text).toContain('='.repeat(60));
  });
});
