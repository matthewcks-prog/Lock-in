/**
 * Quick test to verify Groq API specifically
 * Run: node providers/llm/__tests__/testGroq.js
 */

require('dotenv').config();
const { GroqAdapter } = require('../adapters/groqAdapter');

function createAdapter(apiKey) {
  return new GroqAdapter({
    apiKey,
    model: process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
    fallbackModel: process.env.GROQ_FALLBACK_MODEL || 'llama-3.3-70b-versatile',
  });
}

function requireApiKey() {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    console.error('GROQ_API_KEY not set');
    process.exit(1);
  }
  return apiKey;
}

function logAdapter(adapter) {
  console.log('Provider:', adapter.getProviderName());
  console.log('Model:', adapter.model);
  console.log('Fallback Model:', adapter.fallbackModel);
  console.log('Available:', adapter.isAvailable());
  console.log('');
}

function logSuccess({ result, latency }) {
  console.log('\nSUCCESS');
  console.log('Provider:', result.provider);
  console.log('Model:', result.model);
  console.log('Response:', result.content);
  console.log('Usage:', result.usage);
  console.log('Latency:', latency + 'ms');
}

async function runRequest(adapter) {
  console.log('Sending test request...');
  const startTime = Date.now();
  const result = await adapter.chatCompletion(
    [
      { role: 'system', content: 'You are a helpful assistant. Respond very briefly.' },
      { role: 'user', content: 'Say "Hello from Groq!" in exactly 5 words.' },
    ],
    {
      temperature: 0.7,
      maxTokens: 20,
    },
  );
  return { result, latency: Date.now() - startTime };
}

async function main() {
  console.log('=== Groq API Direct Test ===\n');
  const apiKey = requireApiKey();
  const adapter = createAdapter(apiKey);
  logAdapter(adapter);

  try {
    const { result, latency } = await runRequest(adapter);
    logSuccess({ result, latency });
    process.exit(0);
  } catch (error) {
    console.error('\nFAILED');
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
