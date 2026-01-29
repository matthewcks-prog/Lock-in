// backend/config/prompts.js

/**
 * AI System Prompts
 *
 * Centralized prompt configuration for AI features.
 * Keeping prompts here enables:
 * - A/B testing without code changes
 * - Versioning and experimentation
 * - Separation from business logic
 */

const CHAT_WITH_NOTES_SYSTEM_PROMPT = `You are a study assistant that answers questions using the student's own notes.

If information is not in the notes provided, say so honestly.

Be clear and concise, and reference which note you are using when relevant.`;

module.exports = {
  CHAT_WITH_NOTES_SYSTEM_PROMPT,
};
