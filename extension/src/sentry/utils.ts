import type { ChromeLike } from './chromeTypes';

export function isNonEmptyString(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.length > 0;
}

export function getMetaEnvString(key: string): string | undefined {
  const env = import.meta.env as Record<string, unknown>;
  const raw = env[key];
  return typeof raw === 'string' ? raw : undefined;
}

export function getExtensionVersion(chromeLike: ChromeLike | undefined): string {
  try {
    const version = chromeLike?.runtime?.getManifest?.()?.version;
    return isNonEmptyString(version) ? version : 'unknown';
  } catch {
    return 'unknown';
  }
}
