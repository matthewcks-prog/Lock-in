/**
 * ESLint Configuration for Backend
 *
 * This configuration enforces code quality and prevents common issues,
 * including the test file naming convention that caused CI/CD failures.
 */

module.exports = {
  env: {
    node: true,
    es2022: true,
  },
  extends: ['eslint:recommended'],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  rules: {
    // Enforce consistent code style
    'no-console': 'off', // Allow console in backend
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],

    // Prevent common errors
    'no-undef': 'error',
    'no-unreachable': 'error',
    'no-constant-condition': 'warn',
  },
  overrides: [
    {
      // Test files
      files: ['**/*.test.js'],
      env: {
        node: true,
      },
      rules: {
        'no-undef': 'off', // Test globals like 'test', 'describe'
      },
    },
    {
      // Prevent test- prefix for non-test files
      files: ['test-*.js', '!**/*.test.js'],
      rules: {
        'no-restricted-syntax': [
          'error',
          {
            selector: 'Program',
            message:
              '❌ Files starting with "test-" are picked up by the test runner. ' +
              'Rename utility scripts to use prefixes like "verify-", "check-", "setup-", etc. ' +
              'Example: test-embeddings.js → verify-embeddings.js',
          },
        ],
      },
    },
  ],
};
