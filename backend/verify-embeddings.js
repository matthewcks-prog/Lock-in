/**
 * Test Azure Embeddings Setup
 *
 * Run this to verify your Azure OpenAI embeddings configuration is working correctly.
 */

// Load environment variables
require('dotenv').config();

const { createEmbeddingsClient } = require('./providers/embeddingsFactory');
const config = require('./config');

console.log('\n🔍 Azure Embeddings Configuration Test\n');
console.log('━'.repeat(60));

console.log('\n📋 Configuration:');
console.log(`  Endpoint: ${config.AZURE_OPENAI_ENDPOINT}`);
console.log(`  Deployment: ${config.AZURE_OPENAI_EMBEDDINGS_DEPLOYMENT}`);
console.log(`  API Version: ${config.AZURE_OPENAI_API_VERSION}`);
console.log(`  Has API Key: ${Boolean(config.AZURE_OPENAI_API_KEY)}`);
console.log(`  OpenAI Fallback: ${config.OPENAI_FALLBACK_ENABLED ? 'Enabled' : 'Disabled'}`);

console.log('\n🔗 Creating embeddings client...');

try {
  const client = createEmbeddingsClient({
    azureApiKey: config.AZURE_OPENAI_API_KEY,
    azureEndpoint: config.AZURE_OPENAI_ENDPOINT,
    azureApiVersion: config.AZURE_OPENAI_API_VERSION,
    azureDeployment: config.AZURE_OPENAI_EMBEDDINGS_DEPLOYMENT,
    openaiApiKey: config.OPENAI_API_KEY,
    openaiModel: config.OPENAI_EMBEDDINGS_MODEL,
  });

  console.log('✅ Client created successfully!');

  console.log('\n🧪 Running embedding test...');

  (async () => {
    try {
      const testText = 'This is a test of the Azure OpenAI embeddings service.';
      console.log(`  Input: "${testText}"`);

      const start = Date.now();
      const result = await client.createEmbeddings(testText);
      const duration = Date.now() - start;

      console.log(`\n✅ Embedding generated successfully!`);
      console.log(`  Dimensions: ${result.embeddings[0].length}`);
      console.log(`  Duration: ${duration}ms`);
      console.log(
        `  Sample (first 5 values): [${result.embeddings[0]
          .slice(0, 5)
          .map((v) => v.toFixed(6))
          .join(', ')}...]`,
      );
      console.log(`  Model: ${result.model}`);
      console.log(`  Provider: ${result.provider}`);
      console.log(`  Tokens Used: ${result.usage.total_tokens}`);

      // Get usage stats if available
      if (client.primaryClient && typeof client.primaryClient.getStats === 'function') {
        const stats = client.primaryClient.getStats();
        console.log('\n📊 Usage Statistics:');
        console.log(`  Total Requests: ${stats.totalRequests}`);
        console.log(`  Total Tokens: ${stats.totalTokens}`);
        console.log(`  Total Embeddings: ${stats.totalEmbeddings}`);
        console.log(`  Estimated Cost: $${stats.estimatedCost.toFixed(6)}`);
        console.log(`  Errors: ${stats.errors}`);
      }

      console.log('\n━'.repeat(60));
      console.log('✅ All tests passed! Your Azure embeddings are configured correctly.\n');
      process.exit(0);
    } catch (error) {
      console.error('\n❌ Embedding test failed:');
      console.error(`  ${error.message}`);
      console.error('\n🔧 Troubleshooting steps:');
      console.error('  1. Verify your Azure OpenAI endpoint is correct');
      console.error('  2. Check that your API key is valid and not expired');
      console.error('  3. Ensure the deployment name matches exactly');
      console.error('  4. Confirm you have quota available');
      console.error('  5. Check your network/firewall settings\n');
      console.error('Full error:');
      console.error(error);
      process.exit(1);
    }
  })();
} catch (error) {
  console.error('\n❌ Failed to create embeddings client:');
  console.error(`  ${error.message}\n`);
  process.exit(1);
}
