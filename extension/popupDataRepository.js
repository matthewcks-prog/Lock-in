const EXPORT_SCHEMA_VERSION = 1;
const EXPORT_FILENAME_PREFIX = 'lockin-export';

const DEFAULT_CLIENT_STORAGE_CONFIG = {
  keys: { SUPABASE_SESSION: 'lockinSupabaseSession' },
  aliases: { lockin_selectedNoteId: ['lockin_sidebar_selectedNoteId'] },
  clearScope: {
    sync: [],
    local: [],
    localStorage: [],
    localPrefixes: ['lockin_session_'],
  },
};

function asStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => typeof item === 'string' && item.length > 0);
}

function getRuntimeConfig() {
  return window.LOCKIN_CONFIG || {};
}

function resolveClientStorageConfig() {
  const runtimeStorage = getRuntimeConfig().CLIENT_STORAGE || {};
  const runtimeScope = runtimeStorage.CLEAR_SCOPE || {};
  return {
    keys: runtimeStorage.KEYS || DEFAULT_CLIENT_STORAGE_CONFIG.keys,
    aliases: runtimeStorage.ALIASES || DEFAULT_CLIENT_STORAGE_CONFIG.aliases,
    clearScope: {
      sync: asStringArray(runtimeScope.sync),
      local: asStringArray(runtimeScope.local),
      localStorage: asStringArray(runtimeScope.localStorage),
      localPrefixes: asStringArray(runtimeScope.localPrefixes).length
        ? asStringArray(runtimeScope.localPrefixes)
        : DEFAULT_CLIENT_STORAGE_CONFIG.clearScope.localPrefixes,
    },
  };
}

function expandAliasedKeys(keys, aliasesMap) {
  const expanded = new Set();
  asStringArray(keys).forEach((key) => {
    expanded.add(key);
    asStringArray(aliasesMap[key]).forEach((aliasKey) => expanded.add(aliasKey));
  });
  return [...expanded];
}

async function readStorageArea(area) {
  return chrome.storage[area].get(null);
}

async function removeStorageKeys(area, keys) {
  const keyList = asStringArray(keys);
  if (keyList.length === 0) return;
  await chrome.storage[area].remove(keyList);
}

async function sendMessageToTab(tabId, message) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        resolve(null);
        return;
      }
      resolve(response);
    });
  });
}

async function collectLocalStorageFromActiveTab(localStorageKeys) {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const activeTabId = tabs[0]?.id;
  if (typeof activeTabId !== 'number') return null;

  const response = await sendMessageToTab(activeTabId, {
    type: 'LOCKIN_COLLECT_LOCAL_STORAGE_KEYS',
    payload: { keys: localStorageKeys },
  });
  if (!response || response.ok !== true) return null;
  return typeof response.data === 'object' && response.data ? response.data : null;
}

async function clearLocalStorageAcrossTabs(localStorageKeys) {
  const keyList = asStringArray(localStorageKeys);
  if (keyList.length === 0) return;

  const tabs = await chrome.tabs.query({});
  const requests = tabs
    .map((tab) => tab.id)
    .filter((tabId) => typeof tabId === 'number')
    .map((tabId) =>
      sendMessageToTab(tabId, {
        type: 'LOCKIN_CLEAR_LOCAL_STORAGE_KEYS',
        payload: { keys: keyList },
      }),
    );
  await Promise.allSettled(requests);
}

function redactSensitiveSyncValues(syncValues, sessionStorageKey) {
  const redacted = { ...(syncValues || {}) };
  if (typeof sessionStorageKey !== 'string' || sessionStorageKey.length === 0) {
    return redacted;
  }
  if (redacted[sessionStorageKey] !== undefined) {
    redacted[sessionStorageKey] = '[REDACTED_AUTH_SESSION]';
  }
  return redacted;
}

async function buildLocalSlice(clientStorage) {
  const errors = [];
  let sync = {};
  let local = {};
  let localStorage = null;

  try {
    sync = await readStorageArea('sync');
  } catch (error) {
    errors.push({ slice: 'sync', message: error?.message || 'Failed to read sync data' });
  }
  try {
    local = await readStorageArea('local');
  } catch (error) {
    errors.push({ slice: 'local', message: error?.message || 'Failed to read local data' });
  }
  try {
    localStorage = await collectLocalStorageFromActiveTab(clientStorage.clearScope.localStorage);
  } catch (error) {
    errors.push({
      slice: 'localStorage',
      message: error?.message || 'Failed to read tab localStorage',
    });
  }

  return {
    sync: redactSensitiveSyncValues(sync, clientStorage.keys.SUPABASE_SESSION),
    local,
    localStorage,
    errors,
  };
}

