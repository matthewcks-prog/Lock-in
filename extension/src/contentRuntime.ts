import { logger, type Logger } from './logger';
import { messaging, type Messaging } from './messaging';
import { storage, STORAGE_KEYS, type Storage, type StorageChange } from './storage';
import { getAdapterForUrl, GenericAdapter } from '../../integrations';
import type { BaseAdapter } from '../../integrations/adapters/baseAdapter';
import type { PageContext } from '../../core/domain/types';

type MessageType = keyof typeof MESSAGE_TYPES;

const MESSAGE_TYPES = {
  GET_TAB_ID: 'GET_TAB_ID',
  GET_SESSION: 'GET_SESSION',
  SAVE_SESSION: 'SAVE_SESSION',
  CLEAR_SESSION: 'CLEAR_SESSION',
  GET_SETTINGS: 'GET_SETTINGS',
  UPDATE_SETTINGS: 'UPDATE_SETTINGS',
} as const;

export type RuntimeStorage = Storage & {
  getLocal: Storage['getLocal'];
  setLocal: Storage['setLocal'];
  removeLocal: Storage['removeLocal'];
};

export interface RuntimeMessaging extends Messaging {
  types: typeof MESSAGE_TYPES;
  send: <T = unknown>(type: (typeof MESSAGE_TYPES)[MessageType], payload?: unknown) => Promise<T>;
}

export interface RuntimeSession {
  getTabId: () => Promise<number | null>;
  getSession: () => Promise<unknown>;
  clearSession: () => Promise<void>;
  loadChatId: () => Promise<string | null>;
}

export type LockInContentRuntime = {
  __version: '1.0';
  logger: Logger;
  storage: RuntimeStorage;
  messaging: RuntimeMessaging;
  session: RuntimeSession;
  resolveAdapterContext: typeof resolveAdapterContext;
};

