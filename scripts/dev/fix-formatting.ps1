# One-Time Formatting Fix Script
# Run this ONCE to fix all formatting issues

Write-Host "Fixing formatting and line endings..." -ForegroundColor Cyan
Write-Host ""

# Step 1: Ensure Husky hooks are installed
Write-Host "1. Installing Husky hooks..." -ForegroundColor Yellow
npm run prepare
if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to install Husky. Please check your npm installation." -ForegroundColor Red
    exit 1
}
Write-Host "Husky hooks installed" -ForegroundColor Green
Write-Host ""

# Step 2: Format all files
Write-Host "2. Formatting all files..." -ForegroundColor Yellow
npm run format
if ($LASTEXITCODE -ne 0) {
    Write-Host "Formatting failed. Please check Prettier configuration." -ForegroundColor Red
    exit 1
}
Write-Host "All files formatted" -ForegroundColor Green
Write-Host ""

# Step 3: Fix linting issues
Write-Host "3. Fixing linting issues..." -ForegroundColor Yellow
npm run lint:fix
if ($LASTEXITCODE -ne 0) {
    Write-Host "Some linting issues may need manual fixing" -ForegroundColor Yellow
}
Write-Host "Linting complete" -ForegroundColor Green
Write-Host ""

# Step 4: Normalize line endings in git
Write-Host "4. Normalizing line endings in git..." -ForegroundColor Yellow
git add --renormalize .
Write-Host "Line endings normalized" -ForegroundColor Green
Write-Host ""

# Step 5: Check for changes
Write-Host "5. Checking for changes..." -ForegroundColor Yellow
$changes = git status --porcelain

if ($changes) {
    Write-Host "Changes detected. Creating commit..." -ForegroundColor Yellow
    git add -A
    git commit -m "chore: normalize formatting and line endings"
    
    Write-Host ""
    Write-Host "Changes committed!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Now run: git push" -ForegroundColor Cyan
} else {
    Write-Host "No changes needed - already formatted!" -ForegroundColor Green
}

Write-Host ""
Write-Host "Setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "From now on:" -ForegroundColor Cyan
Write-Host "  - Files will auto-format on save in VS Code"
Write-Host "  - Pre-commit hook will format staged files"
Write-Host "  - No more formatting changes after push!"
Write-Host ""
Write-Host "See docs/setup/FORMATTING_SETUP_FIX.md for details" -ForegroundColor Gray

