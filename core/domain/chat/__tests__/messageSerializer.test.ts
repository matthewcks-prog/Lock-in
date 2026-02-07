import { describe, expect, it } from 'vitest';
import { deserializeMessage } from '../messageSerializer';
import { ValidationError } from '../../../errors';

describe('messageSerializer', () => {
  const baseMessage = {
    id: 'm1',
    chatId: 'c1',
    role: 'user',
    content: 'Hello',
    createdAt: '2024-01-01T00:00:00.000Z',
  };

  it('deserializes a message with attachments', () => {
    const message = deserializeMessage({
      ...baseMessage,
      attachments: [
        {
          id: 'a1',
          type: 'image',
          mimeType: 'image/png',
          fileName: 'note.png',
          fileSize: 123,
          url: 'https://example.com/note.png',
        },
      ],
    });

    expect(message.id).toBe('m1');
    expect(message.attachments?.length).toBe(1);
    expect(message.attachments?.[0]?.url).toBe('https://example.com/note.png');
  });

  it('omits optional fields when missing', () => {
    const message = deserializeMessage(baseMessage);
    expect(message.attachments).toBeUndefined();
    expect(message.metadata).toBeUndefined();
  });

  it('throws ValidationError for invalid roles', () => {
    expect(() => {
      deserializeMessage({
        ...baseMessage,
        role: 'invalid',
      });
    }).toThrow(ValidationError);
  });
});
