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
    // CI/CD optimizations
    pool: 'threads',
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
