#!/usr/bin/env node
/**
 * Verify Build Script
 *
 * Validates that the Chrome extension build output contains all required files
 * and has the correct structure. This runs after `npm run build` to catch
 * build issues before deployment or testing.
 *
 * Checks:
 * - All required files exist
 * - Config has valid Supabase credentials (not placeholders)
 * - JWT tokens have valid structure
 */

import { existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..', '..'); // scripts/ci -> scripts -> root
const extensionDir = join(rootDir, 'extension');

// ANSI color codes for terminal output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
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

/**
 * Validate JWT token structure (header.payload.signature)
 * @param {string} token - JWT token to validate
 * @returns {{ valid: boolean, payload?: object, error?: string }}
 */
function validateJwtStructure(token) {
  if (!token || typeof token !== 'string') {
    return { valid: false, error: 'Token is empty or not a string' };
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    return { valid: false, error: 'Token must have 3 parts (header.payload.signature)' };
  }

  try {
    // Decode payload (base64url)
    const payloadBase64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const payloadJson = Buffer.from(payloadBase64, 'base64').toString('utf-8');
    const payload = JSON.parse(payloadJson);

    // Check for Supabase-specific fields
    if (!payload.iss || !payload.ref || !payload.role) {
      return { valid: false, error: 'Missing Supabase JWT fields (iss, ref, role)' };
    }

    return { valid: true, payload };
  } catch (err) {
    return { valid: false, error: `Failed to decode JWT: ${err.message}` };
  }
}

/**
 * Validate Supabase configuration in built config.js
 * @returns {{ valid: boolean, warnings: string[], errors: string[], details: object }}
 */
function validateSupabaseConfig() {
  const configPath = join(extensionDir, 'config.js');
  const warnings = [];
  const errors = [];
  const details = {};

  if (!existsSync(configPath)) {
    errors.push('config.js not found');
    return { valid: false, warnings, errors, details };
  }

  try {
    const content = readFileSync(configPath, 'utf-8');

    // Extract URL
    const urlMatch = content.match(/url:\s*"([^"]+)"/);
    const url = urlMatch ? urlMatch[1] : '';
    details.url = url;

    // Extract anonKey
    const keyMatch = content.match(/anonKey:\s*"([^"]+)"/);
    const anonKey = keyMatch ? keyMatch[1] : '';
    details.anonKey = anonKey ? `${anonKey.slice(0, 20)}...${anonKey.slice(-10)}` : '(empty)';

    // Validate URL
    if (!url) {
      errors.push('Supabase URL is empty');
    } else if (url.includes('your-') || url.includes('YOUR-') || url.includes('example')) {
      errors.push('Supabase URL contains placeholder value');
    } else if (!url.startsWith('https://') || !url.includes('.supabase.co')) {
      warnings.push('Supabase URL does not look like a valid Supabase URL');
    }

    // Validate anon key
    if (!anonKey) {
      errors.push('Supabase anon key is empty');
    } else if (anonKey === 'public-anon-key' || anonKey.includes('your-')) {
      errors.push('Supabase anon key contains placeholder value');
    } else {
      // Validate JWT structure
      const jwtResult = validateJwtStructure(anonKey);
      if (!jwtResult.valid) {
        errors.push(`Anon key is not a valid JWT: ${jwtResult.error}`);
      } else {
        details.projectRef = jwtResult.payload.ref;
        details.role = jwtResult.payload.role;

        // Check if role is 'anon'
        if (jwtResult.payload.role !== 'anon') {
          warnings.push(`Key role is "${jwtResult.payload.role}", expected "anon"`);
        }

        // Check expiration
        const exp = jwtResult.payload.exp;
        if (exp && exp * 1000 < Date.now()) {
          errors.push('Anon key has expired');
        }
      }
    }

    return {
      valid: errors.length === 0,
      warnings,
      errors,
      details,
    };
  } catch (err) {
    errors.push(`Failed to read config.js: ${err.message}`);
    return { valid: false, warnings, errors, details };
  }
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
let hasWarnings = false;

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

// Validate Supabase configuration
log('🔐 Validating Supabase configuration:', colors.yellow);
const configResult = validateSupabaseConfig();

if (configResult.details.url) {
  log(`  URL: ${configResult.details.url}`, colors.cyan);
}
if (configResult.details.projectRef) {
  log(`  Project: ${configResult.details.projectRef}`, colors.cyan);
}
if (configResult.details.role) {
  log(`  Role: ${configResult.details.role}`, colors.cyan);
}

for (const error of configResult.errors) {
  log(`✗ ${error}`, colors.red);
  allPassed = false;
}

for (const warning of configResult.warnings) {
  log(`⚠ ${warning}`, colors.yellow);
  hasWarnings = true;
}

if (configResult.valid && configResult.warnings.length === 0) {
  log('✓ Supabase configuration looks valid', colors.green);
}

console.log('');

// Summary
if (allPassed && !hasWarnings) {
  log('✅ Build verification passed! All checks passed.', colors.green);
  process.exit(0);
} else if (allPassed && hasWarnings) {
  log('⚠️  Build verification passed with warnings.', colors.yellow);
  process.exit(0);
} else {
  log('❌ Build verification failed!', colors.red);
  if (configResult.errors.length > 0) {
    log('💡 Check your .env.local file and run `npm run build:config` to rebuild.', colors.yellow);
  } else {
    log('💡 Run `npm run build` to generate missing files.', colors.yellow);
  }
  process.exit(1);
}
