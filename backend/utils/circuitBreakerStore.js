/**
 * Circuit breaker state stores
 * Provides in-memory and Redis-backed implementations.
 */

class InMemoryCircuitBreakerStore {
  constructor() {
    this._states = new Map();
  }

  async get(provider) {
    return this._states.get(provider) || null;
  }

  async set(provider, state) {
    this._states.set(provider, state);
  }

  async delete(provider) {
    this._states.delete(provider);
  }

  async clear() {
    this._states.clear();
  }
}

function tryLoadRedisCreateClient(logger) {
  try {
    return require('redis').createClient;
  } catch (error) {
    logger.warn('[CircuitBreakerStore] Redis client not available', {
      error: error?.message || error,
    });
    return null;
  }
}

function createEnsureConnected(client, logger) {
  let connectPromise = null;
  return async function ensureConnected() {
    if (client.isOpen) return;
    if (!connectPromise) {
      connectPromise = client.connect().catch((error) => {
        logger.warn('[CircuitBreakerStore] Redis connection failed', {
          error: error?.message || error,
        });
      });
    }
    await connectPromise;
  };
}

function createGetHandler({ client, ensureConnected, buildKey, logger }) {
  return async function get(provider) {
    try {
      await ensureConnected();
      if (!client.isOpen) return null;
      const raw = await client.get(buildKey(provider));
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      logger.warn('[CircuitBreakerStore] Redis get failed', {
        provider,
        error: error?.message || error,
      });
      return null;
    }
  };
}

function createSetHandler({ client, ensureConnected, buildKey, logger }) {
  return async function set(provider, state) {
    try {
      await ensureConnected();
      if (!client.isOpen) return;
      await client.set(buildKey(provider), JSON.stringify(state));
    } catch (error) {
      logger.warn('[CircuitBreakerStore] Redis set failed', {
        provider,
        error: error?.message || error,
      });
    }
  };
}

function createDeleteHandler({ client, ensureConnected, buildKey, logger }) {
  return async function deleteProvider(provider) {
    try {
      await ensureConnected();
      if (!client.isOpen) return;
      await client.del(buildKey(provider));
    } catch (error) {
      logger.warn('[CircuitBreakerStore] Redis delete failed', {
        provider,
        error: error?.message || error,
      });
    }
  };
}

function createClearHandler({ client, ensureConnected, keyPrefix, logger }) {
  return async function clear() {
    try {
      await ensureConnected();
      if (!client.isOpen) return;
      const keys = await client.keys(`${keyPrefix}*`);
      if (keys.length > 0) {
        await client.del(keys);
      }
    } catch (error) {
      logger.warn('[CircuitBreakerStore] Redis clear failed', {
        error: error?.message || error,
      });
    }
  };
}

function createDisconnectHandler({ client, logger }) {
  return async function disconnect() {
    try {
      if (client.isOpen) {
        await client.quit();
      }
    } catch (error) {
      logger.warn('[CircuitBreakerStore] Redis disconnect failed', {
        error: error?.message || error,
      });
    }
  };
}

function createRedisStore({ client, keyPrefix, ensureConnected, logger }) {
  const buildKey = (provider) => `${keyPrefix}${provider}`;
  return {
    get: createGetHandler({ client, ensureConnected, buildKey, logger }),
    set: createSetHandler({ client, ensureConnected, buildKey, logger }),
    delete: createDeleteHandler({ client, ensureConnected, buildKey, logger }),
    clear: createClearHandler({ client, ensureConnected, keyPrefix, logger }),
    disconnect: createDisconnectHandler({ client, logger }),
  };
}

function createRedisCircuitBreakerStore({
  url,
  keyPrefix = 'lockin:llm:circuit:',
  logger = console,
} = {}) {
  if (!url) {
    return null;
  }

  const createClient = tryLoadRedisCreateClient(logger);
  if (!createClient) {
    return null;
  }

  const client = createClient({ url });
  const ensureConnected = createEnsureConnected(client, logger);
  return createRedisStore({ client, keyPrefix, ensureConnected, logger });
}

module.exports = {
  InMemoryCircuitBreakerStore,
  createRedisCircuitBreakerStore,
};
