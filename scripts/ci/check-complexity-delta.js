import fs from 'node:fs';

const input = fs.readFileSync(0, 'utf8').trim();

if (!input) {
  console.log('No ESLint JSON input provided.');
  process.exit(0);
}

let results;
try {
  results = JSON.parse(input);
} catch (error) {
  console.error('Invalid ESLint JSON input.');
  process.exit(1);
}

const complexityMessages = [];
let maxComplexity = 0;

for (const result of results) {
  for (const message of result.messages || []) {
    if (message.ruleId === 'complexity') {
      complexityMessages.push(message);
      const match = /complexity of (\d+)/i.exec(message.message || '');
      if (match) {
        const value = Number(match[1]);
        if (!Number.isNaN(value)) {
          maxComplexity = Math.max(maxComplexity, value);
        }
      }
    }
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
