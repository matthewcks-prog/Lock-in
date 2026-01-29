import tseslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import importPlugin from 'eslint-plugin-import';
import prettierConfig from 'eslint-config-prettier';

/** @type {import('eslint').Linter.FlatConfig[]} */
export default [
  {
    ignores: [
      '**/node_modules/**',
      'extension/dist/**',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
    ],
  },

  // Legacy globals guardrail: prefer canonical LockInContent runtime
  {
    files: ['extension/**/*.{js,mjs,cjs,ts,tsx}'],
    ignores: ['extension/src/contentRuntime.ts'],
    rules: {
      'no-restricted-properties': [
        'error',
        {
          object: 'Storage',
          property: 'getLocal',
          message: 'Use window.LockInContent.storage.getLocal instead of legacy Storage.getLocal.',
        },
        {
          object: 'Storage',
          property: 'setLocal',
          message: 'Use window.LockInContent.storage.setLocal instead of legacy Storage.setLocal.',
        },
        {
          object: 'Storage',
          property: 'removeLocal',
          message:
            'Use window.LockInContent.storage.removeLocal instead of legacy Storage.removeLocal.',
        },
        {
          object: 'MessageTypes',
          property: 'GET_TAB_ID',
          message:
            'Use window.LockInContent.messaging.types.GET_TAB_ID instead of legacy MessageTypes.',
        },
        {
          object: 'LockInContent',
          property: 'Storage',
          message: 'Legacy compat shim removed. Use window.LockInContent.storage.* instead.',
        },
        {
          object: 'LockInContent',
          property: 'MessageTypes',
          message: 'Legacy compat shim removed. Use window.LockInContent.messaging.types instead.',
        },
      ],
    },
  },
  {
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        chrome: 'readonly',
        browser: 'readonly',
        window: 'readonly',
        document: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
      },
    },
    plugins: {
      import: importPlugin,
    },
    rules: {
      'import/no-duplicates': 'warn',
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
      globals: {
        chrome: 'readonly',
        browser: 'readonly',
        window: 'readonly',
        document: 'readonly',
        console: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      import: importPlugin,
    },
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      'import/no-duplicates': 'warn',
    },
  },
  // Architectural boundaries:
  // - /core and /api must remain Chrome-free and extension-independent (ERROR)
  // Architectural boundaries:
  // - /core and /api must remain Chrome-free and extension-independent (ERROR)
  {
    files: ['core/**/*.{js,mjs,cjs,ts,tsx}', 'api/**/*.{js,mjs,cjs,ts,tsx}'],
    rules: {
      'no-restricted-globals': [
        'error',
        {
          name: 'chrome',
          message:
            'Chrome APIs are not allowed in core/api. Use extension/* wrappers or DI instead.',
        },
        {
          name: 'window',
          message: 'Browser globals are not allowed in core/api. Core must be platform-agnostic.',
        },
        {
          name: 'document',
          message: 'DOM globals are not allowed in core/api. Core must be platform-agnostic.',
        },
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/extension/**', '**/backend/**', 'express', 'react', 'react-dom'],
              message:
                'core/api must remain Chrome-free, UI-free, and backend-agnostic (pure logic only).',
            },
          ],
        },
      ],
    },
  },

  // Exception: Allow DOM globals in core/api test files
  {
    files: [
      'core/**/__tests__/**/*.{js,mjs,cjs,ts,tsx}',
      'api/**/__tests__/**/*.{js,mjs,cjs,ts,tsx}',
      'core/**/*.test.{js,mjs,cjs,ts,tsx}',
      'api/**/*.test.{js,mjs,cjs,ts,tsx}',
    ],
    rules: {
      'no-restricted-globals': 'off', // Allow document, window, etc. in tests
    },
  },

  // - /integrations (Site Adapters) must be pure DOM parsers (ERROR)
  {
    files: ['integrations/**/*.{js,mjs,cjs,ts,tsx}'],
    rules: {
      'no-restricted-globals': [
        'error',
        {
          name: 'chrome',
          message: 'Chrome APIs are not allowed in integrations. Adapters must be pure functions.',
        },
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/backend/**', '**/api/**', 'axios', 'node-fetch'],
              message:
                'Integrations must not make network calls. They only parse DOM and return data.',
            },
          ],
        },
      ],
    },
  },

  // - /backend must not depend on frontend code (ERROR)
  {
    files: ['backend/**/*.{js,mjs,cjs,ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/extension/**', '**/ui/**', '**/integrations/**', 'chrome'],
              message: 'Backend cannot import frontend/extension code.',
            },
            {
              // Prevent importing core files that might accidentally use browser types in comments/JSDoc validation if strict
              // But core is allowed if it's pure. We'll allow core.
              group: ['chrome'],
              message: 'Backend cannot use Chrome types or APIs.',
            },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        {
          name: 'chrome',
          message: 'Chrome APIs are not allowed in backend.',
        },
        {
          name: 'window',
          message: 'Browser globals are not allowed in backend.',
        },
        {
          name: 'document',
          message: 'DOM globals are not allowed in backend.',
        },
      ],
    },
  },

  // - /ui and /extension should prefer path aliases over deep relative imports (WARN)
  {
    files: ['ui/**/*.{js,mjs,cjs,ts,tsx}', 'extension/**/*.{js,mjs,cjs,ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'warn',
        {
          patterns: [
            {
              group: ['../../../core/*', '../../../../core/*', '../../../../../core/*'],
              message: 'Use @core/* path aliases instead of deep relative imports.',
            },
            {
              group: ['../../../api/*', '../../../../api/*', '../../../../../api/*'],
              message: 'Use @api/* path aliases instead of deep relative imports.',
            },
            {
              group: ['../../../shared/*', '../../../../shared/*', '../../../../../shared/*'],
              message: 'Use @shared/ui* path aliases instead of deep relative imports.',
            },
          ],
        },
      ],
    },
  },

  // Backend-specific configuration
  {
    files: ['backend/**/*.{js,mjs,cjs}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs', // Backend uses CommonJS (require/module.exports)
      globals: {
        process: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        Buffer: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        require: 'readonly',
        module: 'readonly',
        exports: 'readonly',
        global: 'readonly',
        fetch: 'readonly', // Node.js 18+ built-in
        FormData: 'readonly', // Node.js 18+ built-in
        Headers: 'readonly', // Node.js 18+ built-in
        Request: 'readonly', // Node.js 18+ built-in
        Response: 'readonly', // Node.js 18+ built-in
        URL: 'readonly', // Node.js 18+ built-in
        URLSearchParams: 'readonly', // Node.js 18+ built-in
        AbortController: 'readonly', // Node.js 18+ built-in
        AbortSignal: 'readonly', // Node.js 18+ built-in
      },
    },
    rules: {
      'no-console': 'off', // Allow console in backend
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-undef': 'error',
    },
  },
  {
    files: ['backend/**/*.test.js'],
    languageOptions: {
      globals: {
        test: 'readonly',
        describe: 'readonly',
        it: 'readonly',
        before: 'readonly',
        after: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
      },
    },
    rules: {
      'no-undef': 'off', // Test globals
    },
  },
  prettierConfig,
];
