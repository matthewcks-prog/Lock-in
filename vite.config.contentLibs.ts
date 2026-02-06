/**
 * Vite config for building content script libraries bundle
 *
 * Bundles extension/src/contentLibs.ts and its dependencies into a single IIFE file
 * at extension/dist/libs/contentLibs.js that can be loaded by Chrome extension content scripts.
 *
 * This includes:
 * - Canonical runtime (window.LockInContent)
 * - Logger (window.LockInLogger)
 * - Messaging (window.LockInMessaging)
 * - Storage (window.LockInStorage)
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
      resolve(process.cwd(), 'extension/dist/libs/contentLibs.js'),
      'Processed contentLibs.js for ASCII compatibility',
    ),
  ],
  build: createIifeBuildConfig({
    outDir: 'extension/dist/libs',
    emptyOutDir: false, // Don't delete other files in dist/libs/
    entry: './extension/src/contentLibs.ts',
    name: 'LockInContentLibs',
    fileName: 'contentLibs.js',
  }),
  resolve: {
    alias: createAliases({ includeIntegrations: true }),
    extensions: ['.ts', '.js'],
  },
}));
