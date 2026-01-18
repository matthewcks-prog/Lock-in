const OpenAI = require('openai');
const { AzureOpenAI } = require('openai');
const {
  AZURE_OPENAI_API_KEY,
  AZURE_OPENAI_API_VERSION,
  AZURE_OPENAI_ENDPOINT,
  OPENAI_API_KEY,
  isAzureEnabled,
  isOpenAIFallbackEnabled,
} = require('../config');

let cachedPrimaryClient;
let cachedFallbackClient;

function createOpenAIClient() {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is required to use the OpenAI client.');
  }

  return new OpenAI({ apiKey: OPENAI_API_KEY });
}

function createAzureClient() {
  if (!AZURE_OPENAI_API_KEY || !AZURE_OPENAI_ENDPOINT) {
    throw new Error('AZURE_OPENAI_API_KEY and AZURE_OPENAI_ENDPOINT are required for Azure OpenAI.');
  }

  return new AzureOpenAI({
    apiKey: AZURE_OPENAI_API_KEY,
    apiVersion: AZURE_OPENAI_API_VERSION,
    endpoint: AZURE_OPENAI_ENDPOINT,
  });
}

function createPrimaryClient() {
  if (cachedPrimaryClient) {
    return cachedPrimaryClient;
  }

  if (isAzureEnabled()) {
    cachedPrimaryClient = { provider: 'azure', client: createAzureClient() };
  } else {
    cachedPrimaryClient = { provider: 'openai', client: createOpenAIClient() };
  }

  return cachedPrimaryClient;
}

function createFallbackClient() {
  if (cachedFallbackClient !== undefined) {
    return cachedFallbackClient;
  }

  if (!isAzureEnabled() || !isOpenAIFallbackEnabled()) {
    cachedFallbackClient = null;
    return cachedFallbackClient;
  }

  cachedFallbackClient = { provider: 'openai', client: createOpenAIClient() };
  return cachedFallbackClient;
}

module.exports = {
  createPrimaryClient,
  createFallbackClient,
};
