/**
 * Vite config for building the Sentry module as an IIFE bundle.
 *
 * This bundle is loaded by:
 * - background.js (via importScripts)
 * - popup.html (via script tag)
 * - content scripts (via manifest.json)
 *
 * The DSN is injected at build time via VITE_SENTRY_DSN environment variable.
 * Source maps are uploaded to Sentry when SENTRY_AUTH_TOKEN is configured.
 */

import { defineConfig, loadEnv } from 'vite';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import { resolve } from 'path';
import {
  createAliases,
  createDefines,
  createIifeBuildConfig,
  ensureAsciiSafeOutput,
} from './build/viteShared';

export default defineConfig(({ mode }) => {
  // Load environment variables from .env file
  const env = loadEnv(mode, process.cwd(), '');

  // Only upload source maps in production builds when Sentry auth is configured
  const shouldUploadSourceMaps =
    mode === 'production' && env.SENTRY_AUTH_TOKEN && env.SENTRY_ORG && env.SENTRY_PROJECT;

  return {
    define: {
      ...createDefines(mode),
      // Inject Sentry DSN at build time (required for service worker where import.meta doesn't work)
      'import.meta.env.VITE_SENTRY_DSN': JSON.stringify(env.VITE_SENTRY_DSN || ''),
    },
    plugins: [
      ensureAsciiSafeOutput(
        resolve(process.cwd(), 'extension/dist/libs/sentry.js'),
        'Processed Sentry bundle for ASCII compatibility',
      ),
      // Upload source maps to Sentry for readable stack traces
      shouldUploadSourceMaps &&
        sentryVitePlugin({
          org: env.SENTRY_ORG,
          project: env.SENTRY_PROJECT,
          authToken: env.SENTRY_AUTH_TOKEN,
          release: {
            name: `lockin-extension@${process.env.npm_package_version || '1.0.0'}`,
          },
          sourcemaps: {
            filesToDeleteAfterUpload: ['extension/dist/libs/sentry.js.map'],
          },
          telemetry: false,
        }),
    ].filter(Boolean),
    build: {
      ...createIifeBuildConfig({
        outDir: 'extension/dist/libs',
        entry: 'extension/src/sentry.ts',
        name: 'LockInSentry',
        fileName: 'sentry.js',
        sourcemap: true,
      }),
      // Don't empty the output dir - other libs are there too
      emptyOutDir: false,
    },
    resolve: {
      alias: createAliases({ includeCore: false }),
    },
  };
});
