import type { StorageInterface } from '../../core/storage/storageInterface';
import type { AuthSession } from '../../core/domain/types';
import type { Logger } from '../../core/utils/logger';
import { parseStoredAuthSession } from './sessionValidation';

type AuthStorageParams = {
  storage: StorageInterface;
  sessionStorageKey: string;
  logger: Logger;
  notify: (session: AuthSession | null) => void;
};

export type AuthStorageManager = {
  readSession(): Promise<AuthSession | null>;
  writeSession(session: AuthSession): Promise<void>;
  clearSession(): Promise<void>;
  listen(): () => void;
};

async function readSessionFromStorage(
  storage: StorageInterface,
  sessionStorageKey: string,
  logger: Logger,
): Promise<AuthSession | null> {
  try {
    const data = await storage.get<AuthSession | null>(sessionStorageKey);
    const stored = data[sessionStorageKey] ?? null;
    const parsed = parseStoredAuthSession(stored);
    if (stored !== null && parsed === null) {
      logger.warn('Auth storage payload failed validation');
    }
    return parsed;
  } catch (error) {
    logger.error('Auth storage read error', error);
    return null;
  }
}

async function writeSessionToStorage(
  storage: StorageInterface,
  sessionStorageKey: string,
  session: AuthSession,
  logger: Logger,
): Promise<void> {
  try {
    await storage.set({ [sessionStorageKey]: session });
  } catch (error) {
    logger.error('Auth storage write error', error);
  }
}

async function clearSessionFromStorage(
  storage: StorageInterface,
  sessionStorageKey: string,
  logger: Logger,
): Promise<void> {
  try {
    await storage.remove(sessionStorageKey);
  } catch (error) {
    logger.error('Auth storage clear error', error);
  }
}

function listenForStorageChanges(
  storage: StorageInterface,
  sessionStorageKey: string,
  logger: Logger,
  notify: (session: AuthSession | null) => void,
): () => void {
  return storage.onChanged<AuthSession | null>((changes, areaName) => {
    const change = changes[sessionStorageKey];
    if (areaName === 'sync' && change !== undefined) {
      const nextSession = parseStoredAuthSession(change.newValue ?? null);
      if (change.newValue !== null && nextSession === null) {
        logger.warn('Auth storage change failed validation');
        return;
      }
      notify(nextSession);
    }
  });
}

export function createAuthStorageManager({
  storage,
  sessionStorageKey,
  logger,
  notify,
}: AuthStorageParams): AuthStorageManager {
  return {
    readSession: async () => readSessionFromStorage(storage, sessionStorageKey, logger),
    writeSession: async (session) =>
      writeSessionToStorage(storage, sessionStorageKey, session, logger),
    clearSession: async () => clearSessionFromStorage(storage, sessionStorageKey, logger),
    listen: () => listenForStorageChanges(storage, sessionStorageKey, logger, notify),
  };
}
