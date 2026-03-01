const { readBoolean } = require('./utils');

// Gemini Configuration (Primary chat provider)
// Model hierarchy: gemini-2.0-flash -> gemini-2.5-flash -> gemini-2.5-pro
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
const GEMINI_UPGRADED_MODEL = process.env.GEMINI_UPGRADED_MODEL || 'gemini-2.5-flash';
const GEMINI_PREMIUM_MODEL = process.env.GEMINI_PREMIUM_MODEL || 'gemini-2.5-pro';

function isGeminiEnabled() {
  return Boolean(GEMINI_API_KEY);
}

// Groq Configuration (Secondary fallback provider)
// Model hierarchy: llama-3.1-8b-instant -> llama-3.3-70b-versatile
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';
const GROQ_FALLBACK_MODEL = process.env.GROQ_FALLBACK_MODEL || 'llama-3.3-70b-versatile';

function isGroqEnabled() {
  return Boolean(GROQ_API_KEY);
}

// OpenAI Configuration (Tertiary fallback provider)
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const OPENAI_EMBEDDINGS_MODEL = process.env.OPENAI_EMBEDDINGS_MODEL || 'text-embedding-3-small';
const OPENAI_TRANSCRIPTION_MODEL = process.env.OPENAI_TRANSCRIPTION_MODEL || 'whisper-1';
const OPENAI_FALLBACK_ENABLED = readBoolean(
  process.env.OPENAI_FALLBACK_ENABLED,
  Boolean(OPENAI_API_KEY),
);

// Optional Redis-backed circuit breaker state (multi-instance deployments)
const LLM_CIRCUIT_REDIS_URL = process.env.LLM_CIRCUIT_REDIS_URL;
const LLM_CIRCUIT_REDIS_PREFIX = process.env.LLM_CIRCUIT_REDIS_PREFIX || 'lockin:llm:circuit:';
const LLM_CIRCUIT_REDIS_ENABLED = readBoolean(
  process.env.LLM_CIRCUIT_REDIS_ENABLED,
  Boolean(LLM_CIRCUIT_REDIS_URL),
);

const AZURE_OPENAI_API_KEY = process.env.AZURE_OPENAI_API_KEY;
const AZURE_OPENAI_ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT;
const AZURE_OPENAI_API_VERSION = process.env.AZURE_OPENAI_API_VERSION || '2024-02-01';
const AZURE_OPENAI_CHAT_DEPLOYMENT =
  process.env.AZURE_OPENAI_CHAT_DEPLOYMENT || process.env.AZURE_OPENAI_DEPLOYMENT;
const AZURE_OPENAI_EMBEDDINGS_DEPLOYMENT =
  process.env.AZURE_OPENAI_EMBEDDINGS_DEPLOYMENT || process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT;
const AZURE_OPENAI_TRANSCRIPTION_DEPLOYMENT = process.env.AZURE_OPENAI_TRANSCRIPTION_DEPLOYMENT;

// Azure Speech-to-Text Configuration (Primary transcription service)
const AZURE_SPEECH_API_KEY = process.env.AZURE_SPEECH_API_KEY;
const AZURE_SPEECH_REGION = process.env.AZURE_SPEECH_REGION || 'australiaeast';
const AZURE_SPEECH_LANGUAGE = process.env.AZURE_SPEECH_LANGUAGE || 'en-US';

function isAzureEnabled() {
  return Boolean(AZURE_OPENAI_API_KEY && AZURE_OPENAI_ENDPOINT);
}

function isOpenAIEnabled() {
  return Boolean(OPENAI_API_KEY);
}

function isOpenAIFallbackEnabled() {
  return OPENAI_FALLBACK_ENABLED && isOpenAIEnabled();
}

function isAzureSpeechEnabled() {
  return Boolean(AZURE_SPEECH_API_KEY && AZURE_SPEECH_REGION);
}

function isAzureEmbeddingsEnabled() {
  return Boolean(
    AZURE_OPENAI_API_KEY && AZURE_OPENAI_ENDPOINT && AZURE_OPENAI_EMBEDDINGS_DEPLOYMENT,
  );
}

