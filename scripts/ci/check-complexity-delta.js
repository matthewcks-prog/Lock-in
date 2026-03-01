import fs from 'node:fs';

// ---------------------------------------------------------------------------
// Input resolution
// Prefer a file-path argument (written by eslint --output-file) over stdin.
// Reading from a file avoids npm lifecycle prefix lines ("\n> pkg@ver script"
// lines that npm writes to stdout when piped) from contaminating the JSON.
// Stdin is kept as a fallback so the script remains usable manually:
//   eslint . --format json | node check-complexity-delta.js
// ---------------------------------------------------------------------------
const filePath = process.argv[2];

let rawInput;
if (filePath) {
  if (!fs.existsSync(filePath)) {
    console.error(`Complexity check: ESLint output file not found: ${filePath}`);
    process.exit(1);
  }
  rawInput = fs.readFileSync(filePath, 'utf8').trim();
} else {
  rawInput = fs.readFileSync(0, 'utf8').trim();
}

if (!rawInput) {
  console.log('Complexity check: no ESLint output — nothing to analyse.');
  process.exit(0);
}

let results;
try {
  results = JSON.parse(rawInput);
} catch {
  // Surface the first 120 chars of what we received so the problem is obvious
  // in CI logs without needing to download any artefacts.
  const preview = rawInput.slice(0, 120).replace(/\n/g, '\\n');
  console.error(`Complexity check: ESLint output is not valid JSON.`);
  console.error(`  Source : ${filePath ?? 'stdin'}`);
  console.error(`  Preview: ${preview}`);
  console.error(`  Hint   : make sure the caller uses eslint directly (not via`);
  console.error(`           \'npm run lint\') to avoid lifecycle prefix lines`);
  console.error(`           contaminating the JSON stream.`);
  process.exit(1);
}

const complexityMessages = [];
let maxComplexity = 0;

for (const result of results) {
  for (const message of result.messages || []) {
    if (message.ruleId !== 'complexity') continue;

    complexityMessages.push(message);
    const match = /complexity of (\d+)/i.exec(message.message || '');
    if (!match) continue;

    const value = Number(match[1]);
    if (Number.isNaN(value)) continue;

    maxComplexity = Math.max(maxComplexity, value);
  }
}

const errorCount = complexityMessages.filter((message) => message.severity === 2).length;

if (errorCount > 0) {
  console.error(`Complexity errors detected: ${errorCount}`);
  process.exit(1);
}

if (complexityMessages.length > 0) {
  console.log(
    `Complexity warnings detected: ${complexityMessages.length}. Max complexity: ${maxComplexity || 'unknown'}.`,
  );
} else {
  console.log('No complexity findings detected.');
}
