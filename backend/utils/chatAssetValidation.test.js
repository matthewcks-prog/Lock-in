const test = require('node:test');
const assert = require('node:assert/strict');

const { CHAT_ASSETS_MAX_BYTES, CHAT_ASSET_MIME_GROUPS } = require('../config');
const { validateChatAssetFile } = require('./chatAssetValidation');

const ALLOWED_IMAGE = CHAT_ASSET_MIME_GROUPS.image[0];
const ALLOWED_DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

test('rejects missing file', async () => {
  const result = await validateChatAssetFile(undefined);
  assert.equal(result.valid, false);
  assert.match(result.reason, /File is required/);
});

test('rejects files over the size limit', async () => {
  const result = await validateChatAssetFile({
    size: CHAT_ASSETS_MAX_BYTES + 1,
    mimetype: ALLOWED_IMAGE,
    buffer: Buffer.from('not-used'),
  });

  assert.equal(result.valid, false);
  assert.match(result.reason, /maximum size/i);
});

test('rejects disallowed MIME types', async () => {
  const result = await validateChatAssetFile({
    size: 1024,
    mimetype: 'application/x-msdownload',
    buffer: Buffer.from('not-used'),
  });

  assert.equal(result.valid, false);
  assert.match(result.reason, /not allowed/i);
});

test('accepts allowed text MIME types without magic bytes', async () => {
  const result = await validateChatAssetFile({
    size: 512,
    mimetype: 'text/plain',
    buffer: Buffer.from('console.log("hello");'),
  });

  assert.equal(result.valid, true);
  assert.equal(result.type, 'document');
  assert.equal(result.extension, 'txt');
});

test('accepts office documents detected as zip', async () => {
  const result = await validateChatAssetFile({
    size: 2048,
    mimetype: ALLOWED_DOCX,
    buffer: Buffer.from('504b0304', 'hex'),
  });

  assert.equal(result.valid, true);
  assert.equal(result.type, 'document');
  assert.equal(result.extension, 'docx');
});

test('rejects mismatched magic bytes', async () => {
  const result = await validateChatAssetFile({
    size: 1024,
    mimetype: ALLOWED_IMAGE,
    buffer: Buffer.from('%PDF-1.7'),
  });

  assert.equal(result.valid, false);
  assert.match(result.reason, /content does not match/i);
});
