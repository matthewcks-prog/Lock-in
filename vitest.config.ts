import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@core': resolve(process.cwd(), 'core'),
      '@api': resolve(process.cwd(), 'api'),
      '@shared/ui': resolve(process.cwd(), 'shared/ui'),
      '@ui': resolve(process.cwd(), 'ui'),
    },
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
