import { describe, expect, it } from 'vitest';
import { isExtensionErrorFilename, toError } from '../listeners';

describe('sentry listener helpers', () => {
  it('detects extension-owned script paths', () => {
    expect(isExtensionErrorFilename('chrome-extension://abc/dist/ui/index.js')).toBe(true);
    expect(isExtensionErrorFilename('/extension/background.js')).toBe(true);
    expect(isExtensionErrorFilename('https://cdn.example.com/app.js')).toBe(false);
  });

  it('normalizes unknown rejection reasons into Error instances', () => {
    const original = new Error('boom');
    expect(toError(original)).toBe(original);
    expect(toError('failure')).toBeInstanceOf(Error);
    expect(toError('failure').message).toBe('failure');
  });
});
