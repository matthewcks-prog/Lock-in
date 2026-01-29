# Test build script
cd c:\Users\matth\Lock-in
Write-Host "Checking if node_modules exists..."
if (Test-Path "node_modules") {
    Write-Host "✓ node_modules exists"
} else {
    Write-Host "✗ node_modules missing - installing..."
    npm install
}

Write-Host "`nRunning build..."
npm run build

Write-Host "`nChecking for output..."
if (Test-Path "extension\ui\index.js") {
    Write-Host "✓ SUCCESS: Build output exists at extension\ui\index.js"
    $size = (Get-Item "extension\ui\index.js").Length
    Write-Host "  File size: $size bytes"
} else {
    Write-Host "✗ ERROR: Build output not found"
    Write-Host "Checking for errors..."
    npm run type-check 2>&1 | Select-Object -First 20
}
