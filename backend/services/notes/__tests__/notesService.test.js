const test = require('node:test');
const assert = require('node:assert/strict');

const { createNotesService } = require('../notesService');

function createMockContentService(overrides = {}) {
  return {
    processNoteContent: (payload) => ({
      contentJson: { root: { children: [] } },
      editorVersion: 'lexical_v1',
      plainText: payload?.content_text || 'Sample',
      legacyContent: null,
    }),
    validateNoteContentNotEmpty: () => true,
    generateEmbeddingForNote: async () => [0.1, 0.2, 0.3],
    normalizeTags: (tags) => (Array.isArray(tags) ? tags : []),
    validateTitle: (title) =>
      typeof title === 'string' && title.trim() ? title.trim() : 'Untitled',
    ...overrides,
  };
}

test('createNote - normalizes nullable metadata and uses idempotency store', async () => {
  let runCalled = false;
  const notesRepo = {
    createNote: async (data) => ({ id: 'note-1', ...data }),
  };
  const idempotencyStore = {
    run: async (_key, _userId, task) => {
      runCalled = true;
      return task();
    },
  };
  const contentService = createMockContentService();

  const service = createNotesService({
    notesRepo,
    contentService,
    idempotencyStore,
    logger: { error: () => {} },
  });

  const result = await service.createNote({
    userId: 'user-1',
    idempotencyKey: 'key-1',
    payload: {
      title: null,
      content_json: { root: { children: [] } },
      editor_version: 'lexical_v1',
      content_text: 'Hello',
      sourceUrl: null,
      sourceSelection: null,
      courseCode: null,
      tags: null,
      clientNoteId: null,
    },
  });

  assert.equal(runCalled, true);
  assert.equal(result.id, 'note-1');
  assert.equal(result.sourceUrl, null);
  assert.equal(result.courseCode, null);
  assert.deepEqual(result.tags, []);
});

test('updateNote - wraps conflict errors with updatedAt', async () => {
  const notesRepo = {
    updateNote: async () => {
      const error = new Error('Conflict');
      error.name = 'ConflictError';
      error.updatedAt = '2026-01-29T00:00:00.000Z';
      throw error;
    },
  };
  const contentService = createMockContentService();

  const service = createNotesService({
    notesRepo,
    contentService,
    idempotencyStore: { run: async () => {} },
    logger: { error: () => {} },
  });

  try {
    await service.updateNote({
      userId: 'user-1',
      noteId: 'note-1',
      payload: {
        title: 'Updated',
        content_json: { root: { children: [] } },
        editor_version: 'lexical_v1',
        content_text: 'Hello',
      },
    });
    assert.fail('Expected conflict error');
  } catch (error) {
    assert.equal(error.code, 'CONFLICT');
    assert.equal(error.updatedAt, '2026-01-29T00:00:00.000Z');
  }
});

test('createNote - throws validation error when content processing fails', async () => {
  const notesRepo = {
    createNote: async () => ({ id: 'note-1' }),
  };
  const contentService = createMockContentService({
    processNoteContent: () => {
      throw new Error('Invalid content');
    },
  });

  const service = createNotesService({
    notesRepo,
    contentService,
    idempotencyStore: { run: async () => {} },
    logger: { error: () => {} },
  });

  await assert.rejects(
    () =>
      service.createNote({
        userId: 'user-1',
        payload: { content: 'invalid' },
      }),
    (error) => error.code === 'VALIDATION_ERROR',
  );
});
