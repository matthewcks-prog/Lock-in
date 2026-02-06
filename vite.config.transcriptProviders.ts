/**
 * Vite config for building transcript providers for background scripts
 *
 * Bundles core/transcripts/providers/index.ts into an IIFE file
 * at extension/dist/libs/transcriptProviders.js that can be loaded by the background script.
 *
 * This exposes window.LockInTranscriptProviders with:
 * - PanoptoProvider
 * - Echo360Provider
 * - Shared provider utilities
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
      resolve(process.cwd(), 'extension/dist/libs/transcriptProviders.js'),
      'Processed transcriptProviders.js for ASCII compatibility',
    ),
  ],
  build: createIifeBuildConfig({
    outDir: 'extension/dist/libs',
    emptyOutDir: false,
    entry: './core/transcripts/providers/index.ts',
    name: 'LockInTranscriptProviders',
    fileName: 'transcriptProviders.js',
  }),
  resolve: {
    alias: createAliases({ includeIntegrations: false }),
    extensions: ['.ts', '.js'],
  },
}));
