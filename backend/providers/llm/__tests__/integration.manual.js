/**
 * Quick integration test for LLM provider chain
 * Run: node providers/llm/__tests__/integration.test.js
 */

require('dotenv').config();
const { createChatProviderChain, getPrimaryProvider, getAvailableProviders } = require('../index');

async function main() {
  console.log('=== LLM Provider Integration Test ===\n');

  // 1. Check configuration
  console.log('Available providers:', getAvailableProviders());
  console.log('Primary provider:', getPrimaryProvider());
  console.log('');

  // 2. Test chat completion
  try {
    const chain = createChatProviderChain();

    console.log('Sending test request to primary provider...');
    const startTime = Date.now();

    const result = await chain.chatCompletion(
      [
        { role: 'system', content: 'You are a helpful assistant. Respond very briefly.' },
        { role: 'user', content: 'Say "Hello from Lock-in!" in exactly 5 words.' },
      ],
      {
        temperature: 0.7,
        maxTokens: 20,
        operation: 'integration-test',
      },
    );

    const latency = Date.now() - startTime;

    console.log('\n✅ SUCCESS');
    console.log('Provider:', result.provider);
    console.log('Model:', result.model);
    console.log('Response:', result.content);
    console.log('Usage:', result.usage);
    console.log('Latency:', latency + 'ms');
    console.log('Fallback used:', result.fallbackUsed || false);

    process.exit(0);
  } catch (error) {
    console.error('\n❌ FAILED');
    console.error('Error:', error.message);
    if (error.errors) {
      console.error('All errors:', error.errors);
    }
    process.exit(1);
  }
}

main();
