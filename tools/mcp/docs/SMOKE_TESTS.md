# MCP Smoke Tests

Use these quick checks to confirm MCP tools are wired correctly.

## Smoke Test Prompts

1. Filesystem: "List the top-level folders in the repo."
2. Git: "Show the latest commit summary."
3. Shell: "Run the doc link check script."
4. Database (if configured): "Run a simple SELECT with a LIMIT."

## Expected Commands

```powershell
Get-ChildItem -Force
git log -1 --oneline
npm run docs:check-links
```

## If Something Fails

- Run `../../scripts/tools/validate-mcp-setup.ps1`
- Check `./TROUBLESHOOTING.md`
