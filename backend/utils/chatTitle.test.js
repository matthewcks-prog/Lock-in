const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildInitialChatTitle,
  coerceGeneratedTitle,
  extractFirstUserMessage,
} = require('./chatTitle');

test('buildInitialChatTitle trims to six words and normalizes whitespace', () => {
  const title = buildInitialChatTitle('Intro   to distributed   systems and concurrency basics');
  assert.equal(title, 'Intro to distributed systems and concurrency');
});

test('buildInitialChatTitle clamps to max length', () => {
  const longWord = 'abcdefghijklmnopqrst';
  const text = Array.from({ length: 6 }, () => longWord).join(' ');
  const title = buildInitialChatTitle(text);
  assert.ok(title.length <= 80, 'Title should be clamped to 80 characters');
  assert.ok(title.split(' ').length <= 6, 'Title should be clamped to 6 words');
});

test('buildInitialChatTitle falls back to default when empty', () => {
  const title = buildInitialChatTitle('   ');
  assert.equal(title, 'New chat');
});

test('extractFirstUserMessage returns the first user-authored message content', () => {
  const messages = [
    { role: 'assistant', content: 'Hello!' },
    { role: 'user', input_text: ' First question about arrays ' },
    { role: 'user', input_text: 'Second question' },
  ];

  const first = extractFirstUserMessage(messages);
  assert.equal(first, 'First question about arrays');
});

test('coerceGeneratedTitle clamps long candidates and uses fallback when empty', () => {
  const clamped = coerceGeneratedTitle(
    'Arrays and linked lists overview in depth today',
    'Placeholder title',
  );
  assert.equal(clamped, 'Arrays and linked lists overview in');

  const fallback = coerceGeneratedTitle('', '  Custom fallback  ');
  assert.equal(fallback, 'Custom fallback');
});
