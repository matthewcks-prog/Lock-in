#!/bin/bash
# Lock-in MCP Server Installation Script (Linux/Ubuntu)
# Installs MCP servers via npm global or npx (recommended: use npx, no global install needed)

echo "================================"
echo "   MCP Server Installation"
echo "================================"
echo ""

echo "Note: MCP servers can be run via npx (recommended) or installed globally."
echo "This script checks if servers are available via npx."
echo ""

servers=(
    "@modelcontextprotocol/server-filesystem"
    "@modelcontextprotocol/server-git"
    "@modelcontextprotocol/server-powershell"
    "@modelcontextprotocol/server-bash"
    "@modelcontextprotocol/server-playwright"
    "@modelcontextprotocol/server-fetch"
    "@modelcontextprotocol/server-postgres"
    "@modelcontextprotocol/server-context7"
)

echo "Checking MCP server availability via npx..."
echo ""

for server in "${servers[@]}"; do
    echo -n "Checking $server... "
    if npx -y "$server" --version >/dev/null 2>&1; then
        echo "✓ Available"
    else
        echo "✗ Not found (may need npm install -g $server)"
    fi
done

echo ""
echo "================================"
echo "Installation Check Complete"
echo "================================"
echo ""
echo "Next steps:"
echo "1. Create .cursor/mcp.json using the template in tools/mcp/config/"
echo "2. Set up .env.local with Supabase read-only connection string"
echo "3. Verify connections in Cursor Settings → MCP Servers"
echo ""

