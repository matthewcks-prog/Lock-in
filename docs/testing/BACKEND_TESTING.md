# Backend Testing Guide

This guide documents testing standards and conventions for the Lock-in backend to ensure consistent test practices and prevent CI/CD issues.

## Quick Reference

```bash
npm test              # Run all unit tests
npm run test:ci       # CI-specific test command (same as npm test)
npm run test:azure    # Verify Azure embeddings configuration (manual utility)
```

## Test File Naming Conventions

### ✅ DO: Unit Test Files

Unit test files MUST use the `.test.js` suffix:

```
✅ chatRepository.test.js
✅ validation.test.js
✅ assetValidation.test.js
✅ controllers/__tests__/assistantTitle.test.js
```

**Why?** The Node.js test runner is configured to ONLY run files matching `**/*.test.js` pattern. This ensures:

- Only actual tests are executed in CI/CD
- Utility scripts don't interfere with test runs
- Clear distinction between tests and utilities

### ❌ DON'T: Test-Prefixed Utility Scripts

Utility/verification scripts should NEVER start with `test-`:

```
❌ test-embeddings.js       → ✅ verify-embeddings.js
❌ test-azure-direct.js     → ✅ verify-azure-embeddings.js
❌ test-setup.js            → ✅ setup-helper.js
```

**Why?** The `test-*` prefix makes scripts look like tests, which can cause:

- CI/CD failures when scripts make actual API calls
- Confusion about what is a test vs. a utility
- Accidental execution by test runners

### Recommended Utility Prefixes

Use these prefixes for non-test scripts:

- `verify-*` - Verification/validation scripts (e.g., `verify-azure-embeddings.js`)
- `check-*` - Checker scripts (e.g., `check-syntax.js`)
- `setup-*` - Setup scripts (e.g., `setup-database.js`)
- `migrate-*` - Migration scripts (e.g., `migrate-data.js`)
- `generate-*` - Code generation scripts (e.g., `generate-types.js`)

## Test Structure

### Unit Tests

Unit tests use Node.js built-in test runner (`node:test`):

```javascript
// Example: chatRepository.test.js
const test = require('node:test');
const assert = require('node:assert/strict');

// Setup test environment
process.env.NODE_ENV = 'development';
process.env.SUPABASE_URL_DEV = process.env.SUPABASE_URL_DEV || 'https://example.supabase.test';
process.env.SUPABASE_SERVICE_ROLE_KEY_DEV = process.env.SUPABASE_SERVICE_ROLE_KEY_DEV || 'test-key';

const { updateChatTitle } = require('./chatRepository');

test('updateChatTitle updates the chat row for the user', async (t) => {
  // Mock dependencies
  const mockSupabase = {
    /* ... */
  };

  // Test logic
  const result = await updateChatTitle('chat-123', 'user-456', 'New Title');

  // Assertions
  assert.strictEqual(result.title, 'New Title');
});
```

**Key principles:**

- ✅ Mock external dependencies (Supabase, OpenAI, file system)
- ✅ Test one thing per test
- ✅ Use descriptive test names
- ✅ Set up test-specific environment variables
- ✅ Clean up after tests with `t.after()`

### Utility Scripts

Utility scripts are for manual verification and should:

```javascript
// Example: verify-azure-embeddings.js
require('dotenv').config();
const { createEmbeddingsClient } = require('./providers/embeddingsFactory');

console.log('🧪 Testing Azure OpenAI embeddings...');

(async () => {
  try {
    const client = createEmbeddingsClient({
      azureApiKey: process.env.AZURE_OPENAI_API_KEY,
      azureEndpoint: process.env.AZURE_OPENAI_ENDPOINT,
      // ... config
    });

    const result = await client.createEmbeddings('Test text');
    console.log('✅ Embeddings working!', result);
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed:', error.message);
    process.exit(1);
  }
})();
```

**Key differences from tests:**

- ❌ NOT run by test runner
- ✅ Make actual API calls
- ✅ Require real credentials
- ✅ Exit with process.exit()
- ✅ Used for manual verification only

## Test Configuration

### package.json Scripts

```json
{
  "scripts": {
    "test": "node --test **/*.test.js --test-reporter=spec",
    "test:ci": "node --test **/*.test.js --test-reporter=spec",
    "test:azure": "node verify-azure-embeddings.js"
  }
}
```

