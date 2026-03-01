import { getMetaEnvString, isNonEmptyString } from './utils';
import type { GlobalWithChrome } from './types';

export const DSN_PREFIX_LENGTH = 30;
export const PROD_TRACES_SAMPLE_RATE = 0.1;
export const DEFAULT_FLUSH_TIMEOUT_MS = 2000;

type RuntimeContext = {
  globalWithChrome: GlobalWithChrome;
  isServiceWorker: boolean;
  isDevelopment: boolean;
  shouldLogDebug: boolean;
};

const BUILD_TIME_DSN = getMetaEnvString('VITE_SENTRY_DSN');

function getGlobalContext(isServiceWorker: boolean): typeof globalThis {
  if (isServiceWorker) {
    return self as typeof globalThis;
  }
  if (typeof window !== 'undefined') {
    return window;
  }
  return globalThis;
}

function isServiceWorkerContext(): boolean {
  return (
    typeof self !== 'undefined' &&
    typeof window === 'undefined' &&
    'ServiceWorkerGlobalScope' in self
  );
}

export function isDevelopmentBuild(globalWithChrome: GlobalWithChrome): boolean {
  try {
    const manifest = globalWithChrome.chrome?.runtime?.getManifest?.();
    return !isNonEmptyString(manifest?.update_url);
  } catch {
    return true;
  }
}

export function isTestEnvironment(
  processLike: { env?: Record<string, string | undefined> } | undefined = undefined,
): boolean {
  const activeProcess =
    processLike ??
    (typeof process !== 'undefined'
      ? (process as { env?: Record<string, string | undefined> })
      : undefined);

  const nodeEnv = activeProcess?.env?.['NODE_ENV'];
  const vitestFlag = activeProcess?.env?.['VITEST'];
  return nodeEnv === 'test' || vitestFlag === 'true' || vitestFlag === '1';
}

export function resolveSentryDsn(
  buildTimeDsn: string | undefined,
  configDsn: string | undefined,
): string | undefined {
  if (isNonEmptyString(buildTimeDsn) && !buildTimeDsn.includes('import.meta')) {
    return buildTimeDsn;
  }
  if (isNonEmptyString(configDsn) && configDsn !== '__SENTRY_DSN__') {
    return configDsn;
  }
  return undefined;
}

export function getSentryDsn(globalWithChrome: GlobalWithChrome): string | undefined {
  return resolveSentryDsn(BUILD_TIME_DSN, globalWithChrome.LOCKIN_CONFIG?.SENTRY_DSN);
}

export function createRuntimeContext(): RuntimeContext {
  const isServiceWorker = isServiceWorkerContext();
  const globalWithChrome = getGlobalContext(isServiceWorker) as GlobalWithChrome;
  const isDevelopment = isDevelopmentBuild(globalWithChrome);
  const shouldLogDebug = isDevelopment && !isTestEnvironment();

  return { globalWithChrome, isServiceWorker, isDevelopment, shouldLogDebug };
}
