import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';

const testDir = path.dirname(fileURLToPath(import.meta.url));

type ScriptContext = vm.Context & {
  [key: string]: unknown;
};

function loadScript(relativePathFromTestsDir: string): string {
  return readFileSync(path.resolve(testDir, relativePathFromTestsDir), 'utf8');
}

function createScriptContext(): ScriptContext {
  const contextObject: Record<string, unknown> = {
    console: {
      log: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
    },
    setTimeout,
    clearTimeout,
    URL,
    AbortController,
    Uint8Array,
    ArrayBuffer,
    Date,
    Math,
    Promise,
    fetch: async () => Promise.reject(new Error('fetch not implemented in this unit test')),
  };

  contextObject['globalThis'] = contextObject;
  contextObject['window'] = contextObject;
  contextObject['self'] = contextObject;

  return vm.createContext(contextObject) as ScriptContext;
}

function evaluateScript(source: string, filename: string, context: ScriptContext): void {
  vm.runInContext(source, context, { filename });
}

describe('content script scope isolation', () => {
  it('allows networkRetry and mediaFetcher to be evaluated in the same global context', () => {
    const context = createScriptContext();
    const networkRetryScript = loadScript('../networkRetry.js');
    const mediaFetcherScript = loadScript('../../content/mediaFetcher.js');

    expect(() => {
      evaluateScript(networkRetryScript, 'networkRetry.js', context);
      evaluateScript(mediaFetcherScript, 'mediaFetcher.js', context);
    }).not.toThrow();

    const networkRetryApi = context['LockInNetworkRetry'] as Record<string, unknown> | undefined;
    expect(networkRetryApi).toBeDefined();
    expect(typeof networkRetryApi?.['fetchWithRetry']).toBe('function');

    const mediaFetcherApi = context['LockInMediaFetcher'] as Record<string, unknown> | undefined;
    expect(mediaFetcherApi).toBeDefined();
    expect(typeof mediaFetcherApi?.['handleMediaFetchRequest']).toBe('function');
  });

  it('remains safe if both scripts are evaluated more than once', () => {
    const context = createScriptContext();
    const networkRetryScript = loadScript('../networkRetry.js');
    const mediaFetcherScript = loadScript('../../content/mediaFetcher.js');

    expect(() => {
      evaluateScript(networkRetryScript, 'networkRetry.js', context);
      evaluateScript(mediaFetcherScript, 'mediaFetcher.js', context);
      evaluateScript(networkRetryScript, 'networkRetry.js', context);
      evaluateScript(mediaFetcherScript, 'mediaFetcher.js', context);
    }).not.toThrow();
  });
});
