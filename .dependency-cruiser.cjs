/**
 * Dependency-cruiser rules for Lock-in architecture boundaries.
 * Keep this aligned with /AGENTS.md and /backend/AGENTS.md.
 */

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-circular-dependencies',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'no-orphan-modules',
      severity: 'warn',
      from: { orphan: true, pathNot: '(test|spec|__tests__|fixtures|mocks)' },
      to: {},
    },
    {
      name: 'no-deprecated-core-imports',
      severity: 'error',
      from: {},
      to: { path: 'core/deprecated/' },
    },
    {
      name: 'core-no-api-imports',
      comment: 'Core must not depend on the api client layer.',
      severity: 'error',
      from: {
        path: '^core/',
        pathNot: '(__tests__|\\.test\\.|\\.spec\\.)',
      },
      to: {
        path: '^api/',
      },
    },
    {
      name: 'core-api-no-platform-deps',
      comment: 'core/api must stay platform-agnostic (no backend, extension, UI, or integrations).',
      severity: 'error',
      from: {
        path: '^(core|api)/',
        pathNot: '(__tests__|\\.test\\.|\\.spec\\.)',
      },
      to: {
        path: '^(backend|extension|ui|integrations|shared/ui)/',
      },
    },
    {
      name: 'integrations-no-platform-or-backend',
      comment: 'Integrations are DOM-only adapters; no backend/api/extension/UI imports.',
      severity: 'error',
      from: {
        path: '^integrations/',
        pathNot: '(__tests__|\\.test\\.|\\.spec\\.)',
      },
      to: {
        path: '^(backend|api|extension|ui|shared/ui)/',
      },
    },
    {
      name: 'integrations-no-network-clients',
      comment: 'Integrations must not make network calls directly.',
      severity: 'error',
      from: {
        path: '^integrations/',
        pathNot: '(__tests__|\\.test\\.|\\.spec\\.)',
      },
      to: {
        path: 'node_modules/(axios|node-fetch|undici|got|superagent)',
      },
    },
    {
      name: 'backend-no-frontend-imports',
      comment: 'Backend must not depend on api/extension/UI/integrations.',
      severity: 'error',
      from: {
        path: '^backend/',
        pathNot: '(__tests__|\\.test\\.|\\.spec\\.)',
      },
      to: {
        path: '^(api|extension|ui|integrations|shared/ui)/',
      },
    },
    {
      name: 'extension-no-backend-imports',
      comment: 'Extension must not depend on backend.',
      severity: 'error',
      from: {
        path: '^extension/',
        pathNot: '(__tests__|\\.test\\.|\\.spec\\.)',
      },
      to: {
        path: '^backend/',
      },
    },
    {
      name: 'ui-no-backend-imports',
      comment: 'UI must not depend on backend.',
      severity: 'error',
      from: {
        path: '^ui/',
        pathNot: '(__tests__|\\.test\\.|\\.spec\\.)',
      },
      to: {
        path: '^backend/',
      },
    },
    {
      name: 'ui-no-extension-imports',
      comment: 'UI must not depend on extension.',
      severity: 'error',
      from: {
        path: '^ui/',
        pathNot: '(__tests__|\\.test\\.|\\.spec\\.)',
      },
      to: {
        path: '^extension/',
      },
    },
    {
      name: 'ui-no-integrations-imports',
      comment: 'UI should not depend on integrations (warn-first).',
      severity: 'warn',
      from: {
        path: '^ui/',
        pathNot: '(__tests__|\\.test\\.|\\.spec\\.)',
      },
      to: {
        path: '^integrations/',
      },
    },
    {
      name: 'backend-routes-no-services-repos-providers-db',
      comment: 'Routes wire HTTP only; no services/repos/providers/db imports.',
      severity: 'error',
      from: {
        path: '^backend/routes/',
        pathNot: '(__tests__|\\.test\\.|\\.spec\\.)',
      },
      to: {
        path: '^backend/(services|repositories|providers|db)/',
      },
    },
    {
      name: 'backend-controllers-no-repos-providers-db',
      comment: 'Controllers must call services only (no repos/providers/db/routes).',
      severity: 'error',
      from: {
        path: '^backend/controllers/',
        pathNot: '(__tests__|\\.test\\.|\\.spec\\.)',
      },
      to: {
        path: '^backend/(repositories|providers|db|routes)/',
      },
    },
    {
      name: 'backend-services-no-controllers-routes-middleware',
      comment: 'Services orchestrate business logic; no controllers/routes/middleware.',
      severity: 'error',
      from: {
        path: '^backend/services/',
        pathNot: '(__tests__|\\.test\\.|\\.spec\\.)',
      },
      to: {
        path: '^backend/(controllers|routes|middleware)/',
      },
    },
    {
      name: 'backend-repositories-no-upstream-layers',
      comment: 'Repositories must not import services/controllers/providers.',
      severity: 'error',
      from: {
        path: '^backend/repositories/',
        pathNot: '(__tests__|\\.test\\.|\\.spec\\.)',
      },
      to: {
        path: '^backend/(services|controllers|routes|providers|middleware)/',
      },
    },
    {
      name: 'backend-providers-no-upstream-layers',
      comment: 'Providers must not import services/controllers/repos/db.',
      severity: 'error',
      from: {
        path: '^backend/providers/',
        pathNot: '(__tests__|\\.test\\.|\\.spec\\.)',
      },
      to: {
        path: '^backend/(services|controllers|routes|repositories|db|middleware)/',
      },
    },
    /* Note: File size limits are enforced by ESLint (max-lines: 500, complexity: 20)
     * and AGENTS.md guidelines. dependency-cruiser focuses on architectural boundaries. */
  ],
  options: {
    doNotFollow: {
      path: 'node_modules|dist|build|coverage|\\.git|extension/dist|backend/tmp|__tests__|__mocks__|\\.test\\.(js|ts|tsx)$|\\.spec\\.(js|ts|tsx)$',
    },
    includeOnly: '^(core|api|backend|extension|integrations|shared|ui|scripts|tools)/',
    tsConfig: {
      fileName: 'tsconfig.json',
    },
    enhancedResolveOptions: {
      extensions: ['.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx', '.json'],
      mainFields: ['module', 'main', 'browser'],
      conditionNames: ['import', 'require', 'node', 'default'],
    },
  },
};
