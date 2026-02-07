/**
 * LLM Client Module - Provider-Agnostic Chat Completions
 *
 * Strategy:
 * - Chat Completions: Gemini (Primary) -> Groq -> OpenAI (Fallback)
 * - Uses multi-provider abstraction with automatic fallback
 * - Streaming via chatCompletionStream for modern chat UIs
 * - Natural markdown responses (industry standard)
 *
 * Note: Embeddings -> services/embeddings.js (Azure primary, OpenAI fallback)
 *       Transcription -> services/transcripts/transcriptionService.js (Azure Speech primary, Whisper fallback)
 *
 * @module services/llmClient
 */

const { generateLockInResponse } = require('./llm/lockInResponse');
const { buildStructuredStudyMessages } = require('./llm/structuredMessages');
const { generateChatTitleFromHistory } = require('./llm/chatTitle');
const { chatWithModel } = require('./llm/basicChat');
const { createChatCompletion, chatCompletionStream } = require('./llm/providerChain');

module.exports = {
  generateLockInResponse,
  buildStructuredStudyMessages,
  generateChatTitleFromHistory,
  chatWithModel,
  createChatCompletion,
  chatCompletionStream,
};
