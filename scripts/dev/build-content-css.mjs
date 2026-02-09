#!/usr/bin/env node
/**
 * Content-script CSS build pipeline
 *
 * Steps:
 *   1. Inline all @import statements from index.css (flat, one-level)
 *   2. Detect duplicate @keyframes names → fail the build
 *   3. Run PostCSS: autoprefixer + cssnano (lightweight minification)
 *   4. Write the final bundle to extension/contentScript.css
 *
 * Usage: node scripts/dev/build-content-css.mjs [--no-minify]
 */
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import postcss from 'postcss';
import autoprefixer from 'autoprefixer';
import cssnano from 'cssnano';

const projectRoot = process.cwd();
const entryPath = resolve(projectRoot, 'extension/contentScript/index.css');
const outputPath = resolve(projectRoot, 'extension/contentScript.css');
const noMinify = process.argv.includes('--no-minify');

// ── Step 1: Inline @import statements ──────────────────────────────

function inlineImports(filePath, seen = new Set()) {
  const normalized = resolve(filePath);
  if (seen.has(normalized)) {
    throw new Error(`Circular CSS import detected: ${normalized}`);
  }

  seen.add(normalized);
  const dir = dirname(normalized);
  const source = readFileSync(normalized, 'utf8');
  const lines = source.split(/\r?\n/);
  const out = [];

  for (const line of lines) {
    const importMatch = line.match(/^\s*@import\s+['"](.+?)['"];\s*$/);
    if (!importMatch) {
      out.push(line);
      continue;
    }

    const importPath = resolve(dir, importMatch[1]);
    out.push(`/* ── inlined: ${importMatch[1]} ── */`);
    out.push(inlineImports(importPath, seen));
  }

  seen.delete(normalized);
  return out.join('\n').trimEnd();
}

// ── Step 2: Detect duplicate @keyframes ────────────────────────────

function detectDuplicateKeyframes(css) {
  const keyframeNames = new Map(); // name → [lines]
  const lines = css.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/@keyframes\s+([\w-]+)/);
    if (match) {
      const name = match[1];
      if (!keyframeNames.has(name)) {
        keyframeNames.set(name, []);
      }
      keyframeNames.set(name, [...keyframeNames.get(name), i + 1]);
    }
  }

  const duplicates = [];
  for (const [name, lineNums] of keyframeNames) {
    if (lineNums.length > 1) {
      duplicates.push(
        `  @keyframes ${name} — defined ${lineNums.length}× at lines: ${lineNums.join(', ')}`,
      );
    }
  }

  if (duplicates.length > 0) {
    console.error('\n❌ BUILD FAILED: Duplicate @keyframes detected!\n');
    console.error(duplicates.join('\n'));
    console.error('\nConsolidate all shared keyframes into utilities.css.\n');
    process.exit(1);
  }
}

// ── Step 3 & 4: PostCSS + Write ────────────────────────────────────

async function build() {
  const inlined = inlineImports(entryPath);
  detectDuplicateKeyframes(inlined);

  const plugins = [autoprefixer];
  if (!noMinify) {
    plugins.push(
      cssnano({
        preset: [
          'default',
          {
            // Keep @layer, custom properties, and keyframe names intact
            cssDeclarationSorter: false,
            discardComments: { removeAll: true },
            // Don't mangle keyframe names — they're referenced by class
            reduceIdents: false,
            // Don't merge @layer rules
            mergeRules: false,
          },
        ],
      }),
    );
  }

  const result = await postcss(plugins).process(inlined, {
    from: entryPath,
    to: outputPath,
  });

  // Report any PostCSS warnings
  for (const warning of result.warnings()) {
    console.warn(`⚠️  PostCSS: ${warning.text}`);
  }

  const header = [
    '/**',
    ' * AUTO-GENERATED FILE. DO NOT EDIT DIRECTLY.',
    ' * Source: extension/contentScript/index.css',
    ' * Build: npm run build:css',
    noMinify
      ? ' * Mode: development (unminified)'
      : ' * Mode: production (minified + autoprefixed)',
    ' */',
    '',
  ].join('\n');

  writeFileSync(outputPath, `${header}${result.css}\n`, 'utf8');

  const sizeKb = (Buffer.byteLength(result.css, 'utf8') / 1024).toFixed(1);
  console.log(`✅ Built CSS bundle: ${outputPath} (${sizeKb} KB${noMinify ? ', unminified' : ''})`);
}

build().catch((err) => {
  console.error('❌ CSS build failed:', err.message);
  process.exit(1);
});
