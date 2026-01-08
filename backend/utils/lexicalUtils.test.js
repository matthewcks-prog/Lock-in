/**
 * Tests for Lexical editor utility functions
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const { extractPlainTextFromLexical } = require('./lexicalUtils');

test('extractPlainTextFromLexical: extracts text from simple Lexical state', () => {
  const editorState = {
    root: {
      children: [
        {
          text: 'Hello',
        },
        {
          text: 'world',
        },
      ],
    },
  };

  const result = extractPlainTextFromLexical(editorState);
  assert.equal(result, 'Hello world');
});

test('extractPlainTextFromLexical: handles nested children', () => {
  const editorState = {
    root: {
      children: [
        {
          children: [{ text: 'Nested' }, { text: 'text' }],
        },
        {
          text: 'here',
        },
      ],
    },
  };

  const result = extractPlainTextFromLexical(editorState);
  assert.equal(result, 'Nested text here');
});

test('extractPlainTextFromLexical: handles JSON string input', () => {
  const editorState = {
    root: {
      children: [{ text: 'From JSON string' }],
    },
  };

  const jsonString = JSON.stringify(editorState);
  const result = extractPlainTextFromLexical(jsonString);
  assert.equal(result, 'From JSON string');
});

test('extractPlainTextFromLexical: returns empty string for null/undefined', () => {
  assert.equal(extractPlainTextFromLexical(null), '');
  assert.equal(extractPlainTextFromLexical(undefined), '');
  assert.equal(extractPlainTextFromLexical(''), '');
});

test('extractPlainTextFromLexical: handles invalid JSON gracefully', () => {
  const result = extractPlainTextFromLexical('not valid json {');
  assert.equal(result, '');
});

test('extractPlainTextFromLexical: handles missing root or children', () => {
  assert.equal(extractPlainTextFromLexical({}), '');
  assert.equal(extractPlainTextFromLexical({ root: {} }), '');
  assert.equal(extractPlainTextFromLexical({ root: { children: [] } }), '');
});

test('extractPlainTextFromLexical: filters out empty text nodes', () => {
  const editorState = {
    root: {
      children: [{ text: 'Hello' }, { text: '' }, { text: 'world' }],
    },
  };

  const result = extractPlainTextFromLexical(editorState);
  assert.equal(result, 'Hello world');
});

test('extractPlainTextFromLexical: handles complex nested structure', () => {
  const editorState = {
    root: {
      children: [
        {
          children: [
            { text: 'First' },
            {
              children: [{ text: 'deeply' }, { text: 'nested' }],
            },
          ],
        },
        { text: 'final' },
      ],
    },
  };

  const result = extractPlainTextFromLexical(editorState);
  assert.equal(result, 'First deeply nested final');
});
