import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import { resolve } from 'path';
import {
  createAliases,
  createIifeBuildConfig,
  ensureAsciiSafeOutput,
  sharedDefines,
} from './build/viteShared';

export default defineConfig(({ mode }) => {
  // Load environment variables
  const env = loadEnv(mode, process.cwd(), '');

  // Only upload source maps in production builds when Sentry auth is configured
  const shouldUploadSourceMaps =
    mode === 'production' &&
    env.SENTRY_AUTH_TOKEN &&
    env.SENTRY_ORG &&
    env.SENTRY_PROJECT;

  return {
    define: sharedDefines,
    css: {
      postcss: './postcss.config.js',
    },
    plugins: [
      react(),
      ensureAsciiSafeOutput(
        resolve(process.cwd(), 'extension/dist/ui/index.js'),
        'Processed output file for ASCII compatibility',
      ),
      // Upload source maps to Sentry for readable stack traces in production
      shouldUploadSourceMaps &&
        sentryVitePlugin({
          org: env.SENTRY_ORG,
          project: env.SENTRY_PROJECT,
          authToken: env.SENTRY_AUTH_TOKEN,
          release: {
            name: `lockin-extension@${process.env.npm_package_version || '1.0.0'}`,
          },
          sourcemaps: {
            // Upload source maps but delete them after (don't ship to users)
            filesToDeleteAfterUpload: ['extension/dist/**/*.map'],
          },
          telemetry: false, // Disable Sentry's own telemetry
        }),
    ].filter(Boolean),
    build: createIifeBuildConfig({
      outDir: 'extension/dist/ui',
      entry: 'ui/extension/index.tsx',
      name: 'LockInUI',
      fileName: 'index.js',
    }),
    resolve: {
      alias: createAliases({ includeApi: true, includeSharedUi: true }),
    },
  };
});
