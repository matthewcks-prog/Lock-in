const test = require('node:test');
const assert = require('node:assert/strict');
const {
  selectModel,
  needsUpgradedModel,
  getLastUserMessageContent,
} = require('../gemini/modelSelection');

const MODELS = {
  default: 'gemini-2.0-flash',
  upgraded: 'gemini-2.5-flash',
  premium: 'gemini-2.5-pro',
};

test('selectModel respects premium and upgraded flags', () => {
  const messages = [{ role: 'user', content: 'hello' }];
  assert.equal(selectModel(messages, { usePremiumModel: true }, MODELS), MODELS.premium);
  assert.equal(selectModel(messages, { useUpgradedModel: true }, MODELS), MODELS.upgraded);
});

test('selectModel upgrades for long/structured user input', () => {
  const longInput = 'x'.repeat(4000);
  const messages = [{ role: 'user', content: longInput }];
  assert.equal(selectModel(messages, {}, MODELS), MODELS.upgraded);
  assert.equal(
    selectModel([{ role: 'user', content: 'Return json table output' }], {}, MODELS),
    MODELS.upgraded,
  );
});

test('needsUpgradedModel and getLastUserMessageContent handle mixed history', () => {
  const messages = [
    { role: 'assistant', content: 'first' },
    { role: 'user', content: [{ type: 'text', text: 'step by step please' }] },
  ];
  assert.equal(getLastUserMessageContent(messages), 'step by step please');
  assert.equal(needsUpgradedModel('step by step please', {}), true);
});
