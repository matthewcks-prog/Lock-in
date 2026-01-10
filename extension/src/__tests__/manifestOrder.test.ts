import { describe, expect, it } from 'vitest';

import manifestJson from '../../manifest.json';

describe('manifest content_scripts order', () => {
  const manifest = JSON.parse(JSON.stringify(manifestJson));

  it('keeps the content_scripts js list stable and ordered', () => {
    const contentScripts = manifest.content_scripts;

    expect(Array.isArray(contentScripts)).toBe(true);
    expect(contentScripts.length).toBeGreaterThan(0);

    const scripts = contentScripts[0]?.js;

    expect(Array.isArray(scripts)).toBe(true);
    expect(scripts.length).toBeGreaterThan(0);

    const expectedScripts = Object.freeze([
      'config.js',
      'dist/libs/sentry.js',
      'dist/libs/initApi.js',
      'dist/libs/contentLibs.js',
      'content/stateStore.js',
      'content/sidebarHost.js',
      'content/sessionManager.js',
      'content/interactions.js',
      'content/mediaFetcher.js',
      'dist/ui/index.js',
      'contentScript-react.js',
    ]);

    // If you intentionally change manifest scripts/order, update this expected array.
    expect(scripts).toEqual(expectedScripts);

    expect(scripts[0]).toBe('config.js');
    expect(scripts.indexOf('dist/libs/initApi.js')).toBeLessThan(
      scripts.indexOf('dist/libs/contentLibs.js'),
    );
    expect(scripts.indexOf('dist/ui/index.js')).toBeLessThan(
      scripts.indexOf('contentScript-react.js'),
    );
    expect(scripts[scripts.length - 1]).toBe('contentScript-react.js');
  });
});