function getDeployment(type, provider = isAzureEnabled() ? 'azure' : 'openai') {
  const deployments = {
    openai: {
      chat: OPENAI_MODEL,
      embeddings: OPENAI_EMBEDDINGS_MODEL,
      transcription: OPENAI_TRANSCRIPTION_MODEL,
    },
    azure: {
      chat: AZURE_OPENAI_CHAT_DEPLOYMENT || OPENAI_MODEL,
      embeddings: AZURE_OPENAI_EMBEDDINGS_DEPLOYMENT || OPENAI_EMBEDDINGS_MODEL,
      transcription: AZURE_OPENAI_TRANSCRIPTION_DEPLOYMENT || OPENAI_TRANSCRIPTION_MODEL,
    },
  };

  const providerKey = provider === 'azure' ? 'azure' : 'openai';
  const deployment = deployments[providerKey]?.[type];

  if (!deployment) {
    throw new Error(`Unknown deployment type \"${type}\" for provider \"${providerKey}\"`);
  }

  return deployment;
}

function validateAzureOpenAIConfig() {
  if (!isAzureEnabled()) {
    return;
  }

  const missing = [];
  if (!AZURE_OPENAI_CHAT_DEPLOYMENT) missing.push('AZURE_OPENAI_CHAT_DEPLOYMENT');
  if (!AZURE_OPENAI_EMBEDDINGS_DEPLOYMENT) missing.push('AZURE_OPENAI_EMBEDDINGS_DEPLOYMENT');
  if (!AZURE_OPENAI_TRANSCRIPTION_DEPLOYMENT) missing.push('AZURE_OPENAI_TRANSCRIPTION_DEPLOYMENT');

  if (missing.length > 0) {
    console.warn(
      '[config] Azure OpenAI enabled, but deployment names are missing. Defaulting to OpenAI model names:',
      missing.join(', '),
    );
  }
}

if (OPENAI_FALLBACK_ENABLED && !OPENAI_API_KEY) {
  console.warn('[config] OPENAI_FALLBACK_ENABLED is set but OPENAI_API_KEY is missing.');
}

validateAzureOpenAIConfig();

module.exports = {
  // LLM Providers - Gemini (Primary)
  GEMINI_API_KEY,
  GEMINI_MODEL,
  GEMINI_UPGRADED_MODEL,
  GEMINI_PREMIUM_MODEL,
  isGeminiEnabled,

  // LLM Providers - Groq (Secondary Fallback)
  GROQ_API_KEY,
  GROQ_MODEL,
  GROQ_FALLBACK_MODEL,
  isGroqEnabled,

  // LLM Providers - OpenAI (Fallback)
  OPENAI_API_KEY,
  OPENAI_MODEL,
  OPENAI_EMBEDDINGS_MODEL,
  OPENAI_TRANSCRIPTION_MODEL,
  OPENAI_FALLBACK_ENABLED,
  AZURE_OPENAI_API_KEY,
  AZURE_OPENAI_ENDPOINT,
  AZURE_OPENAI_API_VERSION,
  AZURE_OPENAI_CHAT_DEPLOYMENT,
  AZURE_OPENAI_EMBEDDINGS_DEPLOYMENT,
  AZURE_OPENAI_TRANSCRIPTION_DEPLOYMENT,
  isAzureEnabled,
  isOpenAIEnabled,
  isOpenAIFallbackEnabled,
  isAzureEmbeddingsEnabled,
  getDeployment,

  // Circuit breaker Redis config
  LLM_CIRCUIT_REDIS_URL,
  LLM_CIRCUIT_REDIS_PREFIX,
  LLM_CIRCUIT_REDIS_ENABLED,

  // Azure Speech Configuration
  AZURE_SPEECH_API_KEY,
  AZURE_SPEECH_REGION,
  AZURE_SPEECH_LANGUAGE,
  isAzureSpeechEnabled,
};
