#!/bin/bash
#
# setup-env-local.sh
# Sets up the .env.local file for Lock-in MCP servers with dynamic path detection.
#
# Usage:
#   ./setup-env-local.sh                    # Interactive mode
#   ./setup-env-local.sh -c "postgresql://..." # With connection string
#   ./setup-env-local.sh -f                 # Force overwrite
#
# Part of MCP Cross-IDE setup tools

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# --- Helper Functions ---

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${CYAN}→ $1${NC}"
}

print_header() {
    echo -e "\n${MAGENTA}$1${NC}"
}

find_repo_root() {
    # Start from script location
    local script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    
    # If script is in tools/mcp/scripts, go up 3 levels
    if [[ "$script_dir" == *"tools/mcp/scripts"* ]]; then
        local repo_root="$(dirname "$(dirname "$(dirname "$script_dir")")")"
    else
        local repo_root="$script_dir"
    fi
    
    # Validate by checking for key repo files
    if [[ -f "$repo_root/package.json" && -f "$repo_root/AGENTS.md" ]]; then
        echo "$repo_root"
        return 0
    fi
    
    # Fallback: search upward from current directory
    local current_dir="$(pwd)"
    while [[ "$current_dir" != "/" ]]; do
        if [[ -f "$current_dir/package.json" && -f "$current_dir/AGENTS.md" ]]; then
            echo "$current_dir"
            return 0
        fi
        current_dir="$(dirname "$current_dir")"
    done
    
    return 1
}

get_supabase_project_ref() {
    local repo_root="$1"
    local config_path="$repo_root/extension/config.js"
    
    if [[ -f "$config_path" ]]; then
        # Extract project ref from SUPABASE_URL
        local project_ref=$(grep -oP 'https://\K[a-z0-9]+(?=\.supabase\.co)' "$config_path" 2>/dev/null || true)
        if [[ -n "$project_ref" ]]; then
            echo "$project_ref"
            return 0
        fi
    fi
    
    return 1
}

validate_connection_string() {
    local conn_string="$1"
    
    if [[ -z "$conn_string" ]]; then
        return 1
    fi
    
    # Basic format check: postgresql://user:pass@host:port/db
    if [[ "$conn_string" =~ ^postgresql://[^:]+:[^@]+@[^:]+:[0-9]+/[a-zA-Z0-9_]+(\?.*)?$ ]]; then
        return 0
    fi
    
    return 1
}

# --- Parse Arguments ---

CONNECTION_STRING=""
FORCE=false
OUTPUT_DIR=""

while getopts "c:fo:h" opt; do
    case $opt in
        c) CONNECTION_STRING="$OPTARG" ;;
        f) FORCE=true ;;
        o) OUTPUT_DIR="$OPTARG" ;;
        h)
            echo "Usage: $0 [-c connection_string] [-f] [-o output_dir]"
            echo "  -c  Supabase read-only connection string"
            echo "  -f  Force overwrite existing .env.local"
            echo "  -o  Output directory (defaults to repo root)"
            exit 0
            ;;
        \?)
            echo "Invalid option: -$OPTARG" >&2
            exit 1
            ;;
    esac
done

# --- Main Script ---

print_header "Lock-in MCP Environment Setup"
echo "=============================="

# Step 1: Find repository root
print_info "Detecting repository root..."
REPO_ROOT=$(find_repo_root) || {
    print_error "Could not find Lock-in repository root."
    print_error "Please run this script from within the Lock-in repository."
    exit 1
}

print_success "Repository root: $REPO_ROOT"

# Step 2: Determine output location
if [[ -z "$OUTPUT_DIR" ]]; then
    OUTPUT_DIR="$REPO_ROOT"
fi

ENV_LOCAL_PATH="$OUTPUT_DIR/.env.local"

# Step 3: Check for existing .env.local
if [[ -f "$ENV_LOCAL_PATH" && "$FORCE" != true ]]; then
    print_warning ".env.local already exists at: $ENV_LOCAL_PATH"
    read -p "Overwrite? (y/N) " response
    if [[ ! "$response" =~ ^[Yy]$ ]]; then
        print_info "Aborted. Use -f to overwrite without confirmation."
        exit 0
    fi
fi

# Step 4: Get Supabase project reference
PROJECT_REF=$(get_supabase_project_ref "$REPO_ROOT") || true
if [[ -n "$PROJECT_REF" ]]; then
    print_success "Detected Supabase project: $PROJECT_REF"
else
    print_warning "Could not auto-detect Supabase project reference."
    read -p "Enter Supabase project reference (e.g., abcdefgh12345): " PROJECT_REF
fi

# Step 5: Get connection string
if [[ -z "$CONNECTION_STRING" ]]; then
    print_header "Supabase Connection String"
    echo "Format: postgresql://readonly_user:PASSWORD@db.$PROJECT_REF.supabase.co:5432/postgres"
    echo ""
    echo "To create a read-only user, see: tools/mcp/docs/SUPABASE_READONLY_SETUP.md"
    echo ""
    read -p "Enter connection string (or press Enter to skip database setup): " CONNECTION_STRING
