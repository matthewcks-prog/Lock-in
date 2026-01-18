import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';
import { createOptionalDependencyAliases } from './build/viteShared';

export default defineConfig({
  resolve: {
    alias: [
      ...createOptionalDependencyAliases(),
      { find: '@core', replacement: resolve(process.cwd(), 'core') },
      { find: '@api', replacement: resolve(process.cwd(), 'api') },
      { find: '@shared/ui', replacement: resolve(process.cwd(), 'shared/ui') },
      { find: '@ui', replacement: resolve(process.cwd(), 'ui') },
    ],
  },
  test: {
    environment: 'jsdom',
    include: ['**/__tests__/**/*.test.{ts,tsx}', '**/__tests__/**/*.test.js'],
    exclude: ['**/node_modules/**', 'backend/**', 'extension/dist/**', 'dist/**'],
    globals: true,
    restoreMocks: true,
    clearMocks: true,
    // CI/CD optimizations
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
      },
    },
    // Ensure tests run headless (default behavior)
    watch: false,
  },
});
