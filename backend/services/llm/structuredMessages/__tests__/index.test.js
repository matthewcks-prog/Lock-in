const test = require('node:test');
const assert = require('node:assert/strict');
const { buildStructuredStudyMessages } = require('..');
const { ATTACHMENT_ONLY_SELECTION_PLACEHOLDER } = require('../../constants');

test('buildStructuredStudyMessages throws when selection and attachments are missing', () => {
  assert.throws(() => buildStructuredStudyMessages({ selection: '  ', attachments: [] }), {
    message: 'Selection or attachments are required to generate a response',
  });
});

test('buildStructuredStudyMessages creates system and user messages for selection flow', () => {
  const result = buildStructuredStudyMessages({
    selection: 'What is polymorphism?',
    newUserMessage: 'Explain in simple terms',
    chatHistory: [],
  });

  assert.equal(Array.isArray(result.messages), true);
  assert.equal(result.messages[0].role, 'system');
  assert.equal(result.messages[result.messages.length - 1].role, 'user');
  assert.equal(result.hasUserQuestion, true);
  assert.equal(result.hasAttachments, false);
});

test('buildStructuredStudyMessages supports attachment-only flow', () => {
  const result = buildStructuredStudyMessages({
    attachments: [
      {
        type: 'document',
        fileName: 'lecture.pdf',
        textContent: '## Week 1\nIntro to systems',
      },
    ],
  });

  assert.equal(result.selectionForPrompt, ATTACHMENT_ONLY_SELECTION_PLACEHOLDER);
  assert.equal(result.hasAttachments, true);
  assert.match(result.userTextContent, /attached content/i);
});

test('buildStructuredStudyMessages includes image attachments in multimodal user message', () => {
  const result = buildStructuredStudyMessages({
    selection: 'Describe this diagram',
    attachments: [
      {
        type: 'image',
        mimeType: 'image/png',
        base64: 'iVBORw0KGgo=',
      },
    ],
  });

  const userMessage = result.messages[result.messages.length - 1];
  assert.equal(Array.isArray(userMessage.content), true);
  assert.equal(userMessage.content[0].type, 'text');
  assert.equal(userMessage.content[1].type, 'image_url');
});
