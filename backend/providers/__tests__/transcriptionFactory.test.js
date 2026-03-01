const { test, describe } = require('node:test');
const assert = require('node:assert');
const { TranscriptionClient, TranscriptionProvider } = require('../transcriptionFactory');
const { CircuitBreaker } = require('../../utils/circuitBreaker');
const { ONE, SIXTY, THOUSAND } = require('../../constants/numbers');

describe('TranscriptionClient circuit breaker', () => {
  test('skips primary when circuit is open and uses fallback', async () => {
    let primaryCalls = 0;
    const primaryClient = {
      transcribe: async () => {
        primaryCalls += 1;
        throw new Error('quota exceeded');
      },
    };
    const fallbackClient = {
      audio: {
        transcriptions: {
          create: async () => ({ text: 'ok', duration: 1 }),
        },
      },
    };

    const breaker = new CircuitBreaker({
      failureThreshold: ONE,
      openDurationMs: SIXTY * THOUSAND,
    });
    const client = new TranscriptionClient({
      primary: {
        client: primaryClient,
        provider: TranscriptionProvider.AZURE_SPEECH,
      },
      fallback: {
        client: fallbackClient,
        provider: TranscriptionProvider.OPENAI_WHISPER,
      },
      circuitBreaker: breaker,
    });

    const first = await client.transcribe(Buffer.from('audio'), { language: 'en', format: 'wav' });
    assert.equal(first.provider, TranscriptionProvider.OPENAI_WHISPER);
    assert.equal(first.fallbackUsed, true);
    assert.equal(primaryCalls, 1);

    const second = await client.transcribe(Buffer.from('audio'), { language: 'en', format: 'wav' });
    assert.equal(second.provider, TranscriptionProvider.OPENAI_WHISPER);
    assert.equal(second.fallbackUsed, true);
    assert.equal(primaryCalls, 1, 'Primary should be skipped while circuit is open');
  });
});
