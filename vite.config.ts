import { defineConfig, loadEnv, type PluginOption, type UserConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import { resolve } from 'path';
import {
  createAliases,
  createDefines,
  createIifeBuildConfig,
  createOptionalDependencyAliases,
  ensureAsciiSafeOutput,
} from './build/viteShared';

function hasNonEmptyValue(value: string | undefined): value is string {
  return value !== undefined && value.length > 0;
}

function resolveReleaseVersion(): string {
  const packageVersion = process.env.npm_package_version;
  return packageVersion !== undefined && packageVersion.length > 0 ? packageVersion : '1.0.0';
}

function createAliasEntries(): Array<{ find: string | RegExp; replacement: string }> {
  const baseAliases = createAliases({ includeApi: true, includeSharedUi: true });
  const optionalAliases = createOptionalDependencyAliases();
  return [
    ...optionalAliases,
    ...Object.entries(baseAliases).map(([find, replacement]) => ({ find, replacement })),
  ];
}

function createBasePlugins(): PluginOption[] {
  return [
    react({
      jsxRuntime: 'automatic',
    }),
    ensureAsciiSafeOutput(
      resolve(process.cwd(), 'extension/dist/ui/index.js'),
      'Processed output file for ASCII compatibility',
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
          // Upload source maps but delete them after (don't ship to users)
          filesToDeleteAfterUpload: ['extension/dist/**/*.map'],
        },
        telemetry: false, // Disable Sentry's own telemetry
      }),
    );
  }
}

function buildUiViteConfig(mode: string): UserConfig {
  // Align NODE_ENV with Vite mode so React's JSX transform and runtime match.
  process.env.NODE_ENV = mode === 'development' ? 'development' : 'production';

  const env = loadEnv(mode, process.cwd(), '');
  const releaseVersion = resolveReleaseVersion();
  const aliasEntries = createAliasEntries();
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
    define: createDefines(mode),
    esbuild: {
      jsxDev: mode === 'development',
    },
    css: {
      postcss: './postcss.config.js',
    },
    plugins,
    build: createIifeBuildConfig({
      outDir: 'extension/dist/ui',
      entry: 'ui/extension/index.tsx',
      name: 'LockInUI',
      fileName: 'index.js',
    }),
    resolve: {
      alias: aliasEntries,
    },
  };
}

export default defineConfig(({ mode }) => buildUiViteConfig(mode));
