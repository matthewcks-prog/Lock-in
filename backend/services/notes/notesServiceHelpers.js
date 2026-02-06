const { ValidationError } = require('../../errors');
const { MAX_NOTE_CONTENT_LENGTH } = require('../../utils/noteLimits');

function normalizeOptionalString(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function hasOwn(target, key) {
  return Object.prototype.hasOwnProperty.call(target, key);
}

async function prepareContent(contentPayload, services) {
  let processed;
  try {
    processed = services.contentService.processNoteContent(contentPayload || {});
  } catch (error) {
    throw new ValidationError(error.message || 'Invalid content format', 'content');
  }

  if (processed.plainText.length > MAX_NOTE_CONTENT_LENGTH) {
    throw new ValidationError(
      `Content exceeds maximum length of ${MAX_NOTE_CONTENT_LENGTH} characters`,
      'content_text',
    );
  }

  let embedding = null;
  if (services.contentService.validateNoteContentNotEmpty(processed.plainText)) {
    embedding = await services.contentService.generateEmbeddingForNote(processed.plainText);
  }

  return { processed, embedding };
}

function buildCreateMetadata(payload, services) {
  return {
    title: services.contentService.validateTitle(payload.title),
    sourceSelection: normalizeOptionalString(payload.sourceSelection),
    sourceUrl: normalizeOptionalString(payload.sourceUrl),
    courseCode: normalizeOptionalString(payload.courseCode),
    noteType:
      typeof payload.noteType === 'string' && payload.noteType.trim() ? payload.noteType : 'manual',
    tags: services.contentService.normalizeTags(payload.tags),
    clientNoteId:
      typeof payload.clientNoteId === 'string' && payload.clientNoteId.trim()
        ? payload.clientNoteId.trim()
        : null,
  };
}

function buildUpdateMetadata(payload, services) {
  const update = {};

  if (hasOwn(payload, 'title')) {
    update.title = services.contentService.validateTitle(payload.title);
  }

  if (hasOwn(payload, 'sourceSelection')) {
    update.sourceSelection = normalizeOptionalString(payload.sourceSelection);
  }

  if (hasOwn(payload, 'sourceUrl')) {
    update.sourceUrl = normalizeOptionalString(payload.sourceUrl);
  }

  if (hasOwn(payload, 'courseCode')) {
    update.courseCode = normalizeOptionalString(payload.courseCode);
  }

  if (hasOwn(payload, 'noteType')) {
    update.noteType =
      typeof payload.noteType === 'string' && payload.noteType.trim() ? payload.noteType : null;
  }

  if (hasOwn(payload, 'tags')) {
    update.tags = services.contentService.normalizeTags(payload.tags);
  }

  return update;
}

module.exports = {
  normalizeOptionalString,
  prepareContent,
  buildCreateMetadata,
  buildUpdateMetadata,
};
