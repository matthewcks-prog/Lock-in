import '../chromeClient.js';

const { chromeClient } = globalThis.LockInBackground;

describe('chromeClient adapter', () => {
  test('storage get resolves data', async () => {
    const chromeMock = {
      runtime: {},
      storage: {
        sync: {
          get: (_keys, cb) => cb({ preferredLanguage: 'en' }),
          set: (_data, cb) => cb(),
          remove: (_keys, cb) => cb(),
        },
        local: {
          get: (_keys, cb) => cb({}),
          set: (_data, cb) => cb(),
          remove: (_keys, cb) => cb(),
        },
      },
      tabs: {
        sendMessage: (_tabId, _message, cb) => cb({ ok: true }),
      },
    };

    const client = chromeClient.createChromeClient(chromeMock);
    const result = await client.storage.getSync(['preferredLanguage']);
    expect(result.preferredLanguage).toBe('en');
  });

  test('storage get rejects on runtime.lastError', async () => {
    const chromeMock = {
      runtime: { lastError: null },
      storage: {
        sync: {
          get: (_keys, cb) => {
            chromeMock.runtime.lastError = { message: 'boom' };
            cb({});
            chromeMock.runtime.lastError = null;
          },
          set: (_data, cb) => cb(),
          remove: (_keys, cb) => cb(),
        },
        local: {
          get: (_keys, cb) => cb({}),
          set: (_data, cb) => cb(),
          remove: (_keys, cb) => cb(),
        },
      },
      tabs: {
        sendMessage: (_tabId, _message, cb) => cb({ ok: true }),
      },
    };

    const client = chromeClient.createChromeClient(chromeMock);
    await expect(client.storage.getSync(['preferredLanguage'])).rejects.toThrow('boom');
  });
});
