import '../router.js';
import '../responder.js';
import '../logging.js';

const { router, responder, logging } = globalThis.LockInBackground;

describe('background message router', () => {
  const respond = responder.createResponder(null);
  const log = logging.createLogger({ prefix: '[RouterTest]', silent: true });

  test('returns error for unknown message type', async () => {
    const handleMessage = router.createMessageRouter({
      handlers: {},
      validators: {},
      getMessageType: (message) => message?.type,
      respond,
      log,
    });

    const result = await handleMessage({ type: 'UNKNOWN' }, {});
    expect(result).toEqual({ error: 'Unknown message type: UNKNOWN' });
  });

  test('dispatches handler with payload', async () => {
    const handlers = {
      PING: async ({ payload, respond: responderInstance }) =>
        responderInstance.success({ ok: payload.ok }),
    };
    const validators = {
      PING: (message) => ({ ok: true, payload: message.payload }),
    };

    const handleMessage = router.createMessageRouter({
      handlers,
      validators,
      getMessageType: (message) => message?.type,
      respond,
      log,
    });

    const result = await handleMessage({ type: 'PING', payload: { ok: true } }, {});
    expect(result).toEqual({ ok: true });
  });

  test('handler errors use error response', async () => {
    const handlers = {
      FAIL: async () => {
        throw new Error('boom');
      },
    };

    const handleMessage = router.createMessageRouter({
      handlers,
      validators: {},
      getMessageType: (message) => message?.type,
      respond,
      log,
    });

    const result = await handleMessage({ type: 'FAIL' }, {});
    expect(result).toEqual({ error: 'boom' });
  });
});
