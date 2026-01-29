/**
 * Tests for the Lexical-to-AST normalizer
 */

import { describe, expect, it } from 'vitest';
import {
  normalizeEditorState,
  extractPlainText,
  flattenInlineContent,
  documentHasContent,
} from '../normalizer';
import { AST_VERSION } from '../types';
import type { NormalizedDocument, InlineContent, ParagraphBlock, HeadingBlock } from '../types';

describe('normalizeEditorState', () => {
  it('returns empty document with version for null/undefined input', () => {
    expect(normalizeEditorState(null)).toEqual({ version: AST_VERSION, blocks: [] });
    expect(normalizeEditorState(undefined)).toEqual({ version: AST_VERSION, blocks: [] });
  });

  it('returns empty document for invalid JSON string', () => {
    expect(normalizeEditorState('not valid json')).toEqual({ version: AST_VERSION, blocks: [] });
  });

  it('returns empty document for empty root', () => {
    expect(normalizeEditorState({ root: { children: [] } })).toEqual({
      version: AST_VERSION,
      blocks: [],
    });
  });

  it('includes version in output', () => {
    const state = {
      root: {
        children: [{ type: 'paragraph', children: [{ type: 'text', text: 'Hello', format: 0 }] }],
      },
    };

    const result = normalizeEditorState(state);
    expect(result.version).toBe(AST_VERSION);
  });

  it('normalizes a simple paragraph', () => {
    const state = {
      root: {
        children: [
          {
            type: 'paragraph',
            children: [{ type: 'text', text: 'Hello world', format: 0 }],
          },
        ],
      },
    };

    const result = normalizeEditorState(state);
    const paragraph = result.blocks[0] as ParagraphBlock;

    expect(result.blocks).toHaveLength(1);
    expect(paragraph.type).toBe('paragraph');
    expect(paragraph.children).toHaveLength(1);
    expect(paragraph.children[0]).toEqual({
      type: 'text',
      text: 'Hello world',
      format: {},
    });
  });

  it('parses text formatting correctly', () => {
    const state = {
      root: {
        children: [
          {
            type: 'paragraph',
            children: [
              { type: 'text', text: 'bold', format: 1 },
              { type: 'text', text: 'italic', format: 2 },
              { type: 'text', text: 'bold+italic', format: 3 },
              { type: 'text', text: 'underline', format: 8 },
              { type: 'text', text: 'code', format: 16 },
            ],
          },
        ],
      },
    };

    const result = normalizeEditorState(state);
    const paragraph = result.blocks[0] as ParagraphBlock;
    const children = paragraph.children;

    expect(children[0]).toMatchObject({ type: 'text', format: { bold: true } });
    expect(children[1]).toMatchObject({ type: 'text', format: { italic: true } });
    expect(children[2]).toMatchObject({ type: 'text', format: { bold: true, italic: true } });
    expect(children[3]).toMatchObject({ type: 'text', format: { underline: true } });
    expect(children[4]).toMatchObject({ type: 'text', format: { code: true } });
  });

  it('normalizes headings with correct level', () => {
    const state = {
      root: {
        children: [
          { type: 'heading', tag: 'h1', children: [{ type: 'text', text: 'Title', format: 0 }] },
          { type: 'heading', tag: 'h2', children: [{ type: 'text', text: 'Subtitle', format: 0 }] },
          { type: 'heading', tag: 'h3', children: [{ type: 'text', text: 'Section', format: 0 }] },
        ],
      },
    };

    const result = normalizeEditorState(state);

    expect(result.blocks).toHaveLength(3);
    expect((result.blocks[0] as HeadingBlock).level).toBe(1);
    expect((result.blocks[1] as HeadingBlock).level).toBe(2);
    expect((result.blocks[2] as HeadingBlock).level).toBe(3);
  });

  it('normalizes ordered and unordered lists', () => {
    const state = {
      root: {
        children: [
          {
            type: 'list',
            listType: 'bullet',
            children: [
              { type: 'listitem', children: [{ type: 'text', text: 'Item 1', format: 0 }] },
              { type: 'listitem', children: [{ type: 'text', text: 'Item 2', format: 0 }] },
            ],
          },
          {
            type: 'list',
            listType: 'number',
            children: [
              { type: 'listitem', children: [{ type: 'text', text: 'First', format: 0 }] },
              { type: 'listitem', children: [{ type: 'text', text: 'Second', format: 0 }] },
            ],
          },
        ],
      },
    };

    const result = normalizeEditorState(state);

    expect(result.blocks).toHaveLength(2);
    expect(result.blocks[0]).toMatchObject({ type: 'list', ordered: false });
    expect(result.blocks[1]).toMatchObject({ type: 'list', ordered: true });
  });

  it('normalizes links', () => {
    const state = {
      root: {
        children: [
          {
            type: 'paragraph',
            children: [
              { type: 'text', text: 'Check out ', format: 0 },
              {
                type: 'link',
                url: 'https://example.com',
                children: [{ type: 'text', text: 'this link', format: 0 }],
              },
            ],
          },
        ],
      },
    };

    const result = normalizeEditorState(state);
    const paragraph = result.blocks[0] as ParagraphBlock;

    expect(paragraph.children).toHaveLength(2);
    expect(paragraph.children[1]).toMatchObject({
      type: 'link',
      url: 'https://example.com',
    });
  });

  it('normalizes quotes', () => {
    const state = {
      root: {
        children: [
          {
            type: 'quote',
            children: [{ type: 'text', text: 'Famous quote here', format: 0 }],
          },
        ],
      },
    };

    const result = normalizeEditorState(state);

    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0]).toMatchObject({ type: 'quote' });
  });

  it('normalizes code blocks', () => {
    const state = {
      root: {
        children: [
          {
            type: 'code',
            language: 'javascript',
            children: [
              { type: 'text', text: 'const x = 1;', format: 0 },
              { type: 'text', text: 'console.log(x);', format: 0 },
            ],
          },
        ],
      },
    };

    const result = normalizeEditorState(state);

    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0]).toMatchObject({
      type: 'code',
      language: 'javascript',
    });
  });

  it('parses stringified JSON', () => {
    const state = JSON.stringify({
      root: {
        children: [
          { type: 'paragraph', children: [{ type: 'text', text: 'From string', format: 0 }] },
        ],
      },
    });

    const result = normalizeEditorState(state);
    const paragraph = result.blocks[0] as ParagraphBlock;

    expect(result.blocks).toHaveLength(1);
    expect(paragraph.children[0]).toMatchObject({ type: 'text', text: 'From string' });
  });

  it('skips unknown node types gracefully', () => {
    const state = {
      root: {
        children: [
          { type: 'unknown-node', data: 'should be skipped' },
          { type: 'paragraph', children: [{ type: 'text', text: 'Valid', format: 0 }] },
          { type: 'another-unknown', nested: { deep: true } },
        ],
      },
    };

    const result = normalizeEditorState(state);

    // Should only have the valid paragraph
    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0].type).toBe('paragraph');
  });
});

