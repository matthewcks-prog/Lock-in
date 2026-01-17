# Documentation Index

This directory contains organized documentation for the Lock-in project. Documentation is categorized by purpose for easy navigation.

## Structure

### 📐 Architecture & Design
**Location:** `docs/architecture/`

Stable architecture documentation and system design:

- **[ARCHITECTURE.md](architecture/ARCHITECTURE.md)** - Stable architecture invariants (surfaces, boundaries, contracts)
- **[REPO_MAP.md](architecture/REPO_MAP.md)** - Repository structure map and entrypoints

### 🚀 Setup & Deployment
**Location:** `docs/setup/`

Setup guides and deployment documentation:

- **[AZURE_DEPLOYMENT.md](setup/AZURE_DEPLOYMENT.md)** - Azure Container Apps deployment guide
- **[LOCAL_SUPABASE_SETUP.md](setup/LOCAL_SUPABASE_SETUP.md)** - Local Supabase CLI setup guide

### 🎯 Features
**Location:** `docs/features/`

Feature-specific documentation organized by feature area:

#### Transcripts
- **[REVIEW.md](features/transcripts/REVIEW.md)** - Transcript feature code review
- **[SYSTEM_MAP.md](features/transcripts/SYSTEM_MAP.md)** - Transcript system architecture map
- **[TROUBLESHOOTING.md](features/transcripts/TROUBLESHOOTING.md)** - Transcript extraction troubleshooting guide

### 🧪 Testing
**Location:** `docs/testing/`

Testing documentation and checklists:

- **[SMOKE_CHECKLIST.md](testing/SMOKE_CHECKLIST.md)** - Manual smoke test checklist

### 📊 Tracking
**Location:** `docs/tracking/`

Living documentation that tracks project status and progress:

- **[STATUS.md](tracking/STATUS.md)** - Current status, outstanding issues, recent changes
- **[REFACTOR_PLAN.md](tracking/REFACTOR_PLAN.md)** - Phased refactoring plan
- **[PROMPT_LOG.md](tracking/PROMPT_LOG.md)** - Log of refactoring prompts and outcomes

### 📦 Archive
**Location:** `docs/archive/`

Historical documentation and audits:

- **[QUALITY_AUDIT_2025-12-16.md](archive/QUALITY_AUDIT_2025-12-16.md)** - Historical quality audit (December 2025)

## Root Level Documentation

For high-level project documentation, see the root directory:

- **[AGENTS.md](../AGENTS.md)** - Canonical stable contract (architecture boundaries, coding rules, workflow patterns)
- **[CODE_OVERVIEW.md](../CODE_OVERVIEW.md)** - Current codebase snapshot (implementation details)
- **[DATABASE.md](../DATABASE.md)** - Database schema and migration history
- **[README.md](../README.md)** - Project overview and getting started guide

## Documentation Hierarchy

**Stable Contracts** (rarely change):
- `/AGENTS.md`
- `docs/architecture/ARCHITECTURE.md`

**Living Snapshots** (updated frequently):
- `docs/tracking/STATUS.md`
- `CODE_OVERVIEW.md`

**Navigation Maps**:
- `docs/architecture/REPO_MAP.md`

**Feature Documentation**:
- Organized by feature in `docs/features/`

**Setup Guides**:
- Organized in `docs/setup/`

## Quick Links

### Getting Started
- [Project README](../README.md) - Start here for overview
- [Local Supabase Setup](setup/LOCAL_SUPABASE_SETUP.md) - Local development setup
- [Architecture Overview](architecture/ARCHITECTURE.md) - System architecture

### Development
- [AGENTS.md](../AGENTS.md) - Development guidelines and rules
- [Status](tracking/STATUS.md) - Current project status
- [Refactor Plan](tracking/REFACTOR_PLAN.md) - Planned improvements

### Features
- [Transcript System](features/transcripts/SYSTEM_MAP.md) - Transcript architecture
- [Transcript Troubleshooting](features/transcripts/TROUBLESHOOTING.md) - Common issues

### Deployment
- [Azure Deployment](setup/AZURE_DEPLOYMENT.md) - Production deployment guide

## Contributing

When adding new documentation:

1. **Place in appropriate folder** - Architecture, setup, features, testing, or tracking
2. **Use consistent naming** - Lowercase `.md` extension, descriptive names
3. **Update this README** - Add entry to relevant section
4. **Cross-reference** - Link to related documentation
5. **Archive historical docs** - Move old audits/reviews to `archive/`

For more details, see [CONTRIBUTING.md](../CONTRIBUTING.md).
