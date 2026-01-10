const test = require('node:test');
const assert = require('node:assert/strict');

const { NOTE_ASSETS_MAX_BYTES, NOTE_ASSET_MIME_GROUPS } = require('../config');
const { validateAssetFile } = require('./assetValidation');

const ALLOWED_IMAGE = NOTE_ASSET_MIME_GROUPS.image[0];
const ALLOWED_DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

test('rejects missing file', () => {
  const result = validateAssetFile(undefined);
  assert.equal(result.valid, false);
  assert.match(result.reason, /File is required/);
});

test('rejects files over the size limit', () => {
  const result = validateAssetFile({
    size: NOTE_ASSETS_MAX_BYTES + 1,
    mimetype: ALLOWED_IMAGE,
  });

  assert.equal(result.valid, false);
  assert.match(result.reason, /maximum size/i);
});

test('rejects disallowed MIME types', () => {
  const result = validateAssetFile({
    size: 1024,
    mimetype: 'application/x-msdownload',
  });

  assert.equal(result.valid, false);
  assert.match(result.reason, /not allowed/i);
});

test('accepts allowed MIME types and returns type + extension', () => {
  const result = validateAssetFile({
    size: 2048,
    mimetype: ALLOWED_DOCX,
  });

  assert.equal(result.valid, true);
  assert.equal(result.type, 'document');
  assert.equal(result.extension, 'docx');
});
