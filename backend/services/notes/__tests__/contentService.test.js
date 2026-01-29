// backend/services/notes/__tests__/contentService.test.js

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  processNoteContent,
  validateNoteContentNotEmpty,
  normalizeTags,
  validateTitle,
} = require('../contentService');

test('processNoteContent - process valid Lexical content', () => {
  const input = {
    content_json: { root: { children: [] } },
    editor_version: 'lexical_v1',
    content_text: 'Sample text',
  };

  const result = processNoteContent(input);

  assert.deepEqual(result.contentJson, { root: { children: [] } });
  assert.equal(result.editorVersion, 'lexical_v1');
  assert.equal(result.plainText, 'Sample text');
  assert.equal(result.legacyContent, null);
});

test('processNoteContent - process Lexical content with empty text', () => {
  const input = {
    content_json: { root: { children: [] } },
    editor_version: 'lexical_v1',
    content_text: '',
  };

  const result = processNoteContent(input);

  assert.equal(result.plainText, '');
  assert.equal(result.legacyContent, null);
});

test('processNoteContent - accept Lexical content with empty legacy fallback', () => {
  const input = {
    content: '', // Empty legacy content
    content_json: { root: { children: [] } },
    editor_version: 'lexical_v1',
    content_text: 'Text',
  };

  const result = processNoteContent(input);

  assert.equal(result.plainText, 'Text');
  assert.equal(result.legacyContent, null);
});

test('processNoteContent - parse content_json from string', () => {
  const input = {
    content_json: '{"root":{"children":[]}}',
    editor_version: 'lexical_v1',
    content_text: 'Text',
  };

  const result = processNoteContent(input);

  assert.deepEqual(result.contentJson, { root: { children: [] } });
});

test('processNoteContent - throw on invalid JSON string', () => {
  const input = {
    content_json: 'not valid json',
    editor_version: 'lexical_v1',
  };

  assert.throws(() => processNoteContent(input), /Invalid content_json: must be valid JSON/);
});

test('processNoteContent - process plain text legacy content', () => {
  const input = {
    content: 'Plain text content',
  };

  const result = processNoteContent(input);

  assert.equal(result.plainText, 'Plain text content');
  assert.equal(result.legacyContent, 'Plain text content');
});

test('processNoteContent - strip HTML from legacy content', () => {
  const input = {
    content: '<p>HTML <strong>content</strong></p>',
  };

  const result = processNoteContent(input);

  assert.equal(result.plainText, 'HTML content');
  assert.equal(result.legacyContent, '<p>HTML <strong>content</strong></p>');
});

test('processNoteContent - throw when neither Lexical nor legacy content provided', () => {
  const input = {};

  assert.throws(() => processNoteContent(input), /Content format error/);
});

test('processNoteContent - NOT throw for empty plainText when Lexical is present', () => {
  const input = {
    content_json: { root: { children: [] } },
    editor_version: 'lexical_v1',
    content_text: '',
  };

  const result = processNoteContent(input); // Should not throw
  assert.equal(result.plainText, '');
});

test('validateNoteContentNotEmpty - return true for non-empty content', () => {
  assert.equal(validateNoteContentNotEmpty('Some text'), true);
});

test('validateNoteContentNotEmpty - return false for empty string', () => {
  assert.equal(validateNoteContentNotEmpty(''), false);
});

test('validateNoteContentNotEmpty - return false for whitespace only', () => {
  assert.equal(validateNoteContentNotEmpty('   '), false);
});

test('validateNoteContentNotEmpty - return false for null', () => {
  assert.equal(validateNoteContentNotEmpty(null), false);
});

test('validateNoteContentNotEmpty - respect custom minLength parameter', () => {
  assert.equal(validateNoteContentNotEmpty('ab', 3), false);
  assert.equal(validateNoteContentNotEmpty('abc', 3), true);
});

test('normalizeTags - normalize array of tags', () => {
  const tags = ['tag1', 'tag2', 'tag3'];
  const result = normalizeTags(tags);

  assert.deepEqual(result, ['tag1', 'tag2', 'tag3']);
});

test('normalizeTags - parse comma-separated string', () => {
  const tags = 'tag1, tag2, tag3';
  const result = normalizeTags(tags);

  assert.deepEqual(result, ['tag1', 'tag2', 'tag3']);
});

test('normalizeTags - filter out empty strings', () => {
  const tags = ['tag1', '', '  ', 'tag2'];
  const result = normalizeTags(tags);

  assert.deepEqual(result, ['tag1', 'tag2']);
});

test('normalizeTags - trim whitespace from tags', () => {
  const tags = ['  tag1  ', 'tag2  '];
  const result = normalizeTags(tags);

  assert.deepEqual(result, ['tag1', 'tag2']);
});

test('normalizeTags - limit to max tags', () => {
  const tags = Array(25).fill('tag');
  const result = normalizeTags(tags, 20);

  assert.equal(result.length, 20);
});

test('normalizeTags - return empty array for null/undefined', () => {
  assert.deepEqual(normalizeTags(null), []);
  assert.deepEqual(normalizeTags(undefined), []);
});

test('validateTitle - return trimmed title', () => {
  assert.equal(validateTitle('  My Title  '), 'My Title');
});

test('validateTitle - return "Untitled Note" for empty string', () => {
  assert.equal(validateTitle(''), 'Untitled Note');
});

test('validateTitle - return "Untitled Note" for whitespace only', () => {
  assert.equal(validateTitle('   '), 'Untitled Note');
});

test('validateTitle - return "Untitled Note" for null/undefined', () => {
  assert.equal(validateTitle(null), 'Untitled Note');
  assert.equal(validateTitle(undefined), 'Untitled Note');
});

test('validateTitle - truncate long titles', () => {
  const longTitle = 'a'.repeat(600);
  const result = validateTitle(longTitle, 500);

  assert.equal(result.length, 500);
});
