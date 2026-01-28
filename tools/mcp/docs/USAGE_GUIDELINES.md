# MCP Usage Guidelines

These guidelines keep MCP usage safe, predictable, and aligned with the
Lock-in architecture rules.

## Core Rules

- Treat MCP as a development-only tool surface.
- Prefer read operations before write operations.
- Avoid destructive commands and cross-environment changes.
- Keep architecture boundaries intact (for example, no Chrome APIs in `/core`).

## Recommended Workflow

1. Confirm current status: `../../../docs/tracking/STATUS.md`
2. Review guardrails: `../../../AGENTS.md`
3. Run validation before big changes: `../../scripts/tools/validate-mcp-setup.ps1`

## Related Docs

- MCP setup: `../README.md`
- MCP troubleshooting: `./TROUBLESHOOTING.md`
- Supabase read-only setup: `./SUPABASE_READONLY_SETUP.md`
