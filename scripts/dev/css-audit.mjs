#!/usr/bin/env node
/**
 * CSS Dead Code Audit (PurgeCSS)
 *
 * Scans the content-script CSS bundle against all JS/TSX/HTML files that
 * reference those classes to detect unused selectors.
 *
 * This is an ADVISORY tool — it reports but does not auto-delete.
 * Review the output before removing anything.
 *
 * Usage: node scripts/dev/css-audit.mjs
 */
import { PurgeCSS } from 'purgecss';
import { resolve } from 'path';
import { readFileSync, existsSync } from 'fs';

const projectRoot = process.cwd();
const bundlePath = resolve(projectRoot, 'extension/contentScript.css');

if (!existsSync(bundlePath)) {
  console.error('❌ CSS bundle not found. Run `npm run build:css` first.');
  process.exit(1);
}

const originalCss = readFileSync(bundlePath, 'utf8');
const originalSelectors = extractSelectors(originalCss);

async function audit() {
  console.log('\n🔍 CSS Dead Code Audit (PurgeCSS)\n');
  console.log(`   Bundle: extension/contentScript.css`);
  console.log(`   Total selectors found: ${originalSelectors.length}\n`);

  const result = await new PurgeCSS().purge({
    content: [
      // React UI components that use these CSS classes
      'ui/extension/**/*.{tsx,ts,js}',
      'ui/hooks/**/*.{tsx,ts,js}',
      'shared/ui/**/*.{tsx,ts,js}',
      // Content scripts that manipulate DOM with these classes
      'extension/content/**/*.{js,ts}',
      'extension/contentScript/**/*.{js,ts}',
      'extension/src/**/*.{tsx,ts,js}',
      // Popup and HTML entry points
      'extension/*.{html,js}',
    ],
    css: [{ raw: originalCss }],
    // Safelist patterns for dynamic classes
    safelist: {
      standard: [
        // State classes applied dynamically
        /^is-/,
        // Pseudo-elements and scrollbar styles
        /:-webkit-scrollbar/,
        // Screen reader utility
        'lockin-sr-only',
      ],
      deep: [
        // BEM modifiers applied via template literals
        /--\w+$/,
      ],
      greedy: [
        // Markdown-rendered content uses generic element selectors
        /lockin-msg-body/,
        /lockin-note-editor-surface/,
      ],
    },
    // Don't remove @keyframes, @layer, or CSS custom properties
    blocklist: [],
    dynamicAttributes: ['class', 'className'],
  });

  if (!result.length || !result[0].css) {
    console.log('⚠️  PurgeCSS returned no results. Check content paths.\n');
    return;
  }

  const purgedSelectors = extractSelectors(result[0].css);
  const removedSelectors = originalSelectors.filter((s) => !purgedSelectors.includes(s));

  if (removedSelectors.length === 0) {
    console.log('✅ No dead CSS selectors detected. All classes are in use.\n');
    return;
  }

  // Group by prefix for readability
  const groups = {};
  for (const sel of removedSelectors) {
    const prefix = sel.match(/^\.(lockin-[a-z]+)/)?.[1] || 'other';
    if (!groups[prefix]) groups[prefix] = [];
    groups[prefix].push(sel);
  }

  console.log(`⚠️  ${removedSelectors.length} potentially unused selectors:\n`);
  for (const [prefix, selectors] of Object.entries(groups).sort()) {
    console.log(`  ${prefix} (${selectors.length}):`);
    for (const sel of selectors.slice(0, 10)) {
      console.log(`    ${sel}`);
    }
    if (selectors.length > 10) {
      console.log(`    ... and ${selectors.length - 10} more`);
    }
    console.log('');
  }

  console.log(
    '💡 Review carefully — dynamic classes or third-party content may cause false positives.',
  );
  console.log(
    '   Use the safelist in scripts/dev/css-audit.mjs to suppress known dynamic classes.\n',
  );
}

/**
 * Extract class selectors from raw CSS (rough but effective for auditing)
 */
function extractSelectors(css) {
  const selectors = new Set();
  // Match class selectors like .lockin-foo-bar
  const regex = /\.(lockin-[\w-]+|is-[\w-]+)/g;
  let match;
  while ((match = regex.exec(css)) !== null) {
    selectors.add(match[0]);
  }
  return [...selectors].sort();
}

audit().catch((err) => {
  console.error('❌ CSS audit failed:', err.message);
  process.exit(1);
});
