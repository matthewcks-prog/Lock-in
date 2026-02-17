const { TWO, FOUR, FIVE, SIXTY, THOUSAND } = require('../constants/numbers');
const { supabase } = require('../db/supabaseClient');

const DEFAULT_TTL_MS = TWO * SIXTY * THOUSAND;
const DEFAULT_WAIT_MS = FIVE * THOUSAND;
const DEFAULT_POLL_INTERVAL_MS = THOUSAND / FOUR;
const CONFLICT_STATUS_CODE = 409;
const DUPLICATE_KEY_ERROR_CODE = '23505';

function createIdempotencyConflictError(message) {
  const error = new Error(message);
  error.status = CONFLICT_STATUS_CODE;
  error.payload = {
    success: false,
    error: { message },
  };
  return error;
}

function resolveStoreConfig(options = {}) {
  return {
    client: options.client ?? supabase,
    ttlMs: options.ttlMs ?? DEFAULT_TTL_MS,
    waitMs: options.waitMs ?? DEFAULT_WAIT_MS,
    pollIntervalMs: options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS,
  };
}

function buildEntryWindow(ttlMs) {
  const now = new Date();
  return {
    nowIso: now.toISOString(),
    expiresAt: new Date(now.getTime() + ttlMs).toISOString(),
  };
}

function isEntryExpired(entry, nowMs = Date.now()) {
  if (!entry?.expires_at) return false;
  return new Date(entry.expires_at).getTime() <= nowMs;
}

function hasCompletedResponse(entry) {
  return entry?.status === 'completed' && Boolean(entry.response);
}

function pause(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function cleanupExpired(client, userId, nowIso) {
  if (!userId) return;
  const { error } = await client
    .from('idempotency_keys')
    .delete()
    .eq('user_id', userId)
    .lt('expires_at', nowIso);
  if (error) {
    throw error;
  }
}

async function getEntry(client, key, userId) {
  if (!key || !userId) return null;

  const { data, error } = await client
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

async function insertEntry({ client, key, userId, nowIso, expiresAt }) {
  const payload = {
    idempotency_key: key,
    user_id: userId,
    status: 'in_progress',
    created_at: nowIso,
    updated_at: nowIso,
    expires_at: expiresAt,
  };

  const { data, error } = await client.from('idempotency_keys').insert(payload).select().single();

  if (error) {
    if (error.code === DUPLICATE_KEY_ERROR_CODE) {
      return { inserted: false, entry: null };
    }
    throw error;
  }

  return { inserted: true, entry: data };
}

async function updateEntry(client, key, userId, updates) {
  const payload = {
    ...updates,
    updated_at: new Date().toISOString(),
  };

  const { error } = await client
    .from('idempotency_keys')
    .update(payload)
    .eq('idempotency_key', key)
    .eq('user_id', userId);

  if (error) {
    throw error;
  }
}

async function deleteEntry(client, key, userId) {
  if (!key || !userId) return;

  const { error } = await client
    .from('idempotency_keys')
    .delete()
    .eq('idempotency_key', key)
    .eq('user_id', userId);

  if (error) {
    throw error;
  }
}

async function waitForCompletion({ client, key, userId, waitMs, pollIntervalMs }) {
  const deadline = Date.now() + waitMs;

  while (Date.now() < deadline) {
    const entry = await getEntry(client, key, userId);
    if (!entry) return null;
    if (hasCompletedResponse(entry)) {
      return entry.response;
    }
    if (isEntryExpired(entry)) {
      await deleteEntry(client, key, userId);
      return null;
    }
    await pause(pollIntervalMs);
  }

  throw createIdempotencyConflictError('Request is already in progress. Please retry shortly.');
}

async function executeTaskAndPersist({ client, key, userId, task }) {
  try {
    const response = await task();
    await updateEntry(client, key, userId, { status: 'completed', response });
    return response;
  } catch (error) {
    await deleteEntry(client, key, userId);
    throw error;
  }
}

async function resolveExistingRunEntry({ client, key, userId }) {
  const existing = await getEntry(client, key, userId);
  if (isEntryExpired(existing)) {
    await deleteEntry(client, key, userId);
    return { action: 'retry' };
  }
  if (hasCompletedResponse(existing)) {
    return { action: 'completed', response: existing.response };
  }
  return { action: 'wait' };
}

async function runWithIdempotency({ key, userId, task, config }) {
  if (!key || !userId) {
    return task();
  }

  const { client, ttlMs, waitMs, pollIntervalMs } = config;
  const { nowIso, expiresAt } = buildEntryWindow(ttlMs);

  await cleanupExpired(client, userId, nowIso);
  const insertResult = await insertEntry({ client, key, userId, nowIso, expiresAt });

  if (insertResult.inserted) {
    return executeTaskAndPersist({ client, key, userId, task });
  }

  const existing = await resolveExistingRunEntry({ client, key, userId });
  if (existing.action === 'retry') {
    return runWithIdempotency({ key, userId, task, config });
  }
  if (existing.action === 'completed') {
    return existing.response;
  }

  return waitForCompletion({ client, key, userId, waitMs, pollIntervalMs });
}

async function beginWithIdempotency({ key, userId, config }) {
  if (!key || !userId) {
    return { status: 'disabled' };
  }

  const { client, ttlMs } = config;
  const { nowIso, expiresAt } = buildEntryWindow(ttlMs);

  await cleanupExpired(client, userId, nowIso);
  const insertResult = await insertEntry({ client, key, userId, nowIso, expiresAt });
  if (insertResult.inserted) {
    return { status: 'new' };
  }

  const existing = await getEntry(client, key, userId);
  if (isEntryExpired(existing)) {
    await deleteEntry(client, key, userId);
    return { status: 'retry' };
  }
  if (hasCompletedResponse(existing)) {
    return { status: 'completed', response: existing.response };
  }

  return { status: 'in_progress' };
}

function createIdempotencyStore(options = {}) {
  const config = resolveStoreConfig(options);

  return {
    run: (key, userId, task) => runWithIdempotency({ key, userId, task, config }),
    getEntry: (key, userId) => getEntry(config.client, key, userId),
    begin: (key, userId) => beginWithIdempotency({ key, userId, config }),
    complete: async (key, userId, response) => {
      if (!key || !userId) return;
      await updateEntry(config.client, key, userId, { status: 'completed', response });
    },
    fail: (key, userId) => deleteEntry(config.client, key, userId),
  };
}

module.exports = {
  createIdempotencyStore,
};
