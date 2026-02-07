/**
 * Vite config for building extension message schemas bundle.
 *
 * Bundles extension/src/messageSchemas.ts into an IIFE file
 * at extension/dist/libs/messageSchemas.js that can be loaded by the background script.
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
      resolve(process.cwd(), 'extension/dist/libs/messageSchemas.js'),
      'Processed messageSchemas.js for ASCII compatibility',
    ),
  ],
  build: createIifeBuildConfig({
    outDir: 'extension/dist/libs',
    emptyOutDir: false,
    entry: './extension/src/messageSchemas.ts',
    name: 'LockInMessageSchemas',
    fileName: 'messageSchemas.js',
  }),
  resolve: {
    alias: createAliases({ includeCore: false }),
    extensions: ['.ts', '.js'],
  },
}));
