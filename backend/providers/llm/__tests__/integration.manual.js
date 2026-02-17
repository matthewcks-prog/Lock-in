/**
 * Quick integration test for LLM provider chain
 * Run: node providers/llm/__tests__/integration.test.js
 */

require('dotenv').config();
const { createChatProviderChain, getPrimaryProvider, getAvailableProviders } = require('../index');

function getTestMessages() {
  return [
    { role: 'system', content: 'You are a helpful assistant. Respond very briefly.' },
    { role: 'user', content: 'Say "Hello from Lock-in!" in exactly 5 words.' },
  ];
}

function logConfiguration() {
  console.log('Available providers:', getAvailableProviders());
  console.log('Primary provider:', getPrimaryProvider());
  console.log('');
}

function logSuccess({ result, latency }) {
  console.log('\nSUCCESS');
  console.log('Provider:', result.provider);
  console.log('Model:', result.model);
  console.log('Response:', result.content);
  console.log('Usage:', result.usage);
  console.log('Latency:', latency + 'ms');
  console.log('Fallback used:', result.fallbackUsed || false);
}

function logFailure(error) {
  console.error('\nFAILED');
  console.error('Error:', error.message);
  if (error.errors) {
    console.error('All errors:', error.errors);
  }
}

async function runChainTest() {
  const chain = createChatProviderChain();
  console.log('Sending test request to primary provider...');
  const startTime = Date.now();
  const result = await chain.chatCompletion(getTestMessages(), {
    temperature: 0.7,
    maxTokens: 20,
    operation: 'integration-test',
  });
  return { result, latency: Date.now() - startTime };
}

async function main() {
  console.log('=== LLM Provider Integration Test ===\n');
  logConfiguration();

  try {
    const { result, latency } = await runChainTest();
    logSuccess({ result, latency });
    process.exit(0);
  } catch (error) {
    logFailure(error);
    process.exit(1);
  }
}

main();
