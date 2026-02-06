import path from 'node:path';
import { fileURLToPath } from 'node:url';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import importPlugin from 'eslint-plugin-import';
import prettierConfig from 'eslint-config-prettier';

const tsconfigRootDir = path.dirname(fileURLToPath(import.meta.url));

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
  {
    files: ['**/*.{js,mjs,cjs,ts,tsx}'],
    rules: {
      'max-lines': [
        'warn',
        {
          max: 300,
          skipBlankLines: true,
          skipComments: true,
        },
      ],
      'max-lines-per-function': [
        'warn',
        {
          max: 50,
          skipBlankLines: true,
          skipComments: true,
        },
      ],
      complexity: ['warn', 12],
      'max-depth': ['warn', 4],
      'max-nested-callbacks': ['warn', 3],
      'max-params': ['warn', 4],
      'max-statements': ['warn', 20],
      'no-magic-numbers': [
        'warn',
        {
          ignore: [0, 1, -1, 2, 100, 1000],
          ignoreArrayIndexes: true,
          enforceConst: true,
        },
      ],
      'prefer-const': 'warn',
      'no-var': 'warn',
      eqeqeq: ['warn', 'always'],
      curly: ['warn', 'all'],
      'no-else-return': 'warn',
      'no-lonely-if': 'warn',
      'no-unneeded-ternary': 'warn',
      'no-eval': 'warn',
      'no-implied-eval': 'warn',
      'no-new-func': 'warn',
      'no-script-url': 'warn',
      'no-proto': 'warn',
      'no-extend-native': 'warn',
    },
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
        project: './tsconfig.eslint.json',
        tsconfigRootDir,
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
      '@typescript-eslint/no-unsafe-assignment': 'warn',
      '@typescript-eslint/no-unsafe-call': 'warn',
      '@typescript-eslint/no-unsafe-member-access': 'warn',
      '@typescript-eslint/no-unsafe-return': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-misused-promises': 'warn',
      '@typescript-eslint/promise-function-async': 'warn',
      '@typescript-eslint/await-thenable': 'warn',
      '@typescript-eslint/explicit-function-return-type': [
        'warn',
        {
          allowExpressions: true,
          allowTypedFunctionExpressions: true,
        },
      ],
      '@typescript-eslint/strict-boolean-expressions': [
        'warn',
        {
          allowString: false,
          allowNumber: false,
          allowNullableObject: false,
        },
      ],
      '@typescript-eslint/switch-exhaustiveness-check': 'warn',
      '@typescript-eslint/consistent-type-imports': 'warn',
      '@typescript-eslint/consistent-type-exports': 'warn',
      '@typescript-eslint/naming-convention': [
        'warn',
        { selector: 'interface', format: ['PascalCase'], prefix: ['I'] },
        { selector: 'typeAlias', format: ['PascalCase'] },
        { selector: 'enum', format: ['PascalCase'] },
        { selector: 'enumMember', format: ['UPPER_CASE'] },
      ],
      'import/no-duplicates': 'warn',
    },
  },
  // Architectural boundaries:
  // - /core must remain platform-agnostic and independent of other layers (ERROR)
  {
    files: ['core/**/*.{js,mjs,cjs,ts,tsx}'],
    rules: {
      'no-restricted-globals': [
        'error',
        {
          name: 'chrome',
          message: 'Chrome APIs are not allowed in core. Use extension/* wrappers or DI instead.',
        },
        {
          name: 'window',
          message: 'Browser globals are not allowed in core. Core must be platform-agnostic.',
        },
        {
          name: 'document',
          message: 'DOM globals are not allowed in core. Core must be platform-agnostic.',
        },
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '**/api/**',
                '@api/*',
                '**/extension/**',
                '**/backend/**',
                '**/ui/**',
                '**/integrations/**',
                '**/shared/ui/**',
                '@shared/ui',
                '@shared/ui/*',
                'express',
                'react*',
              ],
              message:
                'Core must remain platform-agnostic. No api/backend/extension/ui/integrations imports.',
            },
            {
              group: ['chrome', 'window', 'document'],
              message: 'Core must remain platform-agnostic. No browser globals imports.',
            },
          ],
        },
      ],
    },
  },
  // - /api must remain Chrome-free and extension-independent (ERROR)
  {
    files: ['api/**/*.{js,mjs,cjs,ts,tsx}'],
    rules: {
      'no-restricted-globals': [
        'error',
        {
          name: 'chrome',
          message: 'Chrome APIs are not allowed in api. Use DI instead.',
        },
        {
          name: 'window',
          message: 'Browser globals are not allowed in api. Api must be platform-agnostic.',
        },
        {
          name: 'document',
          message: 'DOM globals are not allowed in api. Api must be platform-agnostic.',
        },
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '**/backend/**',
                '**/extension/**',
                '**/ui/**',
                '**/integrations/**',
                '**/shared/ui/**',
                '@shared/ui',
                '@shared/ui/*',
                'express',
                'react*',
              ],
              message:
                'Api must remain Chrome-free, UI-free, and backend-agnostic (pure logic only).',
            },
            {
              group: ['chrome', 'window', 'document'],
              message: 'Api must remain platform-agnostic. No browser globals imports.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['backend/services/**/*.js'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/controllers/**', '**/routes/**', '**/middleware/**'],
              message: 'Services cannot import controllers/routes/middleware (layer violation).',
            },
            {
              group: ['express'],
              message: 'Services must not depend on Express (HTTP concern).',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['backend/controllers/**/*.js'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/repositories/**', '**/providers/**', '**/db/**'],
              message: 'Controllers must call services only (no direct repo/provider/db access).',
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
      'no-restricted-imports': 'off',
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
              group: ['**/api/**', '**/extension/**', '**/ui/**', '**/integrations/**', 'chrome'],
              message: 'Backend cannot import api/frontend/extension code.',
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

  // - /extension should prefer path aliases over deep relative imports (WARN-first)
  {
    files: ['extension/**/*.{js,mjs,cjs,ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'warn',
        {
          patterns: [
            {
              group: ['**/backend/**'],
              message: 'Extension cannot import backend code.',
            },
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

  // - /ui should avoid backend/extension/integrations + prefer path aliases (WARN-first)
  {
    files: ['ui/**/*.{js,mjs,cjs,ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'warn',
        {
          patterns: [
            {
              group: ['**/backend/**', '**/extension/**', '**/integrations/**'],
              message: 'UI cannot import backend/extension/integrations code.',
            },
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
  {
    files: ['**/__tests__/**/*.{js,mjs,cjs,ts,tsx}', '**/*.{test,spec}.{js,mjs,cjs,ts,tsx}'],
    rules: {
      'max-lines': 'off',
      complexity: 'off',
    },
  },
  prettierConfig,
];
