# Monorepo Architecture

Lock-in uses **npm workspaces** to manage the extension and backend as separate packages within a single repository.

## Structure

```
lock-in/
├── package.json          # Root package (workspace coordinator)
├── .npmrc                # npm configuration
├── backend/
│   ├── package.json      # Backend workspace
│   └── eslint.config.js  # Backend-specific ESLint config
├── core/                 # Shared core logic
├── ui/                   # Shared UI components
└── extension/            # Extension-specific code
```

## Workspaces

- **Root**: Contains extension code and shared tooling (ESLint, Prettier, TypeScript, Vite)
- **Backend**: Node.js Express server with its own runtime dependencies

## Development

### Installing Dependencies

```bash
# Install all dependencies for all workspaces
npm install

# Or for deterministic CI-like installs
npm ci
```

This single command installs dependencies for both root and backend workspaces automatically.

### Running Commands

#### Extension Commands

```bash
npm run dev              # Start extension dev server
npm run build            # Build extension
npm test                 # Run extension tests
npm run lint             # Lint extension code
```

#### Backend Commands

```bash
npm run dev:backend      # Start backend dev server
npm run test:backend     # Run backend tests
npm run lint:backend     # Lint backend code
```

#### All Workspaces

```bash
npm run lint:all         # Lint everything
npm run test:all         # Test everything
npm run check            # Full validation (lint + test + type-check + build)
```

### Adding Dependencies

```bash
# Add to root (extension)
npm install <package>

# Add to backend workspace
npm install <package> --workspace=backend

# Add dev dependency to root (shared tooling like ESLint, Prettier)
npm install -D <package>
```

## Best Practices

1. **Shared devDependencies** (ESLint, Prettier, TypeScript) go in root
2. **Runtime dependencies** specific to backend go in backend workspace
3. **Extension dependencies** go in root package.json
4. Always run `npm install` from root directory

## CI/CD

CI workflows install dependencies with `npm ci` at root level, which automatically handles all workspaces. No need to install dependencies separately for each workspace.

## Troubleshooting

### "Cannot find module" errors in CI

- Ensure root package.json has `"workspaces": ["backend"]` configuration
- Run `npm ci` at root, not in individual workspaces
- Backend's ESLint/Prettier will be resolved from root's node_modules

### Lint/format commands don't work in backend

- Backend uses shared ESLint/Prettier from root
- Backend has its own `eslint.config.js` but ESLint binary comes from root
- Run `npm install` at root if tools are missing

### Version conflicts

- Use `npm ls <package>` to check where dependencies are installed
- Ensure devDependencies (like ESLint, Prettier) are only in root
- Runtime dependencies can be in both root and backend if needed

## Migration Notes

If you have an existing checkout, you may need to clean and reinstall:

```bash
# Clean everything
npm run clean         # Removes all node_modules

# Fresh install
npm install
```
