const test = require('node:test');
const assert = require('node:assert/strict');

const { trimIncompleteMarkdownTail } = require('../summaryMarkdown');

test('trimIncompleteMarkdownTail keeps complete endings untouched', () => {
  const input = ['# Heading', '', '- Point one.', '- Point two.'].join('\n');
  const result = trimIncompleteMarkdownTail(input);
  assert.equal(result, input);
});

test('trimIncompleteMarkdownTail removes dangling incomplete tail line', () => {
  const input = ['# Heading', '', '- Stable line.', '- Incomplete line without ending'].join('\n');
  const result = trimIncompleteMarkdownTail(input);
  assert.equal(result, ['# Heading', '', '- Stable line.'].join('\n'));
});

test('trimIncompleteMarkdownTail removes orphan heading without body', () => {
  const input = ['## Intro', 'Details.', '', '## Cut off heading'].join('\n');
  const result = trimIncompleteMarkdownTail(input);
  assert.equal(result, ['## Intro', 'Details.'].join('\n'));
});

test('trimIncompleteMarkdownTail preserves single heading output', () => {
  const input = '# Overview';
  const result = trimIncompleteMarkdownTail(input);
  assert.equal(result, '# Overview');
});
