#!/usr/bin/env node
/**
 * CSS File-Size Guard
 *
 * Enforces max line counts per CSS file to prevent bloat.
 * Aligned with AGENTS.md's 300-line guideline.
 *
 * Recursively scans all .css files under extension/contentScript/,
 * including subdirectory partials (e.g. tokens/*.css).
 *
 * Exit code 1 = at least one file exceeds the limit.
 * Usage: node scripts/dev/css-filesize-guard.mjs
 */
import { readdirSync, readFileSync, statSync } from 'fs';
import { resolve, relative } from 'path';

const CSS_DIR = resolve(process.cwd(), 'extension/contentScript');
const MAX_LINES = 375; // hard cap (guideline 300 + buffer for @layer wrappers and comments)
const WARN_LINES = 300; // aligned with AGENTS.md guideline

/**
 * Recursively collect all .css files under a directory.
 * @param {string} dir
 * @returns {string[]} Absolute paths
 */
function collectCssFiles(dir) {
  const results = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectCssFiles(fullPath));
    } else if (entry.name.endsWith('.css')) {
      results.push(fullPath);
    }
  }
  return results;
}

const files = collectCssFiles(CSS_DIR);
const violations = [];
const warnings = [];

for (const filePath of files) {
  const displayName = relative(CSS_DIR, filePath).replace(/\\/g, '/');
  const lineCount = readFileSync(filePath, 'utf8').split('\n').length;

  if (lineCount > MAX_LINES) {
    violations.push({ file: displayName, lineCount });
  } else if (lineCount > WARN_LINES) {
    warnings.push({ file: displayName, lineCount });
  }
}

// Report
console.log(`\n📏 CSS File-Size Guard (max: ${MAX_LINES} lines, warn: ${WARN_LINES})\n`);

if (warnings.length > 0) {
  console.log('⚠️  Approaching limit:');
  for (const { file, lineCount } of warnings) {
    console.log(`   ${file}: ${lineCount} lines (${MAX_LINES - lineCount} remaining)`);
  }
  console.log('');
}

if (violations.length > 0) {
  console.error('❌ OVER LIMIT:');
  for (const { file, lineCount } of violations) {
    console.error(`   ${file}: ${lineCount} lines (${lineCount - MAX_LINES} over)`);
  }
  console.error(`\nSplit large files into smaller partials. See AGENTS.md for guidance.\n`);
  process.exit(1);
} else {
  console.log(`✅ All ${files.length} CSS files within limits.\n`);
}
