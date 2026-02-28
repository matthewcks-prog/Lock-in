const { DAILY_REQUEST_LIMIT } = require('../../config');
const { logger: baseLogger } = require('../../observability');
const { checkDailyLimit } = require('../rateLimitService');
const { createChatCompletion } = require('../llm/providerChain');
const {
  resolveStudyGuideDepth,
  buildStudyGuidePrompt,
  buildStudyGuideChunkDigestPrompt,
} = require('../../config/prompts');
const {
  buildTranscriptLines,
  joinTranscriptLines,
  splitTranscriptLines,
} = require('./transcriptPromptSource');

const HTTP_STATUS_INTERNAL_SERVER_ERROR = 500;
const HTTP_STATUS_TOO_MANY_REQUESTS = 429;
const SUMMARY_DIRECT_CHAR_LIMIT = 90000;
const SUMMARY_CHUNK_TARGET_CHARS = 32000;
const SUMMARY_MAX_CHUNKS = 8;
const SUMMARY_TIMEOUT_MS = 120000;
const SUMMARY_TEMPERATURE = 0.25;
const CHUNK_DIGEST_TEMPERATURE = 0.2;
const CHUNK_DIGEST_MAX_TOKENS = 1000;

const SUMMARY_MAX_TOKENS_BY_DEPTH = {
  brief: 1100,
  standard: 1700,
  detailed: 2400,
};

function createRequestError(status, message) {
  const error = new Error(message);
  error.status = status;
  error.payload = {
    success: false,
    error: { message },
  };
  return error;
}

function createServices(deps = {}) {
  return {
    logger: deps.logger ?? baseLogger,
    llmClient: deps.llmClient ?? { createChatCompletion },
    rateLimitService: deps.rateLimitService ?? { checkDailyLimit },
  };
}

function withTimeout(promise, timeoutMs, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`${label} timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    }),
  ]);
}

function ensureUserContext(userId) {
  if (!userId) {
    throw createRequestError(
      HTTP_STATUS_INTERNAL_SERVER_ERROR,
      'User context missing for authenticated request.',
    );
  }
}

async function ensureDailyLimitAllowed(services, userId) {
  const limitCheck = await services.rateLimitService.checkDailyLimit(userId, DAILY_REQUEST_LIMIT);
  if (!limitCheck.allowed) {
    throw createRequestError(HTTP_STATUS_TOO_MANY_REQUESTS, 'Daily limit reached');
  }
}

function ensureTranscriptLines(transcript) {
  const lines = buildTranscriptLines(transcript?.segments ?? []);
  if (lines.length === 0) {
    throw createRequestError(
      HTTP_STATUS_INTERNAL_SERVER_ERROR,
      'Transcript does not contain usable segments.',
    );
  }
  const body = joinTranscriptLines(lines);
  return {
    lines,
    body,
    charCount: body.length,
  };
}

function buildChunkBodies({ lines, charCount }) {
  const initialChunks = splitTranscriptLines(lines, SUMMARY_CHUNK_TARGET_CHARS);
  if (initialChunks.length <= SUMMARY_MAX_CHUNKS) {
    return initialChunks;
  }
  const scaledTarget = Math.ceil(charCount / SUMMARY_MAX_CHUNKS);
  const scaledChunks = splitTranscriptLines(lines, scaledTarget);
  if (scaledChunks.length <= SUMMARY_MAX_CHUNKS) {
    return scaledChunks;
  }
  const head = scaledChunks.slice(0, SUMMARY_MAX_CHUNKS - 1);
  head.push(scaledChunks.slice(SUMMARY_MAX_CHUNKS - 1).join('\n'));
  return head;
}

async function generateChunkDigest({
  services,
  depth,
  lectureTitle,
  chunkBody,
  chunkIndex,
  chunkCount,
}) {
  const prompt = buildStudyGuideChunkDigestPrompt({
    depth,
    chunkIndex,
    chunkCount,
    chunkBody,
    lectureTitle,
  });

  const completion = await withTimeout(
    services.llmClient.createChatCompletion({
      messages: [
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user },
      ],
      temperature: CHUNK_DIGEST_TEMPERATURE,
      maxTokens: CHUNK_DIGEST_MAX_TOKENS,
      operation: `study.summary.chunk.${chunkIndex + 1}`,
    }),
    SUMMARY_TIMEOUT_MS,
    `Chunk digest ${chunkIndex + 1}`,
  );

  const content = completion?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || content.trim().length === 0) {
    throw new Error(`No digest content returned for chunk ${chunkIndex + 1}`);
  }

  return `## Chunk ${chunkIndex + 1}\n${content.trim()}`;
}