fi

HAS_VALID_CONNECTION=false
if validate_connection_string "$CONNECTION_STRING"; then
    HAS_VALID_CONNECTION=true
elif [[ -n "$CONNECTION_STRING" ]]; then
    print_warning "Connection string format appears invalid."
    print_info "Expected: postgresql://user:pass@host:port/database"
    read -p "Continue anyway? (y/N) " continue_response
    if [[ ! "$continue_response" =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Step 6: Build paths
EXTENSION_PATH="$REPO_ROOT/extension"
CORE_PATH="$REPO_ROOT/core"
API_PATH="$REPO_ROOT/api"
DOCS_PATH="$REPO_ROOT/docs"
INTEGRATIONS_PATH="$REPO_ROOT/integrations"

# Step 7: Generate .env.local content
GENERATED_DATE=$(date "+%Y-%m-%d %H:%M:%S")

if [[ "$HAS_VALID_CONNECTION" == true ]]; then
    CONNECTION_LINE="SUPABASE_READONLY_CONNECTION_STRING=$CONNECTION_STRING"
else
    CONNECTION_LINE="# SUPABASE_READONLY_CONNECTION_STRING=postgresql://readonly_user:PASSWORD@db.$PROJECT_REF.supabase.co:5432/postgres"
fi

cat > "$ENV_LOCAL_PATH" << EOF
# Lock-in MCP Environment Variables
# Generated by setup-env-local.sh on $GENERATED_DATE
# This file is gitignored and should never be committed

# =============================================================================
# REPOSITORY PATHS (auto-detected)
# =============================================================================

# Repository root
LOCKIN_REPO_ROOT=$REPO_ROOT

# Key directories
LOCKIN_EXTENSION_PATH=$EXTENSION_PATH
LOCKIN_CORE_PATH=$CORE_PATH
LOCKIN_API_PATH=$API_PATH
LOCKIN_DOCS_PATH=$DOCS_PATH
LOCKIN_INTEGRATIONS_PATH=$INTEGRATIONS_PATH

# =============================================================================
# SUPABASE CONFIGURATION
# =============================================================================

# Project reference (extracted from extension/config.js)
LOCKIN_SUPABASE_PROJECT_REF=$PROJECT_REF

# Supabase URL
LOCKIN_SUPABASE_URL=https://$PROJECT_REF.supabase.co

# Read-only connection string for MCP database server
# Create a read-only user first - see tools/mcp/docs/SUPABASE_READONLY_SETUP.md
$CONNECTION_LINE

# =============================================================================
# DATABASE SERVER SETTINGS
# =============================================================================

LOCKIN_DB_MAX_ROWS=1000
LOCKIN_DB_TIMEOUT_MS=5000
LOCKIN_DB_READONLY=true

# =============================================================================
# BUILD SERVER SETTINGS
# =============================================================================

LOCKIN_BUILD_TIMEOUT_MS=300000
LOCKIN_BUILD_MAX_OUTPUT_BYTES=1048576

# =============================================================================
# BACKEND (for local development)
# =============================================================================

BACKEND_URL=http://localhost:3000

# =============================================================================
# EXTENSION PATH (for Playwright MCP server)
# =============================================================================

EXTENSION_PATH=$EXTENSION_PATH
EOF

print_success ".env.local created at: $ENV_LOCAL_PATH"

# Step 8: Validate generated file
print_info "Validating generated configuration..."

VALIDATION_WARNINGS=()

if [[ ! -d "$EXTENSION_PATH" ]]; then
    VALIDATION_WARNINGS+=("Extension path not found: $EXTENSION_PATH")
fi

if [[ ! -d "$CORE_PATH" ]]; then
    VALIDATION_WARNINGS+=("Core path not found: $CORE_PATH")
fi

if [[ "$HAS_VALID_CONNECTION" != true ]]; then
    VALIDATION_WARNINGS+=("Database connection string not configured (optional)")
fi

if [[ ${#VALIDATION_WARNINGS[@]} -gt 0 ]]; then
    print_warning "Warnings:"
    for warning in "${VALIDATION_WARNINGS[@]}"; do
        echo "  - $warning"
    done
else
    print_success "All paths validated successfully!"
fi

# Step 9: Summary
print_header "Setup Complete!"
echo "==============="
echo ""
echo "Generated: $ENV_LOCAL_PATH"
echo ""
echo "Next steps:"
echo "  1. Review the generated .env.local file"
if [[ "$HAS_VALID_CONNECTION" != true ]]; then
    echo "  2. Add your Supabase read-only connection string"
    echo "     See: tools/mcp/docs/SUPABASE_READONLY_SETUP.md"
fi
echo "  3. Copy config template to your IDE:"
echo "     Cursor: cp tools/mcp/config/mcp.json.template .cursor/mcp.json"
echo "     See: tools/mcp/CROSS_IDE_GUIDE.md for other IDEs"
echo ""
