# Scripts Organization

All developer-facing scripts organized by concern for clarity and discoverability.

## Directory Structure

### `dev/` - Local Development Helpers

Scripts developers run directly during local development.

- **`setup.ps1`** - Initialize local development environment
- **`fix-formatting.ps1`** - Quick formatting fixes
- **`check-doc-links.mjs`** - Validate documentation links

**Usage:**

```bash
npm run dev:setup        # Run setup.ps1
npm run format:fix       # Run fix-formatting.ps1
npm run docs:check-links # Run check-doc-links.mjs
```

### `ci/` - CI/CD Scripts

Scripts called by continuous integration and deployment workflows.

- **`verify-build.js`** - Verify build artifacts
- **`verify-ci-cd.ps1`** - Validate CI/CD configuration
- **`test-build.ps1`** - Test build process

**Usage:**

```bash
npm run verify-build     # Run verify-build.js
npm run ci:verify        # Run verify-ci-cd.ps1
npm run ci:test-build    # Run test-build.ps1
```

### `infra/` - Infrastructure Automation

Scripts for provisioning and configuring infrastructure.

- **`azure-setup.ps1`** - Provision Azure resources
- **`setup-uami.ps1`** - Configure OIDC with Azure
- **`setup-branch-protection.ps1`** - Configure GitHub repository

**Usage:**

```bash
npm run infra:setup                  # Run azure-setup.ps1
npm run infra:setup-oidc             # Run setup-uami.ps1
npm run infra:setup-branch-protection # Run setup-branch-protection.ps1
```

### `tools/` - Development Tools Setup

Scripts for setting up development tools and utilities.

- **`mcp-setup-env.ps1`** - Setup MCP server environment (Windows)
- **`mcp-setup-env.sh`** - Setup MCP server environment (Unix)
- **`validate-mcp-setup.ps1`** - Validate MCP configuration

**Usage:**

```bash
pwsh ./scripts/tools/mcp-setup-env.ps1
pwsh ./scripts/tools/validate-mcp-setup.ps1
```

## Best Practices

1. **Thin Scripts**: Keep scripts small, focused on parameter parsing and calling functions
2. **Reusable Logic**: Extract complex logic into `tools/internal/` as TypeScript modules
3. **Naming**: Use verb-first names (e.g., `setup-*`, `verify-*`, `check-*`)
4. **Documentation**: Add header comments explaining purpose, prerequisites, and usage
5. **npm Scripts**: Wire scripts through package.json for discoverability

## Adding New Scripts

1. **Identify the concern**:
   - Developer utility? → `dev/`
   - CI/CD automation? → `ci/`
   - Infrastructure? → `infra/`
   - Tool setup? → `tools/`

2. **Use verb-first naming**: `action-subject.ext` (e.g., `validate-config.ps1`)

3. **Add to package.json** if appropriate for discoverability

4. **Document** in this README

## Common Workflows

### Local Development Setup

```bash
# Initial setup
npm run dev:setup

# Fix formatting after changes
npm run format:fix

# Validate documentation
npm run docs:check-links
```

### CI/CD Verification

```bash
# Verify CI/CD configuration
npm run ci:verify

# Test build process
npm run ci:test-build

# Full validation suite
npm run validate
```

### Infrastructure Provisioning

```bash
# Setup Azure resources
npm run infra:setup

# Configure OIDC
npm run infra:setup-oidc

# Setup branch protection
npm run infra:setup-branch-protection
```