**Pattern explanation:**

- `**/*.test.js` - Glob pattern matching all `.test.js` files recursively
- `--test-reporter=spec` - Detailed test output format
- Separate scripts for utility verification

### CI/CD Environment Variables

Tests in CI require environment variables:

```yaml
# .github/workflows/backend-deploy.yml
- name: Run backend tests
  working-directory: backend
  env:
    NODE_ENV: test
    SUPABASE_URL_DEV: ${{ secrets.SUPABASE_URL_DEV || 'https://example.supabase.test' }}
    SUPABASE_SERVICE_ROLE_KEY_DEV: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY_DEV || 'test-service-role-key' }}
    OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY || 'test-openai-key' }}
  run: npm run test:ci
```

**Key practices:**

- ✅ Set `NODE_ENV=test` for test runs
- ✅ Provide fallback values for required env vars (secrets may not exist)
- ✅ Use test-specific values, never production
- ✅ Use `test:ci` script (not `test:azure` or utility scripts)

## Common Pitfalls & Solutions

### Issue: Tests picked up by test runner

**Problem:**

```bash
$ npm test
❌ Error: Process completed with exit code 1
# Utility script tried to make API calls and failed
```

**Solution:**
Rename the file from `test-*.js` to `verify-*.js` or similar:

```bash
mv test-embeddings.js verify-embeddings.js
```

Update package.json:

```json
"scripts": {
  "test:embeddings": "node verify-embeddings.js"  // NOT "test-embeddings.js"
}
```

### Issue: CI tests fail but pass locally

**Problem:** Different environment variables or missing mocks.

**Solution:**

1. Check CI logs for specific error
2. Ensure test mocks ALL external dependencies
3. Verify environment variables are set in CI workflow
4. Run tests with CI-like environment:
   ```bash
   NODE_ENV=test npm run test:ci
   ```

### Issue: Test names not descriptive

**Problem:**

```javascript
test('test 1', () => {
  /* ... */
}); // ❌ Not helpful
```

**Solution:**

```javascript
test('updateChatTitle updates the chat row for the user', () => {
  /* ... */
}); // ✅ Clear
test('rejects files over the size limit', () => {
  /* ... */
}); // ✅ Specific
```

## Adding New Tests

### Checklist

When adding a new test file:

- [ ] File name ends with `.test.js`
- [ ] Located near the code it tests (same directory or `__tests__/` subdirectory)
- [ ] Uses `node:test` and `node:assert/strict`
- [ ] Mocks all external dependencies (Supabase, OpenAI, file system, network)
- [ ] Sets up test environment variables at top of file
- [ ] Test names are descriptive and specify what is being tested
- [ ] Runs successfully with `npm test`
- [ ] Runs successfully in CI (check after pushing)

### Example Directory Structure

```
backend/
├── chatRepository.js
├── chatRepository.test.js           ✅ Test next to code
├── utils/
│   ├── validation.js
│   └── validation.test.js           ✅ Test next to code
├── controllers/
│   └── __tests__/                   ✅ Tests in __tests__ subdirectory
│       ├── assistantTitle.test.js
│       └── transcriptsController.test.js
├── scripts/
│   ├── verify-azure-embeddings.js   ✅ Utility with verify- prefix
│   └── check-syntax.js              ✅ Utility with check- prefix
└── package.json
```

## Resources

- [Node.js Test Runner Docs](https://nodejs.org/docs/latest/api/test.html)
- [Backend README.md](../../backend/README.md#testing) - Quick test commands
- [Backend Testing Section in CODE_OVERVIEW.md](../reference/CODE_OVERVIEW.md#testing-strategy)

## Questions?

If you're unsure whether something should be a test or a utility script:

**Is it a test if:**

- ✅ It validates specific behavior of a function/module
- ✅ It should run on every commit in CI/CD
- ✅ It uses mocks and doesn't require real API credentials
- ✅ It's fully automated and deterministic

**Is it a utility if:**

- ✅ It verifies external service configuration (Azure, OpenAI)
- ✅ It requires real API credentials
- ✅ It's for manual verification/debugging
- ✅ It makes actual API calls to production services
