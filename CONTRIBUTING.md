# Contributing to Lock-in

Thank you for your interest in contributing to Lock-in! This document provides guidelines and instructions for contributing.

## Getting Started

1. **Read the documentation**:
   - [README.md](README.md) - Project overview
   - [AGENTS.md](AGENTS.md) - Development guidelines and architecture rules
   - [docs/README.md](docs/README.md) - Documentation structure

2. **Set up your development environment**:
   - Follow [docs/setup/LOCAL_SUPABASE_SETUP.md](docs/setup/LOCAL_SUPABASE_SETUP.md) for local development
   - Ensure you have Node.js 18+ installed
   - Install dependencies: `npm install`

3. **Understand the architecture**:
   - Review [docs/architecture/ARCHITECTURE.md](docs/architecture/ARCHITECTURE.md) for system design
   - Check [CODE_OVERVIEW.md](CODE_OVERVIEW.md) for implementation details

## Development Workflow

### Git Workflow (Bulletproof Approach)

We follow a **protected main branch** workflow to ensure code quality:

```
main (protected) ← Pull Requests only
  ↑
  └── feature/your-feature ← Work here
```

**Workflow:**

1. **Create a feature branch**:

   ```bash
   git checkout main
   git pull origin main
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** (following the rules below)

3. **Run full validation before pushing**:

   ```bash
   npm run validate   # Format check + type-check + lint + test + build + verify
   ```

4. **Push and create a PR**:

   ```bash
   git push origin feature/your-feature-name
   gh pr create   # or use GitHub web interface
   ```

5. **Wait for CI checks** to pass, then request review

6. **Merge via PR** (squash or rebase merge recommended)

**Branch Protection Rules:**

- ✅ All PRs require at least 1 approval
- ✅ CI checks must pass (refactor-gate, tests)
- ✅ Branch must be up to date before merging
- ❌ Direct pushes to `main` are blocked
- ❌ Force pushes to `main` are forbidden

**Pre-push Hook:**
A pre-push hook automatically runs validation before pushing. If it fails, fix the issues first.

### Before Making Changes

1. **Check current status**: Review [docs/tracking/STATUS.md](docs/tracking/STATUS.md) for outstanding issues
2. **Review refactor plan**: Check [docs/tracking/REFACTOR_PLAN.md](docs/tracking/REFACTOR_PLAN.md) for planned improvements
3. **Follow coding rules**: See [AGENTS.md](AGENTS.md) for architecture boundaries and coding standards

### Making Changes

1. **Create a feature branch**: `git checkout -b feature/your-feature-name`
2. **Follow the core loop**: Capture → Understand → Distil → Organise → Act
3. **Respect separation**:
   - Extension code in `/extension`
   - Shared code in `/core` and `/api` (NO Chrome APIs)
   - Site-specific logic in `/integrations/adapters`
4. **Write tests**: Add tests for new functionality
5. **Update documentation**:
   - Update `CODE_OVERVIEW.md` if file structure changes
   - Update `DATABASE.md` if schema changes
   - Update relevant docs in `docs/` folder

### Code Style

- **Functional**: Prefer functional components and hooks
- **Typed**: Use strict TypeScript, define types in `core/domain`
- **Clean**: Keep files <200 lines, single responsibility
- **D.R.Y**: Extract shared logic to `/core` hooks or services

See [AGENTS.md](AGENTS.md) for detailed coding rules.

### Testing

- Run tests: `npm run test`
- Type check: `npm run type-check`
- Lint: `npm run lint`
- Build: `npm run build`
- Full check: `npm run check`

### Submitting Changes

1. **Ensure all checks pass**: `npm run check`
2. **Update CHANGELOG.md**: Add entry for your changes
3. **Write clear commit messages**: Follow conventional commits format
4. **Create a pull request**:
   - Describe what changed and why
   - Reference related issues
   - Include screenshots for UI changes

## Documentation

When adding or updating documentation:

1. **Place in appropriate folder**:
   - Architecture: `docs/architecture/`
   - Setup guides: `docs/setup/`
   - Feature docs: `docs/features/[feature-name]/`
   - Testing: `docs/testing/`
   - Tracking: `docs/tracking/`

2. **Update docs/README.md**: Add entry to relevant section

3. **Cross-reference**: Link to related documentation

4. **Follow naming**: Use lowercase `.md` extension, descriptive names

## Adding New Features

### Adding a New Site Integration

1. Create adapter: `/integrations/adapters/newSiteAdapter.ts`
2. Implement `BaseAdapter` interface
3. Register in `/integrations/index.ts`
4. Test on the site
5. Document in relevant docs

### Adding a New Extension UI Feature

1. Create component in `/ui/extension`
2. Add hook if needed
3. Integrate into `LockInSidebar.tsx`
4. Style with Tailwind CSS

### Adding a New API Endpoint

1. Add to API client: `/api/client.ts` or specific resource file
2. Add types: `/core/domain/types.ts`
3. Use in service: `/core/services/` or directly in hooks
4. Handle errors consistently

## Questions?

- Check [AGENTS.md](AGENTS.md) for development guidelines
- Review [docs/tracking/STATUS.md](docs/tracking/STATUS.md) for current status
- Ask in issues or discussions

## Code of Conduct

- Be respectful and inclusive
- Provide constructive feedback
- Help others learn and grow
- Follow the project's coding standards

Thank you for contributing to Lock-in! 🚀
