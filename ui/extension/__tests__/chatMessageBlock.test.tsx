/**
 * Tests for MessageBlock component — hover actions, edit flow, regenerate scoping.
 *
 * Covers:
 * 1. Action buttons hidden by default, visible on hover/focus
 * 2. Edit updates bubble content and shows "edited" indicator
 * 3. Save triggers correct persistence call with correct messageId
 * 4. Cancel reverts UI without side effects
 * 5. Regenerate only on the last assistant message
 * 6. Streaming/pending states disable edit controls
 */

import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MessageBlock, type MessageBlockProps } from '../chat/components/MessageBlock';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMessage(
  overrides: Partial<MessageBlockProps['message']> = {},
): MessageBlockProps['message'] {
  return {
    id: 'msg-1',
    role: 'user',
    content: 'Hello world',
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

function renderBlock(props: Partial<MessageBlockProps> = {}) {
  const defaultProps: MessageBlockProps = {
    message: makeMessage(),
    ...props,
  };
  return render(<MessageBlock {...defaultProps} />);
}

// ---------------------------------------------------------------------------
// 1. Action buttons hidden by default, visible on hover/focus
// ---------------------------------------------------------------------------

describe('MessageBlock action bar visibility', () => {
  it('renders action bar with role="toolbar" for user messages', () => {
    renderBlock({
      message: makeMessage({ role: 'user', content: 'Hello' }),
      onStartEdit: vi.fn(),
    });
    const toolbar = screen.getByRole('toolbar', { name: /message actions/i });
    expect(toolbar).toBeInTheDocument();
    // The toolbar has CSS opacity:0 by default — we can verify the class is applied
    expect(toolbar.className).toContain('lockin-msg-action-bar');
    expect(toolbar.className).toContain('lockin-msg-action-bar--below');
    expect(toolbar.className).toContain('lockin-msg-action-bar--user');
  });

  it('renders action bar below assistant messages', () => {
    renderBlock({
      message: makeMessage({ role: 'assistant', content: 'Reply' }),
      isLastAssistantMessage: true,
      onRegenerate: vi.fn(),
    });
    const toolbar = screen.getByRole('toolbar', { name: /message actions/i });
    expect(toolbar.className).toContain('lockin-msg-action-bar--below');
  });

  it('does not render action bar when message is pending', () => {
    renderBlock({
      message: makeMessage({ role: 'user', content: 'Hello', isPending: true }),
      onStartEdit: vi.fn(),
    });
    expect(screen.queryByRole('toolbar')).not.toBeInTheDocument();
  });

  it('does not render action bar when message has no content', () => {
    renderBlock({
      message: makeMessage({ role: 'user', content: '' }),
      onStartEdit: vi.fn(),
    });
    expect(screen.queryByRole('toolbar')).not.toBeInTheDocument();
  });

  it('action buttons have aria-labels for accessibility', () => {
    renderBlock({
      message: makeMessage({ role: 'user', content: 'Hello' }),
      onStartEdit: vi.fn(),
    });
    expect(screen.getByRole('button', { name: /edit message/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /copy message/i })).toBeInTheDocument();
  });

  it('focus-visible outline is ensured via button class', () => {
    renderBlock({
      message: makeMessage({ role: 'user', content: 'Hello' }),
      onStartEdit: vi.fn(),
    });
    const editBtn = screen.getByRole('button', { name: /edit message/i });
    expect(editBtn.className).toContain('lockin-msg-action-btn');
  });
});

// ---------------------------------------------------------------------------
// 2. Editing updates bubble content
// ---------------------------------------------------------------------------

describe('MessageBlock edit mode', () => {
  it('shows editor when isEditing is true', () => {
    renderBlock({
      message: makeMessage({ role: 'user', content: 'Hello' }),
      isEditing: true,
      editDraft: 'Hello edited',
      onCancelEdit: vi.fn(),
      onSubmitEdit: vi.fn(),
      onEditDraftChange: vi.fn(),
    });
    expect(screen.getByRole('textbox', { name: /edit message/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send/i })).toBeInTheDocument();
  });

  it('hides action bar when in edit mode', () => {
    renderBlock({
      message: makeMessage({ role: 'user', content: 'Hello' }),
      isEditing: true,
      editDraft: 'Hello',
      onStartEdit: vi.fn(),
      onCancelEdit: vi.fn(),
      onSubmitEdit: vi.fn(),
      onEditDraftChange: vi.fn(),
    });
    expect(screen.queryByRole('toolbar')).not.toBeInTheDocument();
  });

  it('shows "edited" badge when message has editedAt', () => {
    const editedAt = new Date(Date.now() - 120000).toISOString(); // 2 minutes ago
    renderBlock({
      message: makeMessage({ role: 'user', content: 'Hello there', editedAt }),
    });
    const badge = screen.getByText(/\(edited/i);
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain('lockin-msg-edited-badge');
  });

  it('does not show "edited" badge for non-edited messages', () => {
    renderBlock({
      message: makeMessage({ role: 'user', content: 'Hello' }),
    });
    expect(screen.queryByText(/\(edited/i)).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 3. Save triggers correct persistence call
// ---------------------------------------------------------------------------

describe('MessageBlock edit submission', () => {
  it('calls onStartEdit with correct messageId and content', async () => {
    const user = userEvent.setup();
    const onStartEdit = vi.fn();
    renderBlock({
      message: makeMessage({ id: 'msg-42', role: 'user', content: 'Original text' }),
      onStartEdit,
    });

    const editBtn = screen.getByRole('button', { name: /edit message/i });
    await user.click(editBtn);
    expect(onStartEdit).toHaveBeenCalledWith('msg-42', 'Original text');
  });

  it('calls onSubmitEdit when Send is clicked', async () => {
    const user = userEvent.setup();
    const onSubmitEdit = vi.fn();
    renderBlock({
      message: makeMessage({ role: 'user', content: 'Hello' }),
      isEditing: true,
      editDraft: 'Updated hello',
      onSubmitEdit,
      onCancelEdit: vi.fn(),
      onEditDraftChange: vi.fn(),
    });

    const sendBtn = screen.getByRole('button', { name: /send/i });
    await user.click(sendBtn);
    expect(onSubmitEdit).toHaveBeenCalledOnce();
  });

  it('disables Send when draft is empty', () => {
    renderBlock({
      message: makeMessage({ role: 'user', content: 'Hello' }),
      isEditing: true,
      editDraft: '   ',
      onSubmitEdit: vi.fn(),
      onCancelEdit: vi.fn(),
      onEditDraftChange: vi.fn(),
    });

    const sendBtn = screen.getByRole('button', { name: /send/i });
    expect(sendBtn).toBeDisabled();
  });
});

// ---------------------------------------------------------------------------
// 4. Cancel reverts UI without side effects
// ---------------------------------------------------------------------------

describe('MessageBlock edit cancel', () => {
  it('calls onCancelEdit when Cancel is clicked', async () => {
    const user = userEvent.setup();
    const onCancelEdit = vi.fn();
    renderBlock({
      message: makeMessage({ role: 'user', content: 'Hello' }),
      isEditing: true,
      editDraft: 'Modified',
      onCancelEdit,
      onSubmitEdit: vi.fn(),
      onEditDraftChange: vi.fn(),
    });

    const cancelBtn = screen.getByRole('button', { name: /cancel/i });
    await user.click(cancelBtn);
    expect(onCancelEdit).toHaveBeenCalledOnce();
  });

  it('calls onCancelEdit on Escape key press', async () => {
    const user = userEvent.setup();
    const onCancelEdit = vi.fn();
    renderBlock({
      message: makeMessage({ role: 'user', content: 'Hello' }),
      isEditing: true,
      editDraft: 'Modified',
      onCancelEdit,
      onSubmitEdit: vi.fn(),
      onEditDraftChange: vi.fn(),
    });

    const textarea = screen.getByRole('textbox', { name: /edit message/i });
    textarea.focus();
    await user.keyboard('{Escape}');
    expect(onCancelEdit).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// 5. Regenerate only on the last assistant message
// ---------------------------------------------------------------------------

describe('MessageBlock regenerate scoping', () => {
  it('shows regenerate button only when isLastAssistantMessage is true', () => {
    const onRegenerate = vi.fn();
    renderBlock({
      message: makeMessage({ role: 'assistant', content: 'Reply 1' }),
      isLastAssistantMessage: true,
      onRegenerate,
    });
    expect(screen.getByRole('button', { name: /regenerate response/i })).toBeInTheDocument();
  });

  it('does NOT show regenerate button when isLastAssistantMessage is false', () => {
    const onRegenerate = vi.fn();
    renderBlock({
      message: makeMessage({ role: 'assistant', content: 'Reply 1' }),
      isLastAssistantMessage: false,
      onRegenerate,
    });
    expect(screen.queryByRole('button', { name: /regenerate response/i })).not.toBeInTheDocument();
  });

  it('does NOT show regenerate when onRegenerate is undefined', () => {
    renderBlock({
      message: makeMessage({ role: 'assistant', content: 'Reply' }),
      isLastAssistantMessage: true,
    });
    expect(screen.queryByRole('button', { name: /regenerate response/i })).not.toBeInTheDocument();
  });

  it('calls onRegenerate when button is clicked', async () => {
    const user = userEvent.setup();
    const onRegenerate = vi.fn();
    renderBlock({
      message: makeMessage({ role: 'assistant', content: 'Reply' }),
      isLastAssistantMessage: true,
      onRegenerate,
    });

    const btn = screen.getByRole('button', { name: /regenerate response/i });
    await user.click(btn);
    expect(onRegenerate).toHaveBeenCalledOnce();
  });

  it('disables regenerate button when isRegenerating is true', () => {
    renderBlock({
      message: makeMessage({ role: 'assistant', content: 'Reply' }),
      isLastAssistantMessage: true,
      onRegenerate: vi.fn(),
      isRegenerating: true,
    });

    const btn = screen.getByRole('button', { name: /regenerate response/i });
    expect(btn).toBeDisabled();
  });

  it('multi-turn: regenerate appears only on the final assistant message', () => {
    const onRegenerate = vi.fn();

    // First assistant message — NOT last
    const { unmount: unmount1 } = render(
      <MessageBlock
        message={makeMessage({ id: 'a1', role: 'assistant', content: 'Reply 1' })}
        isLastAssistantMessage={false}
        onRegenerate={onRegenerate}
      />,
    );
    expect(screen.queryByRole('button', { name: /regenerate response/i })).not.toBeInTheDocument();
    unmount1();

    // Second assistant message — IS last
    render(
      <MessageBlock
        message={makeMessage({ id: 'a2', role: 'assistant', content: 'Reply 2' })}
        isLastAssistantMessage={true}
        onRegenerate={onRegenerate}
      />,
    );
    expect(screen.getByRole('button', { name: /regenerate response/i })).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 6. Streaming/pending states disable edit controls
// ---------------------------------------------------------------------------

describe('MessageBlock streaming/pending states', () => {
  it('does not show user edit button when message is pending', () => {
    renderBlock({
      message: makeMessage({ role: 'user', content: 'Hello', isPending: true }),
      onStartEdit: vi.fn(),
    });
    expect(screen.queryByRole('button', { name: /edit message/i })).not.toBeInTheDocument();
  });

  it('does not show assistant actions while streaming', () => {
    renderBlock({
      message: makeMessage({ role: 'assistant', content: 'Partial reply...', isStreaming: true }),
      isLastAssistantMessage: true,
      onRegenerate: vi.fn(),
    });
    expect(screen.queryByRole('toolbar')).not.toBeInTheDocument();
  });

  it('shows thinking indicator when message is pending with no content', () => {
    renderBlock({
      message: makeMessage({ role: 'assistant', content: '', isPending: true }),
    });
    expect(screen.getByRole('status', { name: /generating response/i })).toBeInTheDocument();
  });

  it('shows streaming caret when assistant is streaming with content', () => {
    renderBlock({
      message: makeMessage({ role: 'assistant', content: 'Streaming...', isStreaming: true }),
    });
    // The caret is aria-hidden, so query by class
    const article = screen.getByRole('article');
    const caret = article.querySelector('.lockin-msg-caret');
    expect(caret).toBeInTheDocument();
  });

  it('does not show edit for user message while submitting edit', () => {
    renderBlock({
      message: makeMessage({ role: 'user', content: 'Hello' }),
      isEditing: true,
      editDraft: 'Modified',
      isSubmittingEdit: true,
      onCancelEdit: vi.fn(),
      onSubmitEdit: vi.fn(),
      onEditDraftChange: vi.fn(),
    });

    // Textarea should be disabled during submission
    const textarea = screen.getByRole('textbox', { name: /edit message/i });
    expect(textarea).toBeDisabled();

    // Submit button should show "Saving..."
    const sendBtn = screen.getByRole('button', { name: /saving/i });
    expect(sendBtn).toBeDisabled();
  });
});

// ---------------------------------------------------------------------------
// Additional: block class helpers
// ---------------------------------------------------------------------------

describe('MessageBlock CSS classes', () => {
  it('applies user bubble class', () => {
    renderBlock({
      message: makeMessage({ role: 'user', content: 'Hello' }),
    });
    const article = screen.getByRole('article');
    expect(article.className).toContain('lockin-msg-block--user');
  });

  it('applies assistant class', () => {
    renderBlock({
      message: makeMessage({ role: 'assistant', content: 'Reply' }),
    });
    const article = screen.getByRole('article');
    expect(article.className).toContain('lockin-msg-block--assistant');
  });

  it('applies editing class when in edit mode', () => {
    renderBlock({
      message: makeMessage({ role: 'user', content: 'Hello' }),
      isEditing: true,
      editDraft: 'Hello',
      onCancelEdit: vi.fn(),
      onSubmitEdit: vi.fn(),
      onEditDraftChange: vi.fn(),
    });
    const article = screen.getByRole('article');
    expect(article.className).toContain('lockin-msg-block--editing');
  });

  it('applies error class for error messages', () => {
    renderBlock({
      message: makeMessage({ role: 'assistant', content: 'Error occurred', isError: true }),
    });
    const article = screen.getByRole('article');
    expect(article.className).toContain('lockin-msg-block--error');
  });
});

// ---------------------------------------------------------------------------
// 8. User action bar renders below the bubble, not above
// ---------------------------------------------------------------------------

describe('MessageBlock action bar placement', () => {
  it('user action bar renders after message body in DOM order', () => {
    renderBlock({
      message: makeMessage({ role: 'user', content: 'Hello' }),
      onStartEdit: vi.fn(),
    });
    const article = screen.getByRole('article');
    const body = article.querySelector('.lockin-msg-body');
    const toolbar = screen.getByRole('toolbar');

    expect(body).toBeInTheDocument();
    expect(toolbar).toBeInTheDocument();

    // Toolbar must appear after the body in DOM order (below the bubble)
    const children = Array.from(article.children);
    const bodyIndex = children.indexOf(body as Element);
    const toolbarIndex = children.indexOf(toolbar);
    expect(toolbarIndex).toBeGreaterThan(bodyIndex);
  });

  it('user action bar has --user alignment class', () => {
    renderBlock({
      message: makeMessage({ role: 'user', content: 'Hello' }),
      onStartEdit: vi.fn(),
    });
    const toolbar = screen.getByRole('toolbar');
    expect(toolbar.className).toContain('lockin-msg-action-bar--user');
  });

  it('action bar reserves space (min-height) to prevent layout shift', () => {
    renderBlock({
      message: makeMessage({ role: 'user', content: 'Hello' }),
      onStartEdit: vi.fn(),
    });
    const toolbar = screen.getByRole('toolbar');
    // The toolbar has the class that sets min-height in CSS
    expect(toolbar.className).toContain('lockin-msg-action-bar');
  });
});

// ---------------------------------------------------------------------------
// 9. Edit mode preserves bubble wrapper structure
// ---------------------------------------------------------------------------

describe('MessageBlock edit mode bubble stability', () => {
  it('edit mode keeps the same outer article structure and role', () => {
    const { rerender } = render(
      <MessageBlock
        message={makeMessage({ role: 'user', content: 'Hello' })}
        onStartEdit={vi.fn()}
      />,
    );
    screen.getByRole('article');

    rerender(
      <MessageBlock
        message={makeMessage({ role: 'user', content: 'Hello' })}
        isEditing={true}
        editDraft="Hello edited"
        onCancelEdit={vi.fn()}
        onSubmitEdit={vi.fn()}
        onEditDraftChange={vi.fn()}
      />,
    );
    const articleAfter = screen.getByRole('article');

    // The outer article must keep the user class
    expect(articleAfter.className).toContain('lockin-msg-block--user');
    // The editing class is added, but base structure is preserved
    expect(articleAfter.className).toContain('lockin-msg-block--editing');
    // The article should still have the msg-body child
    expect(articleAfter.querySelector('.lockin-msg-body')).toBeInTheDocument();
  });

  it('editor textarea renders inside the msg-body wrapper', () => {
    renderBlock({
      message: makeMessage({ role: 'user', content: 'Hello' }),
      isEditing: true,
      editDraft: 'Hello edited',
      onCancelEdit: vi.fn(),
      onSubmitEdit: vi.fn(),
      onEditDraftChange: vi.fn(),
    });
    const body = screen.getByRole('article').querySelector('.lockin-msg-body');
    const textarea = screen.getByRole('textbox', { name: /edit message/i });
    expect(body).toContainElement(textarea);
  });
});
