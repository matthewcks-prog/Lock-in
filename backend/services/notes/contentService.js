// backend/services/notes/contentService.js

const { embedText } = require('../embeddings');
const { extractPlainTextFromLexical } = require('../../utils/lexicalUtils');

/**
 * Note Content Service
 *
 * Handles content processing logic for notes:
 * - Legacy vs Lexical format detection
 * - Plain text extraction
 * - Embedding generation
 */

/**
 * Process note content based on format (Lexical or Legacy)
 *
 * This function transforms content from various formats into a normalized structure.
 * It does NOT enforce business rules about empty content - that's the controller's job.
 *
 * @param {Object} params
 * @param {string} [params.content] - Legacy HTML/plaintext content
 * @param {Object|string} [params.content_json] - Lexical JSON state
 * @param {string} [params.editor_version] - Editor version (e.g., 'lexical_v1')
 * @param {string} [params.content_text] - Pre-extracted plain text from Lexical
 * @returns {Object} { contentJson, editorVersion, plainText, legacyContent }
 * @throws {Error} If content format is invalid (malformed JSON, wrong types, etc.)
 */
function processNoteContent({ content, content_json, editor_version, content_text }) {
  const hasLexicalContent = content_json && editor_version;
  const hasLegacyContent = content && typeof content === 'string' && content.trim().length > 0;

  // At least one format must be present (validated by Zod schema)
  if (!hasLexicalContent && !hasLegacyContent) {
    throw new Error(
      'Content format error: content_json+editor_version or legacy content field is required',
    );
  }

  let finalContentJson = {};
  let finalEditorVersion = 'lexical_v1';
  let plainText = '';

  if (hasLexicalContent) {
    // Parse and validate Lexical JSON structure
    if (typeof content_json === 'string') {
      try {
        finalContentJson = JSON.parse(content_json);
      } catch (err) {
        throw new Error(`Invalid content_json: must be valid JSON. ${err.message}`);
      }
    } else if (typeof content_json === 'object' && content_json !== null) {
      finalContentJson = content_json;
    } else {
      throw new Error('Invalid content_json: must be a JSON object or string');
    }
    finalEditorVersion = editor_version;

    // Extract plain text from Lexical state
    // If pre-extracted text is provided, use that for performance
    plainText = content_text || extractPlainTextFromLexical(finalContentJson) || '';
  } else {
    // Legacy: use content field
    plainText = content.trim();
    // Basic HTML stripping for legacy content
    plainText = plainText
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Note: We intentionally do NOT throw an error for empty plainText here.
  // This allows the system to:
  // 1. Accept notes in draft state (user just opened editor)
  // 2. Handle edge cases where Lexical state exists but text is empty
  // 3. Let controllers enforce business rules about minimum content
  //
  // If empty content is unacceptable, the controller should validate
  // plainText.length before proceeding with embedding/storage.

  return {
    contentJson: finalContentJson,
    editorVersion: finalEditorVersion,
    plainText,
    legacyContent: hasLegacyContent ? content.trim() : null,
  };
}

/**
 * Validate that note content is not empty
 *
 * This is a business rule validator that should be called by controllers
 * when they need to enforce minimum content requirements.
 *
 * @param {string} plainText - Plain text extracted from note content
 * @param {number} minLength - Minimum acceptable length (default: 1)
 * @returns {boolean} true if valid, false if empty
 */
function validateNoteContentNotEmpty(plainText, minLength = 1) {
  if (!plainText || typeof plainText !== 'string') {
    return false;
  }
  return plainText.trim().length >= minLength;
}

/**
 * Generate embedding for note content
 *
 * @param {string} plainText - Plain text to embed
 * @returns {Promise<Array|null>} Embedding vector or null on failure
 */
async function generateEmbeddingForNote(plainText) {
  try {
    return await embedText(plainText);
  } catch (embedError) {
    // Log but don't fail - note can still be saved without embedding
    console.error('Failed to generate embedding:', embedError);
    return null;
  }
}

/**
 * Normalize tags to ensure consistent array format
 *
 * @param {any} tags - Tags input (array, string, or null/undefined)
 * @param {number} maxTags - Maximum number of tags allowed
 * @param {number} maxTagLength - Maximum length per tag
 * @returns {string[]} Normalized array of tags
 */
function normalizeTags(tags, maxTags = 20, maxTagLength = 50) {
  if (!tags) return [];
  if (Array.isArray(tags)) {
    return tags
      .filter((tag) => typeof tag === 'string' && tag.trim().length > 0)
      .slice(0, maxTags)
      .map((tag) => tag.trim().slice(0, maxTagLength));
  }
  if (typeof tags === 'string') {
    return tags
      .split(',')
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0)
      .slice(0, maxTags)
      .map((tag) => tag.slice(0, maxTagLength));
  }
  return [];
}

/**
 * Validate and sanitize title
 *
 * @param {string} title - Note title
 * @param {number} maxLength - Maximum title length
 * @returns {string} Sanitized title
 */
function validateTitle(title, maxLength = 500) {
  if (!title || typeof title !== 'string') {
    return 'Untitled Note';
  }
  return title.trim().slice(0, maxLength) || 'Untitled Note';
}

module.exports = {
  processNoteContent,
  validateNoteContentNotEmpty,
  generateEmbeddingForNote,
  normalizeTags,
  validateTitle,
};
