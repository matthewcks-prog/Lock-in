/**
 * Detailed Azure Embeddings Diagnostic
 */

require('dotenv').config();

const { createAzureEmbeddingsClient } = require('../providers/azureEmbeddingsClient');
const config = require('../config');

console.log('\n🔍 Detailed Azure Embeddings Diagnostic\n');
console.log('━'.repeat(60));

console.log('\n📋 Configuration:');
console.log(`  Endpoint: ${config.AZURE_OPENAI_ENDPOINT}`);
console.log(`  Deployment: ${config.AZURE_OPENAI_EMBEDDINGS_DEPLOYMENT}`);
console.log(`  API Version: ${config.AZURE_OPENAI_API_VERSION}`);
console.log(`  Has API Key: ${Boolean(config.AZURE_OPENAI_API_KEY)}`);
console.log(`  API Key (first 10 chars): ${config.AZURE_OPENAI_API_KEY?.substring(0, 10)}...`);

console.log('\n🔗 Creating Azure embeddings client directly...');

try {
  const client = createAzureEmbeddingsClient(
    config.AZURE_OPENAI_API_KEY,
    config.AZURE_OPENAI_ENDPOINT,
    config.AZURE_OPENAI_API_VERSION,
    config.AZURE_OPENAI_EMBEDDINGS_DEPLOYMENT,
  );

  console.log('✅ Client created successfully!');

  console.log('\n🧪 Running direct embedding test...');

  (async () => {
    try {
      const testText = 'Test';
      const result = await client.createEmbeddings(testText);

      console.log(`\n✅ Direct Azure embedding successful!`);
      console.log(`  Dimensions: ${result.embeddings[0].length}`);
      console.log(`  Model: ${result.model}`);
      console.log(`  Tokens Used: ${result.usage.total_tokens}`);

      const stats = client.getStats();
      console.log('\n📊 Stats:');
      console.log(`  Requests: ${stats.totalRequests}`);
      console.log(`  Tokens: ${stats.totalTokens}`);
      console.log(`  Cost: $${stats.estimatedCost.toFixed(6)}`);

      console.log('\n━'.repeat(60));
      console.log('✅ Azure is configured correctly!\n');
      process.exit(0);
    } catch (error) {
      console.error('\n❌ Direct Azure embedding failed:');
      console.error(`  Error: ${error.message}`);
      console.error(`  Name: ${error.name}`);
      console.error(`  Code: ${error.code || 'none'}`);
      console.error(`  Status: ${error.status || 'none'}`);
      console.error('\n📍 Stack trace:');
      console.error(error.stack);
      process.exit(1);
    }
  })();
} catch (error) {
  console.error('\n❌ Failed to create Azure client:');
  console.error(`  ${error.message}\n`);
  process.exit(1);
}
