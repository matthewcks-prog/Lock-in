# Local Development Setup Script
# Automates the setup of Lock-in for local development with Supabase

Write-Host "🚀 Lock-in Local Development Setup" -ForegroundColor Cyan
Write-Host "====================================`n" -ForegroundColor Cyan

# Step 1: Check prerequisites
Write-Host "📋 Step 1: Checking prerequisites..." -ForegroundColor Yellow

# Check Node.js
$nodeVersion = node --version 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Node.js not found. Please install Node.js >= 18.0.0" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Node.js: $nodeVersion" -ForegroundColor Green

# Check npm
$npmVersion = npm --version 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ npm not found. Please install npm >= 9.0.0" -ForegroundColor Red
    exit 1
}
Write-Host "✅ npm: $npmVersion" -ForegroundColor Green

# Check Docker (optional)
$dockerRunning = docker info 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Docker: Running" -ForegroundColor Green
    $dockerAvailable = $true
} else {
    Write-Host "⚠️  Docker: Not running (optional for local dev)" -ForegroundColor Yellow
    $dockerAvailable = $false
}

Write-Host ""

# Step 2: Start Supabase
Write-Host "📦 Step 2: Starting local Supabase..." -ForegroundColor Yellow

$supabaseStatus = npx supabase status 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  Local Supabase not running. Starting now..." -ForegroundColor Yellow
    npx supabase start
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to start Supabase. Check Docker is running." -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "✅ Local Supabase already running" -ForegroundColor Green
}

Write-Host ""

# Step 3: Setup backend environment
Write-Host "⚙️  Step 3: Configuring backend environment..." -ForegroundColor Yellow

cd backend

if (-not (Test-Path ".env.local")) {
    if (Test-Path ".env.local.example") {
        Copy-Item ".env.local.example" ".env.local"
        Write-Host "✅ Created .env.local from template" -ForegroundColor Green
    } else {
        Write-Host "❌ .env.local.example not found" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "✅ .env.local already exists" -ForegroundColor Green
}

Write-Host ""

# Step 4: Install dependencies
Write-Host "📚 Step 4: Installing backend dependencies..." -ForegroundColor Yellow

npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to install dependencies" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Dependencies installed" -ForegroundColor Green

Write-Host ""

# Step 5: Apply migrations
Write-Host "🗃️  Step 5: Applying database migrations..." -ForegroundColor Yellow

cd ..
npx supabase db reset --no-seed
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  Migration failed. This may be expected if schema is up to date." -ForegroundColor Yellow
} else {
    Write-Host "✅ Migrations applied" -ForegroundColor Green
}

Write-Host ""

# Step 6: Summary
Write-Host "═══════════════════════════════════" -ForegroundColor Cyan
Write-Host "🎉 Setup Complete!" -ForegroundColor Green
Write-Host "═══════════════════════════════════`n" -ForegroundColor Cyan

Write-Host "📝 Next Steps:" -ForegroundColor Cyan
Write-Host ""
Write-Host "  1️⃣  Start the backend:" -ForegroundColor White
Write-Host "      cd backend" -ForegroundColor Gray
Write-Host "      npm run dev" -ForegroundColor Gray
Write-Host ""

if ($dockerAvailable) {
    Write-Host "     OR with Docker:" -ForegroundColor White
    Write-Host "      docker compose up" -ForegroundColor Gray
    Write-Host ""
}

Write-Host "  2️⃣  Verify health:" -ForegroundColor White
Write-Host "      curl http://localhost:3000/health" -ForegroundColor Gray
Write-Host ""

Write-Host "  3️⃣  Access Supabase Studio:" -ForegroundColor White
Write-Host "      http://127.0.0.1:54323" -ForegroundColor Gray
Write-Host ""

Write-Host "📖 Documentation:" -ForegroundColor Cyan
Write-Host "   • Full guide: docs/setup/LOCAL_DEVELOPMENT.md" -ForegroundColor Gray
Write-Host "   • Backend rules: backend/AGENTS.md" -ForegroundColor Gray
Write-Host "   • Database schema: docs/reference/DATABASE.md" -ForegroundColor Gray
Write-Host ""

Write-Host "❓ Troubleshooting:" -ForegroundColor Cyan
Write-Host "   • Check logs: npx supabase logs" -ForegroundColor Gray
Write-Host "   • Reset Supabase: npx supabase stop --no-backup && npx supabase start" -ForegroundColor Gray
Write-Host ""