describe('extractPlainText', () => {
  const makeDoc = (blocks: NormalizedDocument['blocks']): NormalizedDocument => ({
    version: AST_VERSION,
    blocks,
  });

  it('extracts text from paragraphs', () => {
    const doc = makeDoc([
      { type: 'paragraph', children: [{ type: 'text', text: 'Hello', format: {} }] },
      { type: 'paragraph', children: [{ type: 'text', text: 'World', format: {} }] },
    ]);

    const result = extractPlainText(doc);
    expect(result).toBe('Hello\nWorld');
  });

  it('extracts text from lists with prefixes', () => {
    const doc = makeDoc([
      {
        type: 'list',
        ordered: false,
        children: [
          { type: 'listItem', children: [{ type: 'text', text: 'Item 1', format: {} }] },
          { type: 'listItem', children: [{ type: 'text', text: 'Item 2', format: {} }] },
        ],
      },
    ]);

    const result = extractPlainText(doc);
    expect(result).toContain('- Item 1');
    expect(result).toContain('- Item 2');
  });

  it('extracts text from ordered lists with numbers', () => {
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

    const result = extractPlainText(doc);
    expect(result).toContain('1. First');
    expect(result).toContain('2. Second');
  });

  it('extracts text from code blocks', () => {
    const doc = makeDoc([{ type: 'code', code: 'const x = 1;' }]);

    const result = extractPlainText(doc);
    expect(result).toBe('const x = 1;');
  });
});

describe('flattenInlineContent', () => {
  it('flattens text nodes', () => {
    const content: InlineContent[] = [
      { type: 'text', text: 'Hello ', format: {} },
      { type: 'text', text: 'world', format: { bold: true } },
    ];

    expect(flattenInlineContent(content)).toBe('Hello world');
  });

  it('flattens links without URLs by default', () => {
    const content: InlineContent[] = [
      { type: 'text', text: 'Visit ', format: {} },
      {
        type: 'link',
        url: 'https://example.com',
        children: [{ type: 'text', text: 'Example', format: {} }],
      },
    ];

    expect(flattenInlineContent(content)).toBe('Visit Example');
  });

  it('includes URLs when option is set', () => {
    const content: InlineContent[] = [
      {
        type: 'link',
        url: 'https://example.com',
        children: [{ type: 'text', text: 'Example', format: {} }],
      },
    ];

    expect(flattenInlineContent(content, { includeLinkUrls: true })).toBe(
      'Example (https://example.com)',
    );
  });

  it('handles empty content', () => {
    expect(flattenInlineContent([])).toBe('');
  });
});

describe('documentHasContent', () => {
  const makeDoc = (blocks: NormalizedDocument['blocks']): NormalizedDocument => ({
    version: AST_VERSION,
    blocks,
  });

  it('returns false for empty document', () => {
    expect(documentHasContent(makeDoc([]))).toBe(false);
  });

  it('returns false for only linebreaks', () => {
    expect(documentHasContent(makeDoc([{ type: 'linebreak' }]))).toBe(false);
  });

  it('returns false for empty paragraphs', () => {
    const doc = makeDoc([
      { type: 'paragraph', children: [{ type: 'text', text: '   ', format: {} }] },
    ]);
    expect(documentHasContent(doc)).toBe(false);
  });

  it('returns true for paragraph with content', () => {
    const doc = makeDoc([
      { type: 'paragraph', children: [{ type: 'text', text: 'Hello', format: {} }] },
    ]);
    expect(documentHasContent(doc)).toBe(true);
  });

  it('returns true for code block with content', () => {
    const doc = makeDoc([{ type: 'code', code: 'x = 1' }]);
    expect(documentHasContent(doc)).toBe(true);
  });

  it('returns false for empty code block', () => {
    const doc = makeDoc([{ type: 'code', code: '   ' }]);
    expect(documentHasContent(doc)).toBe(false);
  });

  it('returns true for list with content', () => {
    const doc = makeDoc([
      {
        type: 'list',
        ordered: false,
        children: [{ type: 'listItem', children: [{ type: 'text', text: 'Item', format: {} }] }],
      },
    ]);
    expect(documentHasContent(doc)).toBe(true);
  });

  it('returns true for link with content', () => {
    const doc = makeDoc([
      {
        type: 'paragraph',
        children: [
          {
            type: 'link',
            url: 'https://example.com',
            children: [{ type: 'text', text: 'Link', format: {} }],
          },
        ],
      },
    ]);
    expect(documentHasContent(doc)).toBe(true);
  });
});
