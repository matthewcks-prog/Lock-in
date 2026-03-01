import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';
import { createOptionalDependencyAliases } from './config/vite/shared';

export default defineConfig({
  resolve: {
    alias: [
      ...createOptionalDependencyAliases(),
      { find: '@core', replacement: resolve(process.cwd(), 'core') },
      { find: '@api', replacement: resolve(process.cwd(), 'api') },
      { find: '@shared/ui', replacement: resolve(process.cwd(), 'shared/ui') },
      { find: '@shared/test', replacement: resolve(process.cwd(), 'shared/test') },
      { find: '@ui', replacement: resolve(process.cwd(), 'ui') },
    ],
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['shared/test/setupVitest.ts'],
    include: ['**/__tests__/**/*.test.{ts,tsx}', '**/__tests__/**/*.test.js'],
    exclude: [
      '**/node_modules/**',
      'backend/**',
      'extension/dist/**',
      'dist/**',
      // Backend integration tests - run separately with backend's test runner
      // These require backend dependencies (openai, @supabase/supabase-js)
      '**/backendOpenaiPrompt.test.ts',
      '**/backendChatPagination.test.ts',
      '**/backendAssistantController.test.ts',
    ],
    globals: true,
    restoreMocks: true,
    clearMocks: true,
    // Tests that do vi.resetModules() + dynamic import (initApiSurface,
    // uiSurface) can be slow when all 60+ workers compile TypeScript in
    // parallel on the same thread pool.  A global timeout of 60 s gives
    // headroom, and capping worker threads reduces CPU contention without
    // meaningfully increasing wall-clock time on sequential test files.
    testTimeout: 60000,
    // CI/CD optimizations
    pool: 'threads',
    poolOptions: {
      threads: {
        maxThreads: 8,
        minThreads: 2,
        useAtomics: true,
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      thresholds: {
        statements: 35,
        branches: 25,
        functions: 30,
        lines: 35,
      },
    },
    // Ensure tests run headless (default behavior)
    watch: false,
  },
});
