const DEFAULT_TTL_MS = 2 * 60 * 1000;
const DEFAULT_MAX_ENTRIES = 500;

function createIdempotencyStore(options = {}) {
  const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
  const maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES;
  const entries = new Map();

  function cleanup(now = Date.now()) {
    for (const [key, entry] of entries.entries()) {
      if (entry.expiresAt <= now) {
        entries.delete(key);
      }
    }

    if (entries.size <= maxEntries) return;
    const keys = Array.from(entries.keys());
    const excess = entries.size - maxEntries;
    for (let i = 0; i < excess; i += 1) {
      entries.delete(keys[i]);
    }
  }

  function setEntry(key, value) {
    const now = Date.now();
    entries.set(key, {
      ...value,
      expiresAt: now + ttlMs,
    });
    cleanup(now);
  }

  function getEntry(key) {
    if (!key) return null;
    const entry = entries.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
      entries.delete(key);
      return null;
    }
    return entry;
  }

  async function run(key, task) {
    if (!key) {
      return task();
    }

    const existing = getEntry(key);
    if (existing?.response) {
      return existing.response;
    }
    if (existing?.promise) {
      return existing.promise;
    }

    const promise = (async () => {
      try {
        const response = await task();
        setEntry(key, { response });
        return response;
      } catch (error) {
        entries.delete(key);
        throw error;
      }
    })();

    setEntry(key, { promise });
    return promise;
  }

  return {
    run,
    getEntry,
  };
}

module.exports = {
  createIdempotencyStore,
};
