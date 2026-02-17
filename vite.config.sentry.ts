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

import { defineConfig, loadEnv, type PluginOption, type UserConfig } from 'vite';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import { resolve } from 'path';
import {
  createAliases,
  createDefines,
  createIifeBuildConfig,
  ensureAsciiSafeOutput,
} from './build/viteShared';

function hasNonEmptyValue(value: string | undefined): value is string {
  return value !== undefined && value.length > 0;
}

function resolveReleaseVersion(): string {
  const packageVersion = process.env.npm_package_version;
  return packageVersion !== undefined && packageVersion.length > 0 ? packageVersion : '1.0.0';
}

function createBasePlugins(): PluginOption[] {
  return [
    ensureAsciiSafeOutput(
      resolve(process.cwd(), 'extension/dist/libs/sentry.js'),
      'Processed Sentry bundle for ASCII compatibility',
    ),
  ];
}

function addSentryPluginIfConfigured({
  mode,
  sentryAuthToken,
  sentryOrg,
  sentryProject,
  releaseVersion,
  plugins,
}: {
  mode: string;
  sentryAuthToken?: string;
  sentryOrg?: string;
  sentryProject?: string;
  releaseVersion: string;
  plugins: PluginOption[];
}): void {
  if (
    mode === 'production' &&
    hasNonEmptyValue(sentryAuthToken) &&
    hasNonEmptyValue(sentryOrg) &&
    hasNonEmptyValue(sentryProject)
  ) {
    plugins.push(
      sentryVitePlugin({
        org: sentryOrg,
        project: sentryProject,
        authToken: sentryAuthToken,
        release: {
          name: `lockin-extension@${releaseVersion}`,
        },
        sourcemaps: {
          filesToDeleteAfterUpload: ['extension/dist/libs/sentry.js.map'],
        },
        telemetry: false,
      }),
    );
  }
}

function buildSentryViteConfig(mode: string): UserConfig {
  const env = loadEnv(mode, process.cwd(), '');
  const releaseVersion = resolveReleaseVersion();
  const plugins = createBasePlugins();
  addSentryPluginIfConfigured({
    mode,
    sentryAuthToken: env.SENTRY_AUTH_TOKEN,
    sentryOrg: env.SENTRY_ORG,
    sentryProject: env.SENTRY_PROJECT,
    releaseVersion,
    plugins,
  });

  return {
    define: {
      ...createDefines(mode),
      // Inject Sentry DSN at build time (required for service worker where import.meta doesn't work)
      'import.meta.env.VITE_SENTRY_DSN': JSON.stringify(env.VITE_SENTRY_DSN ?? ''),
    },
    plugins,
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
}

export default defineConfig(({ mode }) => buildSentryViteConfig(mode));
