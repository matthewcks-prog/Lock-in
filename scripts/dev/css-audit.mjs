#!/usr/bin/env node
/**
 * CSS Dead Code Audit (PurgeCSS)
 *
 * Scans the content-script CSS bundle against JS/TSX/HTML files that
 * reference those classes to detect unused selectors.
 *
 * This is an advisory tool; it reports but does not auto-delete.
 * Review output before removing anything.
 *
 * Usage: node scripts/dev/css-audit.mjs
 */
import { PurgeCSS } from 'purgecss';
import { resolve } from 'path';
import { readFileSync, existsSync } from 'fs';

const projectRoot = process.cwd();
const bundlePath = resolve(projectRoot, 'extension/contentScript.css');
const MAX_SELECTORS_PER_GROUP = 10;
const PURGECSS_CONTENT_GLOBS = [
  'ui/extension/**/*.{tsx,ts,js}',
  'ui/hooks/**/*.{tsx,ts,js}',
  'shared/ui/**/*.{tsx,ts,js}',
  'extension/content/**/*.{js,ts}',
  'extension/contentScript/**/*.{js,ts}',
  'extension/src/**/*.{tsx,ts,js}',
  'extension/*.{html,js}',
];
const PURGECSS_SAFELIST = {
  standard: [/^is-/, /:-webkit-scrollbar/, 'lockin-sr-only'],
  deep: [/--\w+$/],
  greedy: [/lockin-msg-body/, /lockin-note-editor-surface/],
};

if (!existsSync(bundlePath)) {
  console.error('CSS bundle not found. Run `npm run build:css` first.');
  process.exit(1);
}

const originalCss = readFileSync(bundlePath, 'utf8');
const originalSelectors = extractSelectors(originalCss);

function printAuditHeader() {
  console.log('\nCSS Dead Code Audit (PurgeCSS)\n');
  console.log('   Bundle: extension/contentScript.css');
  console.log(`   Total selectors found: ${originalSelectors.length}\n`);
}

function createPurgeConfig(css) {
  return {
    content: PURGECSS_CONTENT_GLOBS,
    css: [{ raw: css }],
    safelist: PURGECSS_SAFELIST,
    blocklist: [],
    dynamicAttributes: ['class', 'className'],
  };
}

async function getPurgedCss(css) {
  const result = await new PurgeCSS().purge(createPurgeConfig(css));
  return result.length > 0 && result[0].css ? result[0].css : '';
}

function groupSelectorsByPrefix(selectors) {
  const groups = {};
  selectors.forEach((selector) => {
    const prefix = selector.match(/^\.(lockin-[a-z]+)/)?.[1] || 'other';
    if (!groups[prefix]) groups[prefix] = [];
    groups[prefix].push(selector);
  });
  return groups;
}

function printSelectorGroups(groups) {
  Object.entries(groups)
    .sort(([prefixA], [prefixB]) => prefixA.localeCompare(prefixB))
    .forEach(([prefix, selectors]) => {
      console.log(`  ${prefix} (${selectors.length}):`);
      selectors.slice(0, MAX_SELECTORS_PER_GROUP).forEach((selector) => {
        console.log(`    ${selector}`);
      });
      if (selectors.length > MAX_SELECTORS_PER_GROUP) {
        console.log(`    ... and ${selectors.length - MAX_SELECTORS_PER_GROUP} more`);
      }
      console.log('');
    });
}

function printSummary(removedSelectors) {
  console.log(`Potentially unused selectors: ${removedSelectors.length}\n`);
  printSelectorGroups(groupSelectorsByPrefix(removedSelectors));
  console.log(
    'Review carefully; dynamic classes or third-party content may cause false positives.',
  );
  console.log('Use the safelist in scripts/dev/css-audit.mjs to suppress known dynamic classes.\n');
}

async function audit() {
  printAuditHeader();

  const purgedCss = await getPurgedCss(originalCss);
  if (!purgedCss) {
    console.log('PurgeCSS returned no results. Check content paths.\n');
    return;
  }

  const purgedSelectors = extractSelectors(purgedCss);
  const removedSelectors = originalSelectors.filter(
    (selector) => !purgedSelectors.includes(selector),
  );
  if (removedSelectors.length === 0) {
    console.log('No dead CSS selectors detected. All classes are in use.\n');
    return;
  }

  printSummary(removedSelectors);
}

/**
 * Extract class selectors from raw CSS (rough but effective for auditing)
 */
function extractSelectors(css) {
  const selectors = new Set();
  const regex = /\.(lockin-[\w-]+|is-[\w-]+)/g;
  let match;
  while ((match = regex.exec(css)) !== null) {
    selectors.add(match[0]);
  }
  return [...selectors].sort();
}

audit().catch((error) => {
  console.error('CSS audit failed:', error.message);
  process.exit(1);
});
