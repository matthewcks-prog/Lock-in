# Lock-in Setup Script for Windows PowerShell
# Run this script to set up the backend quickly

Write-Host "================================" -ForegroundColor Cyan
Write-Host "   Lock-in Setup Script" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# Check if Node.js is installed
Write-Host "Checking Node.js installation..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version
    Write-Host "✓ Node.js found: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ Node.js not found!" -ForegroundColor Red
    Write-Host "Please install Node.js from https://nodejs.org/" -ForegroundColor Red
    exit 1
}

# Navigate to backend directory
Write-Host ""
Write-Host "Navigating to backend directory..." -ForegroundColor Yellow
$backendPath = Join-Path $PSScriptRoot "backend"
if (Test-Path $backendPath) {
    Set-Location $backendPath
    Write-Host "✓ In backend directory" -ForegroundColor Green
} else {
    Write-Host "✗ Backend directory not found!" -ForegroundColor Red
    exit 1
}

# Install dependencies
Write-Host ""
Write-Host "Installing dependencies..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Dependencies installed" -ForegroundColor Green
} else {
    Write-Host "✗ Failed to install dependencies" -ForegroundColor Red
    exit 1
}

# Create .env file if it doesn't exist
Write-Host ""
if (Test-Path ".env") {
    Write-Host "✓ .env file already exists" -ForegroundColor Green
} else {
    Write-Host "Creating .env file..." -ForegroundColor Yellow
    Copy-Item ".env.example" ".env"
    Write-Host "✓ .env file created" -ForegroundColor Green
    Write-Host ""
    Write-Host "⚠ IMPORTANT: Edit .env and add your OpenAI API key!" -ForegroundColor Yellow
    Write-Host "   File location: backend\.env" -ForegroundColor Yellow
}

# Summary
Write-Host ""
Write-Host "================================" -ForegroundColor Cyan
Write-Host "   Setup Complete!" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Green
Write-Host "1. Edit backend\.env and add your OpenAI API key" -ForegroundColor White
Write-Host "2. Run 'npm run dev' in the backend folder" -ForegroundColor White
Write-Host "3. Load the extension in Chrome:" -ForegroundColor White
Write-Host "   - Open chrome://extensions/" -ForegroundColor White
Write-Host "   - Enable Developer mode" -ForegroundColor White
Write-Host "   - Click 'Load unpacked'" -ForegroundColor White
Write-Host "   - Select the 'extension' folder" -ForegroundColor White
Write-Host ""
Write-Host "Get your OpenAI API key at: https://platform.openai.com/" -ForegroundColor Cyan
Write-Host ""
