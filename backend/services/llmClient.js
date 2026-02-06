/**
 * LLM Client Module - Provider-Agnostic Chat Completions
 *
 * Strategy:
 * - Chat Completions: Gemini (Primary) -> OpenAI (Fallback)
 * - Uses multi-provider abstraction with automatic fallback
 *
 * Note: Embeddings -> services/embeddings.js (Azure primary, OpenAI fallback)
 *       Transcription -> services/transcripts/transcriptionService.js (Azure Speech primary, Whisper fallback)
 *
 * @module services/llmClient
 */

const { generateLockInResponse } = require('./llm/lockInResponse');
const { buildStructuredStudyMessages } = require('./llm/structuredMessages');
const { generateStructuredStudyResponse } = require('./llm/structuredResponse');
const { generateChatTitleFromHistory } = require('./llm/chatTitle');
const { chatWithModel } = require('./llm/basicChat');

module.exports = {
  generateLockInResponse,
  generateStructuredStudyResponse,
  buildStructuredStudyMessages,
  generateChatTitleFromHistory,
  chatWithModel,
};
