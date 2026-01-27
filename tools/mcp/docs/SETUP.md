# MCP Setup

This is a concise setup checklist for MCP in the Lock-in repo.

## Setup Checklist

1. Install MCP servers (IDE registry or npm).
2. Create your IDE MCP config from the template.
3. Create `tools/mcp/.env.local` from `tools/mcp/.env.template`.
4. Configure Supabase access (read-only or dev-admin).
5. Run the validation script.

## Commands

```powershell
cd tools/mcp/scripts
./setup-env-local.ps1 -Force
./validate-mcp-setup.ps1
```

## Canonical References

- Full MCP overview: `../README.md`
- Supabase dev admin setup: `./SUPABASE_DEV_ADMIN_SETUP.md`
- Supabase read-only setup: `./SUPABASE_READONLY_SETUP.md`
- Troubleshooting: `./TROUBLESHOOTING.md`
