// @vitest-environment node
import { beforeAll, describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

type StructuredMessage = { role: string; content: unknown };
type BuildStructuredStudyMessages = (options: {
  mode: 'explain' | 'general';
  selection?: string;
  chatHistory?: StructuredMessage[];
  attachments?: Array<{ type: string; textContent?: string; fileName?: string }>;
  newUserMessage?: string;
}) => { messages: StructuredMessage[] };

const require = createRequire(import.meta.url);
let buildStructuredStudyMessages: BuildStructuredStudyMessages;

beforeAll(async () => {
  process.env['OPENAI_API_KEY'] = process.env['OPENAI_API_KEY'] || 'test-key';
  const openaiClient = require('../../backend/openaiClient.js') as {
    buildStructuredStudyMessages: BuildStructuredStudyMessages;
  };
  buildStructuredStudyMessages = openaiClient.buildStructuredStudyMessages;
});

describe('openaiClient attachment-first prompt', () => {
  it('references attached files/images as primary context', () => {
    const { messages } = buildStructuredStudyMessages({
      mode: 'explain',
      selection: '',
      chatHistory: [],
      attachments: [
        {
          type: 'document',
          textContent: 'Lecture notes about recursion.',
          fileName: 'notes.txt',
        },
      ],
    });

    const userMessage = messages.find((message: StructuredMessage) => message.role === 'user');
    let content = '';
    if (typeof userMessage?.content === 'string') {
      content = userMessage.content;
    } else if (Array.isArray(userMessage?.content)) {
      const firstPart = userMessage.content[0] as { text?: string } | undefined;
      if (firstPart && typeof firstPart.text === 'string') {
        content = firstPart.text;
      }
    }

    expect(content).toContain('attached files/images');
    expect(content).toContain('primary');
  });
});
