// backend/validators/__tests__/noteValidators.test.js

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createNoteSchema,
  updateNoteSchema,
  noteIdParamSchema,
  searchNotesSchema,
  listNotesSchema,
  chatWithNotesSchema,
  setStarredSchema,
} = require('../noteValidators');

test('createNoteSchema - valid Lexical content with empty legacy content', () => {
  const validData = {
    title: 'Test Note',
    content: '', // Empty legacy content (used as fallback)
    content_json: { root: { children: [] } },
    editor_version: 'lexical_v1',
    content_text: 'Some text',
  };

  const result = createNoteSchema.safeParse(validData);
  assert.equal(result.success, true, 'Should accept Lexical with empty legacy content');
});

test('createNoteSchema - valid Lexical content without legacy content field', () => {
  const validData = {
    title: 'Test Note',
    content_json: { root: { children: [] } },
    editor_version: 'lexical_v1',
    content_text: 'Some text',
  };

  const result = createNoteSchema.safeParse(validData);
  assert.equal(result.success, true);
});

test('createNoteSchema - valid legacy content without Lexical', () => {
  const validData = {
    title: 'Test Note',
    content: '<p>Legacy HTML content</p>',
  };

  const result = createNoteSchema.safeParse(validData);
  assert.equal(result.success, true);
});

test('createNoteSchema - reject when both Lexical and legacy content are missing', () => {
  const invalidData = {
    title: 'Test Note',
  };

  const result = createNoteSchema.safeParse(invalidData);
  assert.equal(result.success, false);
});

test('createNoteSchema - reject when only empty legacy content is provided', () => {
  const invalidData = {
    title: 'Test Note',
    content: '',
  };

  const result = createNoteSchema.safeParse(invalidData);
  assert.equal(result.success, false);
});

test('createNoteSchema - reject when only whitespace legacy content provided', () => {
  const invalidData = {
    title: 'Test Note',
    content: '   ',
  };

  const result = createNoteSchema.safeParse(invalidData);
  assert.equal(result.success, false);
});

test('createNoteSchema - reject Lexical content without editor_version', () => {
  const invalidData = {
    title: 'Test Note',
    content_json: { root: { children: [] } },
  };

  const result = createNoteSchema.safeParse(invalidData);
  assert.equal(result.success, false);
});

test('createNoteSchema - accept all optional metadata fields', () => {
  const validData = {
    title: 'Test Note',
    content_json: { root: { children: [] } },
    editor_version: 'lexical_v1',
    clientNoteId: '123e4567-e89b-12d3-a456-426614174000',
    sourceSelection: 'Selected text',
    sourceUrl: 'https://example.com/page',
    courseCode: 'CS101',
    noteType: 'manual',
    tags: ['tag1', 'tag2'],
  };

  const result = createNoteSchema.safeParse(validData);
  assert.equal(result.success, true);
});

test('createNoteSchema - accept nullable optional fields', () => {
  const validData = {
    title: null,
    content_json: { root: { children: [] } },
    editor_version: 'lexical_v1',
    clientNoteId: null,
    sourceSelection: null,
    sourceUrl: null,
    courseCode: null,
    noteType: null,
    tags: null,
    content_text: null,
    content: null,
  };

  const result = createNoteSchema.safeParse(validData);
  assert.equal(result.success, true);
});

test('createNoteSchema - accept tags as comma-separated string', () => {
  const validData = {
    title: 'Test Note',
    content_json: { root: { children: [] } },
    editor_version: 'lexical_v1',
    tags: 'tag1,tag2,tag3',
  };

  const result = createNoteSchema.safeParse(validData);
  assert.equal(result.success, true);
});

test('createNoteSchema - reject invalid UUID for clientNoteId', () => {
  const invalidData = {
    title: 'Test Note',
    content_json: { root: { children: [] } },
    editor_version: 'lexical_v1',
    clientNoteId: 'not-a-uuid',
  };

  const result = createNoteSchema.safeParse(invalidData);
  assert.equal(result.success, false);
});

test('createNoteSchema - reject title longer than 500 characters', () => {
  const invalidData = {
    title: 'a'.repeat(501),
    content_json: { root: { children: [] } },
    editor_version: 'lexical_v1',
  };

  const result = createNoteSchema.safeParse(invalidData);
  assert.equal(result.success, false);
});

test('noteIdParamSchema - accept valid UUID', () => {
  const validData = {
    noteId: '123e4567-e89b-12d3-a456-426614174000',
  };

  const result = noteIdParamSchema.safeParse(validData);
  assert.equal(result.success, true);
});

test('noteIdParamSchema - reject invalid UUID', () => {
  const invalidData = {
    noteId: 'not-a-uuid',
  };

  const result = noteIdParamSchema.safeParse(invalidData);
  assert.equal(result.success, false);
});

test('searchNotesSchema - accept valid search query', () => {
  const validData = {
    q: 'search term',
    courseCode: 'CS101',
    k: '10',
  };

  const result = searchNotesSchema.safeParse(validData);
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.k, 10); // Coerced to number
  }
});

test('searchNotesSchema - reject empty query', () => {
  const invalidData = {
    q: '',
  };

  const result = searchNotesSchema.safeParse(invalidData);
  assert.equal(result.success, false);
});

test('setStarredSchema - accept boolean isStarred', () => {
  const validData = {
    isStarred: true,
  };

  const result = setStarredSchema.safeParse(validData);
  assert.equal(result.success, true);
});

test('setStarredSchema - reject non-boolean isStarred', () => {
  const invalidData = {
    isStarred: 'true',
  };

  const result = setStarredSchema.safeParse(invalidData);
  assert.equal(result.success, false);
});
