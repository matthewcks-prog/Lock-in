/**
 * Detailed Azure Embeddings Diagnostic
 */

require('dotenv').config();

const { SIX, TEN, SIXTY } = require('../constants/numbers');
const { createAzureEmbeddingsClient } = require('../providers/azureEmbeddingsClient');
const config = require('../config');

const DIVIDER_WIDTH = SIXTY;
const API_KEY_PREVIEW_LENGTH = TEN;
const DECIMAL_PRECISION = SIX;
const DIVIDER = '-'.repeat(DIVIDER_WIDTH);
const TEST_TEXT = 'Test';

function logConfiguration() {
  console.log('\nConfiguration:');
  console.log(`  Endpoint: ${config.AZURE_OPENAI_ENDPOINT}`);
  console.log(`  Deployment: ${config.AZURE_OPENAI_EMBEDDINGS_DEPLOYMENT}`);
  console.log(`  API Version: ${config.AZURE_OPENAI_API_VERSION}`);
  console.log(`  Has API Key: ${Boolean(config.AZURE_OPENAI_API_KEY)}`);
  console.log(
    `  API Key (first 10 chars): ${config.AZURE_OPENAI_API_KEY?.substring(0, API_KEY_PREVIEW_LENGTH)}...`,
  );
}

function createClient() {
  return createAzureEmbeddingsClient(
    config.AZURE_OPENAI_API_KEY,
    config.AZURE_OPENAI_ENDPOINT,
    config.AZURE_OPENAI_API_VERSION,
    config.AZURE_OPENAI_EMBEDDINGS_DEPLOYMENT,
  );
}

function logStats(client) {
  const stats = client.getStats();
  console.log('\nStats:');
  console.log(`  Requests: ${stats.totalRequests}`);
  console.log(`  Tokens: ${stats.totalTokens}`);
  console.log(`  Cost: $${stats.estimatedCost.toFixed(DECIMAL_PRECISION)}`);
}

async function runDiagnostic(client) {
  const result = await client.createEmbeddings(TEST_TEXT);

  console.log('\nDirect Azure embedding successful');
  console.log(`  Dimensions: ${result.embeddings[0].length}`);
  console.log(`  Model: ${result.model}`);
  console.log(`  Tokens Used: ${result.usage.total_tokens}`);

  logStats(client);
}

function logFailure(error) {
  console.error('\nDirect Azure embedding failed:');
  console.error(`  Error: ${error.message}`);
  console.error(`  Name: ${error.name}`);
  console.error(`  Code: ${error.code || 'none'}`);
  console.error(`  Status: ${error.status || 'none'}`);
  console.error('\nStack trace:');
  console.error(error.stack);
}

async function main() {
  console.log('\nDetailed Azure Embeddings Diagnostic\n');
  console.log(DIVIDER);

  logConfiguration();

  console.log('\nCreating Azure embeddings client directly...');

  let client;
  try {
    client = createClient();
    console.log('Client created successfully');
  } catch (error) {
    console.error('\nFailed to create Azure client:');
    console.error(`  ${error.message}`);
    process.exit(1);
    return;
  }

  console.log('\nRunning direct embedding test...');

  try {
    await runDiagnostic(client);
    console.log(`\n${DIVIDER}`);
    console.log('Azure is configured correctly.\n');
    process.exit(0);
  } catch (error) {
    logFailure(error);
    process.exit(1);
  }
}

main();
