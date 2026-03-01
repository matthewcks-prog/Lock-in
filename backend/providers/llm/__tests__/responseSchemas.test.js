const { test, describe } = require('node:test');
const assert = require('node:assert');
const {
  parseOpenAiResponse,
  parseGeminiResponse,
  parseGroqResponse,
} = require('../responseSchemas');

describe('LLM response schemas', () => {
  test('parses OpenAI responses', () => {
    const parsed = parseOpenAiResponse({
      choices: [{ message: { content: 'Hello' } }],
      model: 'gpt-4o-mini',
      usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 },
    });
    assert.equal(parsed.choices[0].message.content, 'Hello');
  });

  test('parses Groq responses', () => {
    const parsed = parseGroqResponse({
      choices: [{ message: { content: 'Hi' } }],
      model: 'llama',
    });
    assert.equal(parsed.choices[0].message.content, 'Hi');
  });

  test('parses Gemini responses', () => {
    const parsed = parseGeminiResponse({
      candidates: [
        {
          content: {
            parts: [{ text: 'Gemini' }],
          },
        },
      ],
      usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1, totalTokenCount: 2 },
    });
    assert.equal(parsed.candidates[0].content.parts[0].text, 'Gemini');
  });

  test('rejects invalid OpenAI responses', () => {
    assert.throws(() => parseOpenAiResponse({ choices: [] }), /Invalid OpenAI response/);
  });
});
