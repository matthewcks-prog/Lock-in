/**
 * Vite config for building initApi.js bundle
 *
 * Bundles extension/src/initApi.ts and its dependencies (api/client.ts, api/auth.ts)
 * into a single IIFE file at extension/dist/libs/initApi.js that can be loaded by
 * Chrome extension content scripts.
 */

import { defineConfig } from 'vite';
import { resolve } from 'path';
import {
  createAliases,
  createDefines,
  createIifeBuildConfig,
  ensureAsciiSafeOutput,
} from './build/viteShared';

export default defineConfig(({ mode }) => ({
  define: createDefines(mode),
  plugins: [
    ensureAsciiSafeOutput(
      resolve(process.cwd(), 'extension/dist/libs/initApi.js'),
      'Processed initApi.js for ASCII compatibility',
    ),
  ],
  build: createIifeBuildConfig({
    outDir: 'extension/dist/libs',
    emptyOutDir: false, // Don't delete other files in dist/libs/
    entry: './extension/src/initApi.ts',
    name: 'LockInInit',
    fileName: 'initApi.js',
  }),
  resolve: {
    alias: createAliases({ includeApi: true }),
    extensions: ['.ts', '.js'],
  },
}));
