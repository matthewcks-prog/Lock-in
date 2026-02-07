const { supabase } = require('../db/supabaseClient');

const DEFAULT_TTL_MS = 2 * 60 * 1000;
const DEFAULT_WAIT_MS = 5 * 1000;
const DEFAULT_POLL_INTERVAL_MS = 250;

function createIdempotencyConflictError(message) {
  const error = new Error(message);
  error.status = 409;
  error.payload = {
    success: false,
    error: { message },
  };
  return error;
}

function createIdempotencyStore(options = {}) {
  const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
  const waitMs = options.waitMs ?? DEFAULT_WAIT_MS;
  const pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;

  async function cleanupExpired(userId, nowIso) {
    if (!userId) return;
    const { error } = await supabase
      .from('idempotency_keys')
      .delete()
      .eq('user_id', userId)
      .lt('expires_at', nowIso);
    if (error) {
      throw error;
    }
  }

  async function getEntry(key, userId) {
    if (!key || !userId) return null;
    const { data, error } = await supabase
      .from('idempotency_keys')
      .select('*')
      .eq('idempotency_key', key)
      .eq('user_id', userId)
      .limit(1);

    if (error) {
      throw error;
    }

    return Array.isArray(data) && data.length > 0 ? data[0] : null;
  }

  async function insertEntry(key, userId, nowIso, expiresAt) {
    const payload = {
      idempotency_key: key,
      user_id: userId,
      status: 'in_progress',
      created_at: nowIso,
      updated_at: nowIso,
      expires_at: expiresAt,
    };

    const { data, error } = await supabase
      .from('idempotency_keys')
      .insert(payload)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return { inserted: false, entry: null };
      }
      throw error;
    }

    return { inserted: true, entry: data };
  }

  async function updateEntry(key, userId, updates) {
    const payload = {
      ...updates,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('idempotency_keys')
      .update(payload)
      .eq('idempotency_key', key)
      .eq('user_id', userId);

    if (error) {
      throw error;
    }
  }

  async function deleteEntry(key, userId) {
    if (!key || !userId) return;
    const { error } = await supabase
      .from('idempotency_keys')
      .delete()
      .eq('idempotency_key', key)
      .eq('user_id', userId);

    if (error) {
      throw error;
    }
  }

  async function waitForCompletion(key, userId) {
    const start = Date.now();
    const deadline = start + waitMs;

    while (Date.now() < deadline) {
      const entry = await getEntry(key, userId);
      if (!entry) return null;
      if (entry.status === 'completed' && entry.response) {
        return entry.response;
      }
      if (entry.expires_at && new Date(entry.expires_at).getTime() <= Date.now()) {
        await deleteEntry(key, userId);
        return null;
      }
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }

    throw createIdempotencyConflictError('Request is already in progress. Please retry shortly.');
  }

  async function run(key, userId, task) {
    if (!key || !userId) {
      return task();
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const expiresAt = new Date(now.getTime() + ttlMs).toISOString();

    await cleanupExpired(userId, nowIso);

    const insertResult = await insertEntry(key, userId, nowIso, expiresAt);

    if (!insertResult.inserted) {
      const existing = await getEntry(key, userId);
      if (existing?.expires_at && new Date(existing.expires_at).getTime() <= Date.now()) {
        await deleteEntry(key, userId);
        return run(key, userId, task);
      }

      if (existing?.status === 'completed' && existing.response) {
        return existing.response;
      }

      return waitForCompletion(key, userId);
    }

    try {
      const response = await task();
      await updateEntry(key, userId, { status: 'completed', response });
      return response;
    } catch (error) {
      await deleteEntry(key, userId);
      throw error;
    }
  }

  return {
    run,
    getEntry,
    begin: async (key, userId) => {
      if (!key || !userId) {
        return { status: 'disabled' };
      }

      const now = new Date();
      const nowIso = now.toISOString();
      const expiresAt = new Date(now.getTime() + ttlMs).toISOString();

      await cleanupExpired(userId, nowIso);

      const insertResult = await insertEntry(key, userId, nowIso, expiresAt);
      if (insertResult.inserted) {
        return { status: 'new' };
      }

      const existing = await getEntry(key, userId);
      if (existing?.expires_at && new Date(existing.expires_at).getTime() <= Date.now()) {
        await deleteEntry(key, userId);
        return { status: 'retry' };
      }

      if (existing?.status === 'completed' && existing.response) {
        return { status: 'completed', response: existing.response };
      }

      return { status: 'in_progress' };
    },
    complete: async (key, userId, response) => {
      if (!key || !userId) return;
      await updateEntry(key, userId, { status: 'completed', response });
    },
    fail: async (key, userId) => {
      await deleteEntry(key, userId);
    },
  };
}

module.exports = {
  createIdempotencyStore,
};
