import tseslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import importPlugin from "eslint-plugin-import";

/** @type {import('eslint').Linter.FlatConfig[]} */
export default [
  {
    ignores: [
      "**/node_modules/**",
      "backend/**",
      "extension/dist/**",
      "**/dist/**",
      "**/build/**",
      "**/coverage/**",
    ],
  },

  // Legacy globals guardrail: prefer canonical LockInContent runtime
  {
    files: ["extension/**/*.{js,mjs,cjs,ts,tsx}"],
    ignores: ["extension/src/contentRuntime.ts"],
    rules: {
      "no-restricted-properties": [
        "error",
        {
          object: "Storage",
          property: "getLocal",
          message: "Use window.LockInContent.storage.getLocal instead of legacy Storage.getLocal.",
        },
        {
          object: "Storage",
          property: "setLocal",
          message: "Use window.LockInContent.storage.setLocal instead of legacy Storage.setLocal.",
        },
        {
          object: "Storage",
          property: "removeLocal",
          message:
            "Use window.LockInContent.storage.removeLocal instead of legacy Storage.removeLocal.",
        },
        {
          object: "MessageTypes",
          property: "GET_TAB_ID",
          message:
            "Use window.LockInContent.messaging.types.GET_TAB_ID instead of legacy MessageTypes.",
        },
        {
          object: "LockInContent",
          property: "Storage",
          message: "Legacy compat shim removed. Use window.LockInContent.storage.* instead.",
        },
        {
          object: "LockInContent",
          property: "MessageTypes",
          message: "Legacy compat shim removed. Use window.LockInContent.messaging.types instead.",
        },
      ],
    },
  },
  {
    files: ["**/*.{js,mjs,cjs}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        chrome: "readonly",
        browser: "readonly",
        window: "readonly",
        document: "readonly",
        console: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
      },
    },
    plugins: {
      import: importPlugin,
    },
    rules: {
      "import/no-duplicates": "warn",
    },
  },
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
      globals: {
        chrome: "readonly",
        browser: "readonly",
        window: "readonly",
        document: "readonly",
        console: "readonly",
      },
    },
    plugins: {
      "@typescript-eslint": tseslint,
      import: importPlugin,
    },
    rules: {
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      "import/no-duplicates": "warn",
    },
  },
  // Architectural boundaries:
  // - /core and /api must remain Chrome-free and extension-independent (ERROR)
  {
    files: ["core/**/*.{js,mjs,cjs,ts,tsx}", "api/**/*.{js,mjs,cjs,ts,tsx}"],
    rules: {
      "no-restricted-globals": [
        "error",
        {
          name: "chrome",
          message:
            "Chrome APIs are not allowed in core/api. Use extension/* wrappers instead.",
        },
      ],
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "extension/**",
                "../extension/**",
                "../../extension/**",
                "../../../extension/**",
                "../../../../extension/**",
              ],
              message:
                "core/api must remain Chrome-free and extension-independent.",
            },
          ],
        },
      ],
    },
  },

  // - /ui and /extension should prefer path aliases over deep relative imports (WARN)
  {
    files: [
      "ui/**/*.{js,mjs,cjs,ts,tsx}",
      "extension/**/*.{js,mjs,cjs,ts,tsx}",
    ],
    rules: {
      "no-restricted-imports": [
        "warn",
        {
          patterns: [
            {
              group: [
                "../../../core/*",
                "../../../../core/*",
                "../../../../../core/*",
              ],
              message:
                "Use @core/* path aliases instead of deep relative imports.",
            },
            {
              group: [
                "../../../api/*",
                "../../../../api/*",
                "../../../../../api/*",
              ],
              message:
                "Use @api/* path aliases instead of deep relative imports.",
            },
            {
              group: [
                "../../../shared/*",
                "../../../../shared/*",
                "../../../../../shared/*",
              ],
              message:
                "Use @shared/ui* path aliases instead of deep relative imports.",
            },
          ],
        },
      ],
    },
  },
];
