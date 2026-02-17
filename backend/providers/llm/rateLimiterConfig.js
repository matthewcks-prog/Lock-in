const Bottleneck = require('bottleneck');

const RATE_LIMITER_CONSTANTS = {
  queueWarningThreshold: 5,
  usageLogIntervalMs: 300000,
  uptimeMinuteMs: 60000,
  defaultPriority: 5,
  defaultQueueTimeoutMs: 30000,
  queueFullRetryAfterSeconds: 5,
  queueTimeoutRetryAfterSeconds: 10,
  eventLoopDrainIterations: 5,
  costPrecisionScale: 1000000,
  pausedReservoir: 0,
  unknownDroppedJobId: 'unknown',
  droppedJobMessage: 'This job has been dropped',
  timedOutJobMessage: 'This job timed out',
};

const DEFAULT_LIMITS = {
  gemini: {
    reservoir: 200,
    reservoirRefreshAmount: 200,
    reservoirRefreshInterval: 60000,
    maxConcurrent: 10,
    minTime: 50,
    highWater: 30,
    strategy: Bottleneck.strategy.OVERFLOW,
  },
  groq: {
    reservoir: 30,
    reservoirRefreshAmount: 30,
    reservoirRefreshInterval: 60000,
    maxConcurrent: 3,
    minTime: 200,
    highWater: 10,
    strategy: Bottleneck.strategy.OVERFLOW,
  },
  openai: {
    reservoir: 50,
    reservoirRefreshAmount: 50,
    reservoirRefreshInterval: 60000,
    maxConcurrent: 5,
    minTime: 150,
    highWater: 15,
    strategy: Bottleneck.strategy.OVERFLOW,
  },
};

const TEST_LIMITS = {
  gemini: {
    reservoir: 1000,
    reservoirRefreshAmount: null,
    reservoirRefreshInterval: null,
    maxConcurrent: 100,
    minTime: 0,
    highWater: 100,
    strategy: Bottleneck.strategy.OVERFLOW,
  },
  groq: {
    reservoir: 1000,
    reservoirRefreshAmount: null,
    reservoirRefreshInterval: null,
    maxConcurrent: 100,
    minTime: 0,
    highWater: 100,
    strategy: Bottleneck.strategy.OVERFLOW,
  },
  openai: {
    reservoir: 1000,
    reservoirRefreshAmount: null,
    reservoirRefreshInterval: null,
    maxConcurrent: 100,
    minTime: 0,
    highWater: 100,
    strategy: Bottleneck.strategy.OVERFLOW,
  },
};

const TOKEN_COSTS = {
  gemini: {
    'gemini-2.0-flash': { input: 0.0000001, output: 0.0000004 },
    'gemini-2.5-flash': { input: 0.00000015, output: 0.0000006 },
    'gemini-2.5-pro': { input: 0.00000125, output: 0.000005 },
    default: { input: 0.0000001, output: 0.0000004 },
  },
  groq: {
    'llama-3.3-70b-versatile': { input: 0.00000059, output: 0.00000079 },
    'llama-3.1-8b-instant': { input: 0.00000005, output: 0.00000008 },
    default: { input: 0.00000059, output: 0.00000079 },
  },
  openai: {
    'gpt-4o-mini': { input: 0.00000015, output: 0.0000006 },
    'gpt-4o': { input: 0.0000025, output: 0.00001 },
    default: { input: 0.00000015, output: 0.0000006 },
  },
};

module.exports = {
  RATE_LIMITER_CONSTANTS,
  DEFAULT_LIMITS,
  TEST_LIMITS,
  TOKEN_COSTS,
};
