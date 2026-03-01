import { describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderWithProviders } from '@shared/test';
import { MessageBlock } from '../chat/components/MessageBlock';
import type { ChatMessage } from '../chat/types';

function makeMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: 'msg-1',
    role: 'assistant',
    content: '',
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

describe('MessageBlock', () => {
  describe('streaming lifecycle', () => {
    it('shows ThinkingIndicator when pending and no content', () => {
      const msg = makeMessage({ isPending: true, content: 'Thinking...' });

      renderWithProviders(<MessageBlock message={msg} />);

      expect(screen.getByRole('status', { name: /generating response/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /copy message/i })).toBeNull();
    });

    it('renders content when streaming with content', () => {
      const msg = makeMessage({
        isPending: false,
        isStreaming: true,
        content: 'Here is the first chunk of the response...',
      });

      renderWithProviders(<MessageBlock message={msg} />);

      expect(screen.getByText(/first chunk/i)).toBeInTheDocument();
      expect(screen.queryByRole('status', { name: /generating response/i })).toBeNull();
      expect(screen.queryByRole('button', { name: /copy message/i })).toBeNull();
    });

    it('transitions from thinking to streaming to complete', () => {
      const { rerender } = renderWithProviders(
        <MessageBlock message={makeMessage({ isPending: true, content: 'Thinking...' })} />,
      );

      expect(screen.getByRole('status', { name: /generating response/i })).toBeInTheDocument();

      rerender(
        <MessageBlock
          message={makeMessage({
            isPending: false,
            isStreaming: true,
            content: 'Starting...',
          })}
        />,
      );

      expect(screen.queryByRole('status', { name: /generating response/i })).toBeNull();
      expect(screen.getByText(/starting/i)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /copy message/i })).toBeNull();

      rerender(
        <MessageBlock
          message={makeMessage({
            isPending: false,
            isStreaming: false,
            content: 'Starting... Done!',
          })}
        />,
      );

      expect(screen.getByText(/done!/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /copy message/i })).toBeInTheDocument();
    });
  });

  describe('long messages', () => {
    it('renders very long content fully without truncation', () => {
      const REPEAT_COUNT = 100;
      const WORDS_PER_PARA = 10;
      const paragraphs = Array.from(
        { length: REPEAT_COUNT },
        (_, i) => `Paragraph ${String(i + 1)}: ${'Lorem ipsum. '.repeat(WORDS_PER_PARA)}`,
      );
      const msg = makeMessage({ content: `# Long Document\n\n${paragraphs.join('\n\n')}` });

      renderWithProviders(<MessageBlock message={msg} />);

      expect(screen.getByText(/paragraph 1:/i)).toBeInTheDocument();
      expect(screen.getByText(/paragraph 100:/i)).toBeInTheDocument();
    });
  });

  describe('user messages', () => {
    it('renders user content as plain text, not markdown', () => {
      const msg = makeMessage({ role: 'user', content: 'What is **bold**?' });

      renderWithProviders(<MessageBlock message={msg} />);

      expect(screen.getByText('What is **bold**?')).toBeInTheDocument();
    });

    it('shows copy button on user messages when onStartEdit is provided', () => {
      const msg = makeMessage({ role: 'user', content: 'My question' });

      renderWithProviders(<MessageBlock message={msg} onStartEdit={vi.fn()} />);

      expect(screen.getByRole('button', { name: /copy message/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /edit message/i })).toBeInTheDocument();
    });

    it('shows copy but not edit when onStartEdit is not provided', () => {
      const msg = makeMessage({ role: 'user', content: 'My question' });

      renderWithProviders(<MessageBlock message={msg} />);

      expect(screen.getByRole('button', { name: /copy message/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /edit message/i })).toBeNull();
    });

    it('does not show action bar on pending user messages', () => {
      const msg = makeMessage({ role: 'user', content: 'Sending...', isPending: true });

      renderWithProviders(<MessageBlock message={msg} onStartEdit={vi.fn()} />);

      expect(screen.queryByRole('button', { name: /edit message/i })).toBeNull();
    });
  });

  describe('edit mode', () => {
    it('renders MessageEditor when isEditing is true', () => {
      const msg = makeMessage({ role: 'user', content: 'Original question' });

      renderWithProviders(
        <MessageBlock
          message={msg}
          isEditing={true}
          editDraft="Edited question"
          onCancelEdit={vi.fn()}
          onSubmitEdit={vi.fn()}
          onEditDraftChange={vi.fn()}
        />,
      );

      expect(screen.getByRole('textbox')).toBeInTheDocument();
      expect(screen.getByRole('textbox')).toHaveValue('Edited question');
    });

    it('hides action bar when editing', () => {
      const msg = makeMessage({ role: 'user', content: 'Original' });

      renderWithProviders(
        <MessageBlock
          message={msg}
          isEditing={true}
          editDraft="Edited"
          onStartEdit={vi.fn()}
          onCancelEdit={vi.fn()}
          onSubmitEdit={vi.fn()}
          onEditDraftChange={vi.fn()}
        />,
      );

      expect(screen.queryByRole('button', { name: /edit message/i })).toBeNull();
    });
  });

  describe('error state', () => {
    it('renders error messages with assistant label', () => {
      const msg = makeMessage({
        isError: true,
        isPending: false,
        content: 'Rate limit exceeded.',
      });

      renderWithProviders(<MessageBlock message={msg} />);

      expect(screen.getByText(/rate limit exceeded/i)).toBeInTheDocument();
      expect(screen.getByRole('article', { name: /assistant message/i })).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('has article role and aria-label for assistant', () => {
      const msg = makeMessage({ content: 'Test' });

      renderWithProviders(<MessageBlock message={msg} />);

      expect(screen.getByRole('article', { name: /assistant message/i })).toBeInTheDocument();
    });

    it('has article role and aria-label for user', () => {
      const msg = makeMessage({ role: 'user', content: 'Test' });

      renderWithProviders(<MessageBlock message={msg} />);

      expect(screen.getByRole('article', { name: /your message/i })).toBeInTheDocument();
    });

    it('has accessible thinking indicator', () => {
      const msg = makeMessage({ isPending: true, content: 'Thinking...' });

      renderWithProviders(<MessageBlock message={msg} />);

      expect(screen.getByRole('status', { name: /generating response/i })).toBeInTheDocument();
    });
  });

  describe('action bar - assistant', () => {
    it('shows copy button on completed assistant messages', () => {
      const msg = makeMessage({ content: 'Final answer here.' });

      renderWithProviders(<MessageBlock message={msg} />);

      expect(screen.getByRole('button', { name: /copy message/i })).toBeInTheDocument();
    });

    it('does not show copy button during streaming', () => {
      const msg = makeMessage({ isStreaming: true, content: 'Partial...' });

      renderWithProviders(<MessageBlock message={msg} />);

      expect(screen.queryByRole('button', { name: /copy message/i })).toBeNull();
    });

    it('shows save note button when onSaveNote is provided', () => {
      const msg = makeMessage({ content: 'Worth saving.' });

      renderWithProviders(<MessageBlock message={msg} onSaveNote={vi.fn()} />);

      expect(screen.getByRole('button', { name: /save note/i })).toBeInTheDocument();
    });

    it('shows regenerate button when onRegenerate is provided and isLastAssistantMessage', () => {
      const msg = makeMessage({ content: 'Old answer.' });

      renderWithProviders(
        <MessageBlock message={msg} onRegenerate={vi.fn()} isLastAssistantMessage={true} />,
      );

      expect(screen.getByRole('button', { name: /regenerate response/i })).toBeInTheDocument();
    });
  });

  describe('message status', () => {
    it('shows sending indicator for user messages with status sending', () => {
      const msg = makeMessage({ role: 'user', content: 'Question', status: 'sending' });

      renderWithProviders(<MessageBlock message={msg} />);

      const article = screen.getByRole('article');
      expect(within(article).getByLabelText(/sending/i)).toBeInTheDocument();
    });

    it('shows failed indicator for user messages with status failed', () => {
      const msg = makeMessage({ role: 'user', content: 'Question', status: 'failed' });

      renderWithProviders(<MessageBlock message={msg} />);

      const article = screen.getByRole('article');
      expect(within(article).getByLabelText(/failed to send/i)).toBeInTheDocument();
    });

    it('does not show status indicator for assistant messages', () => {
      const msg = makeMessage({ role: 'assistant', content: 'Answer', status: 'sending' });

      renderWithProviders(<MessageBlock message={msg} />);

      const article = screen.getByRole('article');
      expect(within(article).queryByLabelText(/sending/i)).toBeNull();
    });
  });
});
