import { describe, expect, it } from 'vitest';
import { isDevelopmentBuild, isTestEnvironment, resolveSentryDsn } from '../runtime';
import type { GlobalWithChrome } from '../types';

describe('sentry runtime helpers', () => {
  it('prefers build-time DSN when present', () => {
    const resolved = resolveSentryDsn(
      'https://public@example.ingest.sentry.io/123',
      'https://config@example.ingest.sentry.io/456',
    );
    expect(resolved).toBe('https://public@example.ingest.sentry.io/123');
  });

  it('falls back to config DSN when build-time value is empty or placeholder', () => {
    expect(resolveSentryDsn(undefined, 'https://config@example.ingest.sentry.io/456')).toBe(
      'https://config@example.ingest.sentry.io/456',
    );
    expect(resolveSentryDsn('import.meta.env.VITE_SENTRY_DSN', 'https://cfg')).toBe('https://cfg');
    expect(resolveSentryDsn('', '__SENTRY_DSN__')).toBeUndefined();
  });

  it('marks unpacked extensions as development builds', () => {
    const unpackedContext = {
      chrome: {
        runtime: {
          getManifest: () => ({ version: '1.0.0' }),
        },
      },
    } as GlobalWithChrome;

    const packedContext = {
      chrome: {
        runtime: {
          getManifest: () => ({ version: '1.0.0', update_url: 'https://updates.example.com' }),
        },
      },
    } as GlobalWithChrome;

    expect(isDevelopmentBuild(unpackedContext)).toBe(true);
    expect(isDevelopmentBuild(packedContext)).toBe(false);
  });

  it('detects test environment flags', () => {
    expect(isTestEnvironment({ env: { NODE_ENV: 'test' } })).toBe(true);
    expect(isTestEnvironment({ env: { VITEST: 'true' } })).toBe(true);
    expect(isTestEnvironment({ env: { VITEST: '1' } })).toBe(true);
    expect(isTestEnvironment({ env: { NODE_ENV: 'production' } })).toBe(false);
  });
});
