# Lock-in MCP Server Installation Script (Windows PowerShell)
# Installs MCP servers via npm global or npx (recommended: use npx, no global install needed)

Write-Host "================================" -ForegroundColor Cyan
Write-Host "   MCP Server Installation" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Note: MCP servers can be run via npx (recommended) or installed globally." -ForegroundColor Yellow
Write-Host "This script checks if servers are available via npx." -ForegroundColor Yellow
Write-Host ""

$servers = @(
    "@modelcontextprotocol/server-filesystem",
    "@modelcontextprotocol/server-git",
    "@modelcontextprotocol/server-powershell",
    "@modelcontextprotocol/server-bash",
    "@modelcontextprotocol/server-playwright",
    "@modelcontextprotocol/server-fetch",
    "@modelcontextprotocol/server-postgres",
    "@modelcontextprotocol/server-context7"
)

Write-Host "Checking MCP server availability via npx..." -ForegroundColor Yellow
Write-Host ""

foreach ($server in $servers) {
    Write-Host "Checking $server..." -ForegroundColor Yellow -NoNewline
    $result = npx -y $server --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host " Available" -ForegroundColor Green
    } else {
        Write-Host " Not found (may need npm install -g $server)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "================================" -ForegroundColor Cyan
Write-Host "Installation Check Complete" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Create .cursor/mcp.json using the template in tools/mcp/config/" -ForegroundColor White
Write-Host "2. Set up .env.local with Supabase read-only connection string" -ForegroundColor White
Write-Host "3. Verify connections in Cursor Settings (MCP Servers)" -ForegroundColor White
Write-Host ""
