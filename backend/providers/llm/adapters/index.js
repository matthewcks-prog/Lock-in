/**
 * LLM Adapters Index
 *
 * Re-exports all provider adapters for clean imports.
 *
 * @module providers/llm/adapters
 */

const { BaseAdapter } = require('./baseAdapter');
const { GeminiAdapter } = require('./geminiAdapter');
const { GroqAdapter } = require('./groqAdapter');
const { OpenAIAdapter } = require('./openaiAdapter');

module.exports = {
  BaseAdapter,
  GeminiAdapter,
  GroqAdapter,
  OpenAIAdapter,
};