interface LoggerInterface {
  error?: (...args: unknown[]) => void;
  warn?: (...args: unknown[]) => void;
  debug?: (...args: unknown[]) => void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function inferCourseCode(dom: Document, url: string): string | null {
  const urlMatch = url.match(/\b([A-Z]{3}\d{4})\b/i);
  if (urlMatch) {
    return urlMatch[1].toUpperCase();
  }

  const bodyText = dom.body?.innerText || '';
  const codeMatch = bodyText.match(/\b([A-Z]{3}\d{4})\b/i);
  return codeMatch ? codeMatch[1].toUpperCase() : null;
}

export function resolveAdapterContext(loggerInstance?: LoggerInterface): {
  adapter: BaseAdapter;
  pageContext: PageContext;
} {
  const log = {
    error: loggerInstance?.error ?? console.error,
    warn: loggerInstance?.warn ?? console.warn,
    debug: loggerInstance?.debug ?? (() => {}),
  };

  let adapter: BaseAdapter = new GenericAdapter();
  let pageContext: PageContext = {
    url: window.location.href,
    title: document.title,
    heading: document.title,
    courseContext: { courseCode: null, sourceUrl: window.location.href },
  };

  try {
    adapter = getAdapterForUrl(window.location.href) || adapter;
    pageContext = adapter.getPageContext(document, window.location.href);

    const courseContext = pageContext.courseContext || {
      courseCode: null,
      sourceUrl: window.location.href,
    };

    if (!courseContext.courseCode) {
      const inferred = inferCourseCode(document, window.location.href);
      if (inferred) {
        pageContext = {
          ...pageContext,
          courseContext: {
            ...courseContext,
            courseCode: inferred,
          },
        };
      }
    }
  } catch (error) {
    log.error('Failed to get page context:', error);
  }

  return { adapter, pageContext };
}

function createStorageApi(log: Logger): RuntimeStorage {
  return {
    ...storage,
    async getLocal<T = unknown>(keys: string | string[]): Promise<Record<string, T>> {
      try {
        return await storage.getLocal<T>(keys);
      } catch (error) {
        log.warn('Storage.getLocal failed:', error);
        throw error;
      }
    },
    async setLocal(key: string, value: unknown): Promise<void> {
      try {
        await storage.setLocal(key, value);
      } catch (error) {
        log.warn('Storage.setLocal failed:', error);
        throw error;
      }
    },
    async removeLocal(keys: string | string[]): Promise<void> {
      try {
        await storage.removeLocal(keys);
      } catch (error) {
        log.warn('Storage.removeLocal failed:', error);
        throw error;
      }
    },
    onChanged(
      callback: (changes: Record<string, StorageChange>, areaName: string) => void,
    ): () => void {
      return storage.onChanged(callback);
    },
  };
}

function createMessagingApi(log: Logger): RuntimeMessaging {
  return {
    ...messaging,
    types: MESSAGE_TYPES,
    async send<T = unknown>(type: (typeof MESSAGE_TYPES)[MessageType], payload?: unknown) {
      try {
        return await messaging.sendToBackground<T>({ type, payload });
      } catch (error) {
        log.error('[Lock-in] Messaging send failed:', error);
        throw error;
      }
    },
  };
}

function createSessionApi(
  log: Logger,
  runtimeMessaging: RuntimeMessaging,
  runtimeStorage: RuntimeStorage,
): RuntimeSession {
  let cachedTabId: number | null = null;

  async function getTabId(): Promise<number | null> {
    try {
      const response = await runtimeMessaging.send<unknown>(runtimeMessaging.types.GET_TAB_ID);
      const responseRecord = isRecord(response) ? response : {};
      const dataRecord = isRecord(responseRecord.data) ? responseRecord.data : {};
      const tabId =
        typeof dataRecord.tabId === 'number'
          ? dataRecord.tabId
          : typeof responseRecord.tabId === 'number'
            ? responseRecord.tabId
            : null;
      if (typeof tabId === 'number') {
        cachedTabId = tabId;
        return tabId;
      }
      return cachedTabId;
    } catch (error) {
      log.error('[Lock-in] Failed to get tab ID:', error);
      return cachedTabId;
    }
  }

  async function getSession(): Promise<unknown> {
    try {
      const response = await runtimeMessaging.send<unknown>(runtimeMessaging.types.GET_SESSION);
      const responseRecord = isRecord(response) ? response : {};
      const dataRecord = isRecord(responseRecord.data) ? responseRecord.data : {};
      return dataRecord.session ?? responseRecord.session ?? null;
    } catch (error) {
      log.error('[Lock-in] Failed to get session:', error);
      return null;
    }
  }

  async function clearSession(): Promise<void> {
    try {
      await runtimeMessaging.send(runtimeMessaging.types.CLEAR_SESSION);
    } catch (error) {
      log.error('[Lock-in] Failed to clear session:', error);
    }
  }

  async function loadChatId(): Promise<string | null> {
    try {
      const data = await runtimeStorage.getLocal<string>(STORAGE_KEYS.CURRENT_CHAT_ID);
      const chatId = data[STORAGE_KEYS.CURRENT_CHAT_ID];
      return typeof chatId === 'string' ? chatId : null;
    } catch (error) {
      log.warn('Failed to load chat ID:', error);
      return null;
    }
  }

  return {
    getTabId,
    getSession,
    clearSession,
    loadChatId,
  };
}

export function createContentRuntime(): LockInContentRuntime {
  const runtimeLogger = logger;
  const runtimeStorage = createStorageApi(runtimeLogger);
  const runtimeMessaging = createMessagingApi(runtimeLogger);
  const runtimeSession = createSessionApi(runtimeLogger, runtimeMessaging, runtimeStorage);

  const runtime: LockInContentRuntime = {
    __version: '1.0',
    logger: runtimeLogger,
    storage: runtimeStorage,
    messaging: runtimeMessaging,
    session: runtimeSession,
    resolveAdapterContext,
  };

  return runtime;
}
