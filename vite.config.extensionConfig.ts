/**
 * Vite config for building extension/config.js
 *
 * Bundles extension/src/config.ts into extension/config.js with env injection.
 */

import { defineConfig } from 'vite';
import { resolve } from 'path';
import { createDefines, createIifeBuildConfig, ensureAsciiSafeOutput } from './build/viteShared';

export default defineConfig(({ mode }) => ({
  define: createDefines(mode),
  plugins: [
    ensureAsciiSafeOutput(
      resolve(process.cwd(), 'extension/config.js'),
      'Processed config.js for ASCII compatibility',
    ),
  ],
  build: createIifeBuildConfig({
    outDir: 'extension',
    emptyOutDir: false,
    entry: './extension/src/config.ts',
    name: 'LockInConfig',
    fileName: 'config.js',
  }),
}));
