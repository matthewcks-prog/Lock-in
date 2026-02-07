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

function createRedisCircuitBreakerStore({
  url,
  keyPrefix = 'lockin:llm:circuit:',
  logger = console,
} = {}) {
  if (!url) {
    return null;
  }

  let createClient;
  try {
    ({ createClient } = require('redis'));
  } catch (error) {
    logger.warn('[CircuitBreakerStore] Redis client not available', {
      error: error?.message || error,
    });
    return null;
  }

  const client = createClient({ url });
  let connectPromise = null;

  const ensureConnected = async () => {
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

  const buildKey = (provider) => `${keyPrefix}${provider}`;

  return {
    async get(provider) {
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
    },

    async set(provider, state) {
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
    },

    async delete(provider) {
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
    },

    async clear() {
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
    },

    async disconnect() {
      try {
        if (client.isOpen) {
          await client.quit();
        }
      } catch (error) {
        logger.warn('[CircuitBreakerStore] Redis disconnect failed', {
          error: error?.message || error,
        });
      }
    },
  };
}

module.exports = {
  InMemoryCircuitBreakerStore,
  createRedisCircuitBreakerStore,
};