async function buildChunkDigestTranscriptSource({
  services,
  depth,
  lectureTitle,
  transcriptLines,
  transcriptCharCount,
}) {
  const chunkBodies = buildChunkBodies({ lines: transcriptLines, charCount: transcriptCharCount });
  const digests = [];

  for (let chunkIndex = 0; chunkIndex < chunkBodies.length; chunkIndex += 1) {
    const digest = await generateChunkDigest({
      services,
      depth,
      lectureTitle,
      chunkBody: chunkBodies[chunkIndex],
      chunkIndex,
      chunkCount: chunkBodies.length,
    });
    digests.push(digest);
  }

  return {
    body: [
      'The original transcript was chunked for context safety. Use these chunk digests as source.',
      ...digests,
    ].join('\n\n'),
    chunkCount: chunkBodies.length,
    chunked: true,
  };
}

async function resolvePromptSource({ services, payload, depth, transcriptSource }) {
  if (transcriptSource.charCount <= SUMMARY_DIRECT_CHAR_LIMIT) {
    return { body: transcriptSource.body, chunkCount: 1, chunked: false };
  }

  return buildChunkDigestTranscriptSource({
    services,
    depth,
    lectureTitle: payload?.lectureTitle,
    transcriptLines: transcriptSource.lines,
    transcriptCharCount: transcriptSource.charCount,
  });
}

function buildFinalPrompt({ payload, depth, transcriptBody }) {
  return buildStudyGuidePrompt({
    depth,
    transcriptBody,
    courseName: payload?.courseName,
    lectureTitle: payload?.lectureTitle,
    weekTopic: payload?.weekTopic,
    goal: payload?.goal,
    examFocusAreas: payload?.examFocusAreas,
    includeJson: payload?.includeJson === true,
  });
}

async function generateFinalSummary({ services, depth, finalPrompt }) {
  const completion = await withTimeout(
    services.llmClient.createChatCompletion({
      messages: [
        { role: 'system', content: finalPrompt.system },
        { role: 'user', content: finalPrompt.user },
      ],
      temperature: SUMMARY_TEMPERATURE,
      maxTokens: SUMMARY_MAX_TOKENS_BY_DEPTH[depth],
      operation: 'study.summary.generate',
    }),
    SUMMARY_TIMEOUT_MS,
    'Study summary generation',
  );

  const markdown = completion?.choices?.[0]?.message?.content;
  if (typeof markdown !== 'string' || markdown.trim().length === 0) {
    throw new Error('No study summary content returned from model');
  }
  return markdown.trim();
}

async function createStudySummary(services, payload) {
  const depth = resolveStudyGuideDepth(payload?.depth);
  const transcriptSource = ensureTranscriptLines(payload?.transcript);
  const sourceForPrompt = await resolvePromptSource({ services, payload, depth, transcriptSource });
  const finalPrompt = buildFinalPrompt({
    payload,
    depth,
    transcriptBody: sourceForPrompt.body,
  });
  const markdown = await generateFinalSummary({ services, depth, finalPrompt });

  return {
    markdown,
    depth,
    chunked: sourceForPrompt.chunked,
    chunkCount: sourceForPrompt.chunkCount,
  };
}

async function generateStudySummary(services, { userId, payload } = {}) {
  ensureUserContext(userId);
  await ensureDailyLimitAllowed(services, userId);

  try {
    const result = await createStudySummary(services, payload);
    return {
      success: true,
      data: result,
    };
  } catch (error) {
    services.logger.error({ err: error }, 'Failed to generate study summary');
    throw createRequestError(
      HTTP_STATUS_INTERNAL_SERVER_ERROR,
      error?.message || 'Failed to generate study summary.',
    );
  }
}

function createSummaryService(deps = {}) {
  const services = createServices(deps);

  return {
    generateStudySummary: (params) => generateStudySummary(services, params),
  };
}

const summaryService = createSummaryService();

module.exports = {
  createSummaryService,
  summaryService,
};
