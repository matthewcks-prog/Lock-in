/**
 * Vite config for building WebVTT parser for background script
 *
 * Bundles core/transcripts/webvttParser.ts into an IIFE file
 * at extension/dist/libs/webvttParser.js that can be loaded by the background script.
 *
 * This exposes window.LockInWebVtt with:
 * - parseWebVtt
 * - formatAsVtt
 * - decodeHtmlEntities
 * - parseVttTimestamp
 */

import { defineConfig } from 'vite';
import { resolve } from 'path';
import {
  createAliases,
  createIifeBuildConfig,
  ensureAsciiSafeOutput,
  sharedDefines,
} from './build/viteShared';

export default defineConfig({
  define: sharedDefines,
  plugins: [
    ensureAsciiSafeOutput(
      resolve(process.cwd(), 'extension/dist/libs/webvttParser.js'),
      'Processed webvttParser.js for ASCII compatibility',
    ),
  ],
  build: createIifeBuildConfig({
    outDir: 'extension/dist/libs',
    emptyOutDir: false, // Don't delete other files in dist/libs/
    entry: './core/transcripts/webvttParser.ts',
    name: 'LockInWebVtt',
    fileName: 'webvttParser.js',
  }),
  resolve: {
    alias: createAliases({ includeIntegrations: false }),
    extensions: ['.ts', '.js'],
  },
});
