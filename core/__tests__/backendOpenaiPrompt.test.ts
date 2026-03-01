// @vitest-environment node
import { beforeAll, describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

type StructuredMessage = { role: string; content: unknown };
type BuildStructuredStudyMessages = (options: {
  selection?: string;
  chatHistory?: StructuredMessage[];
  attachments?: Array<{ type: string; textContent?: string; fileName?: string }>;
  newUserMessage?: string;
}) => { messages: StructuredMessage[] };

const require = createRequire(import.meta.url);
let buildStructuredStudyMessages: BuildStructuredStudyMessages;

const ensureEnv = (key: string, fallback: string): void => {
  const current = process.env[key];
  process.env[key] = typeof current === 'string' && current.length > 0 ? current : fallback;
};

beforeAll(async () => {
  ensureEnv('OPENAI_API_KEY', 'test-key');
  const structuredMessages = require('../../backend/services/llm/structuredMessages.js') as {
    buildStructuredStudyMessages: BuildStructuredStudyMessages;
  };
  buildStructuredStudyMessages = structuredMessages.buildStructuredStudyMessages;
});

describe('structuredMessages attachment-first prompt', () => {
  it('references attached files/images as primary context', () => {
    const { messages } = buildStructuredStudyMessages({
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
      if (firstPart !== undefined && typeof firstPart.text === 'string') {
        content = firstPart.text;
      }
    }

    expect(content).toContain('attached files/images');
    expect(content).toContain('primary');
  });
});
