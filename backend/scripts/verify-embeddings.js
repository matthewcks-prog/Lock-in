/**
 * Test Azure Embeddings Setup
 *
 * Run this to verify your Azure OpenAI embeddings configuration is working correctly.
 */

require('dotenv').config();

const { FIVE, SIX, SIXTY } = require('../constants/numbers');
const { createEmbeddingsClient } = require('../providers/embeddingsFactory');
const config = require('../config');

const DIVIDER_WIDTH = SIXTY;
const EMBEDDING_SAMPLE_SIZE = FIVE;
const DECIMAL_PRECISION = SIX;
const DIVIDER = '-'.repeat(DIVIDER_WIDTH);
const TEST_TEXT = 'This is a test of the Azure OpenAI embeddings service.';

function logConfiguration() {
  console.log('\nConfiguration:');
  console.log(`  Endpoint: ${config.AZURE_OPENAI_ENDPOINT}`);
  console.log(`  Deployment: ${config.AZURE_OPENAI_EMBEDDINGS_DEPLOYMENT}`);
  console.log(`  API Version: ${config.AZURE_OPENAI_API_VERSION}`);
  console.log(`  Has API Key: ${Boolean(config.AZURE_OPENAI_API_KEY)}`);
  console.log(`  OpenAI Fallback: ${config.OPENAI_FALLBACK_ENABLED ? 'Enabled' : 'Disabled'}`);
}

function createClient() {
  return createEmbeddingsClient({
    azureApiKey: config.AZURE_OPENAI_API_KEY,
    azureEndpoint: config.AZURE_OPENAI_ENDPOINT,
    azureApiVersion: config.AZURE_OPENAI_API_VERSION,
    azureDeployment: config.AZURE_OPENAI_EMBEDDINGS_DEPLOYMENT,
    openaiApiKey: config.OPENAI_API_KEY,
    openaiModel: config.OPENAI_EMBEDDINGS_MODEL,
  });
}

function formatEmbeddingSample(values) {
  return values
    .slice(0, EMBEDDING_SAMPLE_SIZE)
    .map((value) => value.toFixed(DECIMAL_PRECISION))
    .join(', ');
}

function logUsageStats(client) {
  if (!client.primaryClient || typeof client.primaryClient.getStats !== 'function') {
    return;
  }

  const stats = client.primaryClient.getStats();
  console.log('\nUsage Statistics:');
  console.log(`  Total Requests: ${stats.totalRequests}`);
  console.log(`  Total Tokens: ${stats.totalTokens}`);
  console.log(`  Total Embeddings: ${stats.totalEmbeddings}`);
  console.log(`  Estimated Cost: $${stats.estimatedCost.toFixed(DECIMAL_PRECISION)}`);
  console.log(`  Errors: ${stats.errors}`);
}

function logTroubleshooting() {
  console.error('\nTroubleshooting steps:');
  console.error('  1. Verify your Azure OpenAI endpoint is correct');
  console.error('  2. Check that your API key is valid and not expired');
  console.error('  3. Ensure the deployment name matches exactly');
  console.error('  4. Confirm you have quota available');
  console.error('  5. Check your network/firewall settings');
}

async function runEmbeddingTest(client) {
  console.log('\nRunning embedding test...');
  console.log(`  Input: "${TEST_TEXT}"`);

  const start = Date.now();
  const result = await client.createEmbeddings(TEST_TEXT);
  const duration = Date.now() - start;

  console.log('\nEmbedding generated successfully');
  console.log(`  Dimensions: ${result.embeddings[0].length}`);
  console.log(`  Duration: ${duration}ms`);
  console.log(`  Sample (first 5 values): [${formatEmbeddingSample(result.embeddings[0])}...]`);
  console.log(`  Model: ${result.model}`);
  console.log(`  Provider: ${result.provider}`);
  console.log(`  Tokens Used: ${result.usage.total_tokens}`);

  logUsageStats(client);
}

function logHeader() {
  console.log('\nAzure Embeddings Configuration Test\n');
  console.log(DIVIDER);
  logConfiguration();
}

function createClientOrExit() {
  console.log('\nCreating embeddings client...');
  try {
    const client = createClient();
    console.log('Client created successfully');
    return client;
  } catch (error) {
    console.error('\nFailed to create embeddings client:');
    console.error(`  ${error.message}`);
    process.exit(1);
    return null;
  }
}

async function runTestAndExit(client) {
  try {
    await runEmbeddingTest(client);
    console.log(`\n${DIVIDER}`);
    console.log('All tests passed. Azure embeddings are configured correctly.\n');
    process.exit(0);
  } catch (error) {
    console.error('\nEmbedding test failed:');
    console.error(`  ${error.message}`);
    logTroubleshooting();
    console.error('\nFull error:');
    console.error(error);
    process.exit(1);
  }
}

async function main() {
  logHeader();
  const client = createClientOrExit();
  if (!client) return;
  await runTestAndExit(client);
}

main();
