#!/usr/bin/env node
/**
 * Verify Build Script
 *
 * Validates that the Chrome extension build output contains all required files
 * and has the correct structure. This runs after `npm run build` to catch
 * build issues before deployment or testing.
 */

import { existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');
const extensionDir = join(rootDir, 'extension');

// ANSI color codes for terminal output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  reset: '\x1b[0m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function checkFile(filePath, description) {
  const exists = existsSync(filePath);
  if (exists) {
    log(`✓ ${description}`, colors.green);
  } else {
    log(`✗ ${description}`, colors.red);
  }
  return exists;
}

// Critical files that must exist after build
const requiredFiles = [
  { path: join(extensionDir, 'manifest.json'), desc: 'Manifest file' },
  { path: join(extensionDir, 'background.js'), desc: 'Background script' },
  { path: join(extensionDir, 'popup.html'), desc: 'Popup HTML' },
  { path: join(extensionDir, 'popup.js'), desc: 'Popup script' },
  { path: join(extensionDir, 'contentScript.css'), desc: 'Content script styles' },
  { path: join(extensionDir, 'config.js'), desc: 'Extension config' },
];

// Build output directories and files
const buildOutputs = [
  { path: join(extensionDir, 'dist', 'ui', 'index.js'), desc: 'UI bundle (dist/ui/index.js)' },
  { path: join(extensionDir, 'dist', 'libs', 'sentry.js'), desc: 'Sentry lib' },
  { path: join(extensionDir, 'dist', 'libs', 'initApi.js'), desc: 'API initialization lib' },
  { path: join(extensionDir, 'dist', 'libs', 'contentLibs.js'), desc: 'Content libraries' },
  { path: join(extensionDir, 'dist', 'libs', 'webvttParser.js'), desc: 'WebVTT parser lib' },
  {
    path: join(extensionDir, 'dist', 'libs', 'transcriptProviders.js'),
    desc: 'Transcript providers lib',
  },
];

console.log('\n🔍 Verifying Chrome Extension Build...\n');

let allPassed = true;

// Check required files
log('📄 Checking required files:', colors.yellow);
for (const file of requiredFiles) {
  if (!checkFile(file.path, file.desc)) {
    allPassed = false;
  }
}

console.log('');

// Check build outputs
log('📦 Checking build outputs:', colors.yellow);
for (const output of buildOutputs) {
  if (!checkFile(output.path, output.desc)) {
    allPassed = false;
  }
}

console.log('');

// Summary
if (allPassed) {
  log('✅ Build verification passed! All required files present.', colors.green);
  process.exit(0);
} else {
  log('❌ Build verification failed! Some required files are missing.', colors.red);
  log('💡 Run `npm run build` to generate missing files.', colors.yellow);
  process.exit(1);
}
