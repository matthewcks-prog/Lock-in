const test = require('node:test');
const assert = require('node:assert/strict');

const { createNoteAssetsService } = require('../noteAssetsService');

function createSupabaseStub(url = 'https://example.com/file') {
  return {
    storage: {
      from: () => ({
        upload: async () => ({ error: null }),
        getPublicUrl: () => ({ data: { publicUrl: url }, error: null }),
        remove: async () => ({ error: null }),
      }),
    },
  };
}

test('uploadNoteAsset - rejects missing file', async () => {
  const service = createNoteAssetsService({
    supabase: createSupabaseStub(),
    notesRepository: { getNoteForUser: async () => ({ id: 'note-1' }) },
    noteAssetsRepository: { createAsset: async () => ({ id: 'asset-1' }) },
    logger: { error: () => {}, warn: () => {} },
  });

  await assert.rejects(
    () => service.uploadNoteAsset({ userId: 'user-1', noteId: 'note-1', file: null }),
    (error) => error.code === 'VALIDATION_ERROR',
  );
});

test('listNoteAssets - returns assets with public urls', async () => {
  const service = createNoteAssetsService({
    supabase: createSupabaseStub('https://cdn.example.com/asset'),
    notesRepository: { getNoteForUser: async () => ({ id: 'note-1' }) },
    noteAssetsRepository: {
      listAssetsForNote: async () => [
        {
          id: 'asset-1',
          storage_path: 'user-1/note-1/asset-1.png',
        },
      ],
    },
    logger: { error: () => {}, warn: () => {} },
  });

  const assets = await service.listNoteAssets({ userId: 'user-1', noteId: 'note-1' });

  assert.equal(assets.length, 1);
  assert.equal(assets[0].url, 'https://cdn.example.com/asset');
});
