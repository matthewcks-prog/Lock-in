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

  it('parses text styles (colors) from style property', () => {
    const state = {
      root: {
        children: [
          {
            type: 'paragraph',
            children: [
              { type: 'text', text: 'red text', format: 0, style: 'color: #ff0000;' },
              { type: 'text', text: 'highlighted', format: 0, style: 'background-color: yellow;' },
              {
                type: 'text',
                text: 'both',
                format: 0,
                style: 'color: blue; background-color: #ffff00;',
              },
            ],
          },
        ],
      },
    };

    const result = normalizeEditorState(state);
    const paragraph = result.blocks[0] as ParagraphBlock;
    const children = paragraph.children as import('../types').TextRun[];

    expect(children[0].styles).toEqual({ color: '#ff0000' });
    expect(children[1].styles).toEqual({ backgroundColor: 'yellow' });
    expect(children[2].styles).toEqual({ color: 'blue', backgroundColor: '#ffff00' });
  });

  it('parses text alignment on paragraphs', () => {
    const state = {
      root: {
        children: [
          {
            type: 'paragraph',
            format: 2,
            children: [{ type: 'text', text: 'centered', format: 0 }],
          },
          { type: 'paragraph', format: 3, children: [{ type: 'text', text: 'right', format: 0 }] },
          {
            type: 'paragraph',
            format: 4,
            children: [{ type: 'text', text: 'justified', format: 0 }],
          },
          {
            type: 'paragraph',
            format: 1,
            children: [{ type: 'text', text: 'left (explicit)', format: 0 }],
          },
          { type: 'paragraph', children: [{ type: 'text', text: 'left (default)', format: 0 }] },
        ],
      },
    };

    const result = normalizeEditorState(state);

    expect((result.blocks[0] as ParagraphBlock).alignment).toBe('center');
    expect((result.blocks[1] as ParagraphBlock).alignment).toBe('right');
    expect((result.blocks[2] as ParagraphBlock).alignment).toBe('justify');
    expect((result.blocks[3] as ParagraphBlock).alignment).toBeUndefined(); // left is default, not stored
    expect((result.blocks[4] as ParagraphBlock).alignment).toBeUndefined();
  });

  it('parses text alignment on headings', () => {
    const state = {
      root: {
        children: [
          {
            type: 'heading',
            tag: 'h1',
            format: 2,
            children: [{ type: 'text', text: 'Centered Title', format: 0 }],
          },
          {
            type: 'heading',
            tag: 'h2',
            format: 3,
            children: [{ type: 'text', text: 'Right Subtitle', format: 0 }],
          },
        ],
      },
    };

    const result = normalizeEditorState(state);

    expect((result.blocks[0] as HeadingBlock).alignment).toBe('center');
    expect((result.blocks[1] as HeadingBlock).alignment).toBe('right');
  });

  it('does not include styles property when no styles present', () => {
    const state = {
      root: {
        children: [
          {
            type: 'paragraph',
            children: [
              { type: 'text', text: 'no styles', format: 1 },
              { type: 'text', text: 'empty style', format: 0, style: '' },
            ],
          },
        ],
      },
    };

    const result = normalizeEditorState(state);
    const paragraph = result.blocks[0] as ParagraphBlock;
    const children = paragraph.children as import('../types').TextRun[];

    expect(children[0].styles).toBeUndefined();
    expect(children[1].styles).toBeUndefined();
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

  it('normalizes list items with nested paragraph children (real Lexical structure)', () => {
    // This is the actual structure Lexical produces when list items contain
    // formatted text or were created in certain ways
    const state = {
      root: {
        children: [
          {
            type: 'list',
            listType: 'bullet',
            children: [
              {
                type: 'listitem',
                children: [
                  {
                    type: 'paragraph',
                    children: [
                      {
                        type: 'text',
                        text: 'Describe the building blocks of a computer system',
                        format: 0,
                      },
                    ],
                  },
                ],
              },
              {
                type: 'listitem',
                children: [
                  {
                    type: 'paragraph',
                    children: [
                      { type: 'text', text: 'Understand various terminologies', format: 0 },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    };

    const result = normalizeEditorState(state);

    expect(result.blocks).toHaveLength(1);
    const list = result.blocks[0] as import('../types').ListBlock;
    expect(list.type).toBe('list');
    expect(list.children).toHaveLength(2);
    // Should extract text from nested paragraph
    expect(list.children[0].children).toHaveLength(1);
    expect(list.children[0].children[0]).toMatchObject({
      type: 'text',
      text: 'Describe the building blocks of a computer system',
    });
    expect(list.children[1].children[0]).toMatchObject({
      type: 'text',
      text: 'Understand various terminologies',
    });
  });

  it('normalizes deeply nested list item content', () => {
    // Lexical can nest content several levels deep
    const state = {
      root: {
        children: [
          {
            type: 'list',
            listType: 'bullet',
            children: [
              {
                type: 'listitem',
                children: [
                  {
                    type: 'paragraph',
                    children: [
                      { type: 'text', text: 'Bold ', format: 1 },
                      { type: 'text', text: 'and normal text', format: 0 },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    };

    const result = normalizeEditorState(state);

    const list = result.blocks[0] as import('../types').ListBlock;
    expect(list.children[0].children).toHaveLength(2);
    expect(list.children[0].children[0]).toMatchObject({
      type: 'text',
      text: 'Bold ',
      format: { bold: true },
    });
    expect(list.children[0].children[1]).toMatchObject({
      type: 'text',
      text: 'and normal text',
    });
  });

  it('normalizes list items with links inside paragraphs', () => {
    const state = {
      root: {
        children: [
          {
            type: 'list',
            listType: 'bullet',
            children: [
              {
                type: 'listitem',
                children: [
                  {
                    type: 'paragraph',
                    children: [
                      { type: 'text', text: 'Check ', format: 0 },
                      {
                        type: 'link',
                        url: 'https://example.com',
                        children: [{ type: 'text', text: 'this link', format: 0 }],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    };

    const result = normalizeEditorState(state);

    const list = result.blocks[0] as import('../types').ListBlock;
    expect(list.children[0].children).toHaveLength(2);
    expect(list.children[0].children[0]).toMatchObject({
      type: 'text',
      text: 'Check ',
    });
    expect(list.children[0].children[1]).toMatchObject({
      type: 'link',
      url: 'https://example.com',
    });
  });

  it('normalizes quote containing nested paragraph', () => {
    // Quotes can also contain paragraph children
    const state = {
      root: {
        children: [
          {
            type: 'quote',
            children: [
              {
                type: 'paragraph',
                children: [{ type: 'text', text: 'Quoted text here', format: 0 }],
              },
            ],
          },
        ],
      },
    };

    const result = normalizeEditorState(state);

    const quote = result.blocks[0] as import('../types').QuoteBlock;
    expect(quote.children).toHaveLength(1);
    expect(quote.children[0]).toMatchObject({
      type: 'text',
      text: 'Quoted text here',
    });
  });

  it('handles unknown wrapper nodes by extracting children', () => {
    // Forward compatibility: unknown nodes with children should still extract text
    const state = {
      root: {
        children: [
          {
            type: 'list',
            listType: 'bullet',
            children: [
              {
                type: 'listitem',
                children: [
                  {
                    type: 'unknown-future-node',
                    children: [{ type: 'text', text: 'Future-proof text', format: 0 }],
                  },
                ],
              },
            ],
          },
        ],
      },
    };

    const result = normalizeEditorState(state);

    const list = result.blocks[0] as import('../types').ListBlock;
    expect(list.children[0].children).toHaveLength(1);
    expect(list.children[0].children[0]).toMatchObject({
      type: 'text',
      text: 'Future-proof text',
    });
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