async function buildCloudSlice(apiClient, authClient) {
  const cloudBuilder = window.LockInPopupDataCloud?.buildCloudSlice;
  if (typeof cloudBuilder !== 'function') {
    return { available: false, reason: 'cloud_builder_unavailable' };
  }
  return cloudBuilder(apiClient, authClient);
}

function getManifestVersion() {
  try {
    return chrome.runtime.getManifest().version || 'unknown';
  } catch {
    return 'unknown';
  }
}

function formatExportStamp(isoString) {
  const date = new Date(isoString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}${month}${day}-${hours}${minutes}`;
}

function buildExportPayload(local, cloud, exportedAt) {
  return {
    schemaVersion: EXPORT_SCHEMA_VERSION,
    exportedAt,
    appVersion: getManifestVersion(),
    data: { local, cloud },
  };
}

function buildExportFilename(exportedAt) {
  return `${EXPORT_FILENAME_PREFIX}-${formatExportStamp(exportedAt)}.json`;
}

function createExportData({ clientStorage, apiClient, authClient }) {
  return async function exportData() {
    const local = await buildLocalSlice(clientStorage);
    const cloud = await buildCloudSlice(apiClient, authClient);
    const exportedAt = new Date().toISOString();
    return {
      payload: buildExportPayload(local, cloud, exportedAt),
      filename: buildExportFilename(exportedAt),
    };
  };
}

function createClearLocalData({ clientStorage, authClient }) {
  return async function clearLocalData({ skipSignOut = false } = {}) {
    const syncKeys = expandAliasedKeys(clientStorage.clearScope.sync, clientStorage.aliases);
    const localKeys = expandAliasedKeys(clientStorage.clearScope.local, clientStorage.aliases);

    const localDump = await readStorageArea('local').catch(() => ({}));
    const prefixedKeys = Object.keys(localDump).filter((storageKey) =>
      clientStorage.clearScope.localPrefixes.some((prefix) => storageKey.startsWith(prefix)),
    );
    const localKeysToRemove = [...new Set([...localKeys, ...prefixedKeys])];

    await removeStorageKeys('sync', syncKeys);
    await removeStorageKeys('local', localKeysToRemove);

    asStringArray(clientStorage.clearScope.localStorage).forEach((storageKey) => {
      try {
        localStorage.removeItem(storageKey);
      } catch {
        // Ignore local popup localStorage failures.
      }
    });
    await clearLocalStorageAcrossTabs(clientStorage.clearScope.localStorage).catch(() => {});

    if (!skipSignOut && typeof authClient?.signOut === 'function') {
      await authClient.signOut().catch(() => {});
    }
  };
}

function createHasDeleteAccountPath(apiClient) {
  return function hasDeleteAccountPath() {
    return typeof apiClient?.deleteMyAccount === 'function';
  };
}

function createDeleteAccount({ apiClient, authClient, clearLocalData, hasDeleteAccountPath }) {
  return async function deleteAccount() {
    if (!hasDeleteAccountPath()) {
      throw new Error('Delete account endpoint is not available.');
    }
    await apiClient.deleteMyAccount();
    await clearLocalData({ skipSignOut: true });
    if (typeof authClient?.signOut === 'function') {
      await authClient.signOut().catch(() => {});
    }
  };
}

function createDataRepository({ apiClient, authClient }) {
  const clientStorage = resolveClientStorageConfig();
  const exportData = createExportData({ clientStorage, apiClient, authClient });
  const clearLocalData = createClearLocalData({ clientStorage, authClient });
  const hasDeleteAccountPath = createHasDeleteAccountPath(apiClient);
  const deleteAccount = createDeleteAccount({
    apiClient,
    authClient,
    clearLocalData,
    hasDeleteAccountPath,
  });
  return {
    exportData,
    clearLocalData,
    hasDeleteAccountPath,
    deleteAccount,
  };
}

window.LockInPopupDataRepository = {
  createDataRepository,
};
