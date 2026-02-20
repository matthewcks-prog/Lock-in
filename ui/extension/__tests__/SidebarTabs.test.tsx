/**
 * SidebarTabs — unit tests
 *
 * Covers:
 * - Chat / Notes tabs rendering
 * - Tool tab rendering with correct close button (X icon, no "A-" text)
 * - Close button fires `onCloseTool` and navigates back to Chat
 * - Tab click callbacks
 * - Accessible roles and selection state
 */

import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { SidebarTabs } from '../sidebar/SidebarTabs';
import type { SidebarTabId } from '../sidebar/types';

function createProps(
  overrides: Partial<Parameters<typeof SidebarTabs>[0]> = {},
): Parameters<typeof SidebarTabs>[0] {
  return {
    activeTab: 'chat' as SidebarTabId,
    onTabChange: vi.fn(),
    activeToolId: null,
    activeToolTitle: null,
    onCloseTool: vi.fn(),
    ...overrides,
  };
}

describe('SidebarTabs', () => {
  describe('core tabs', () => {
    it('renders Chat and Notes tabs', () => {
      render(<SidebarTabs {...createProps()} />);
      expect(screen.getByRole('tab', { name: 'Chat' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Notes' })).toBeInTheDocument();
    });

    it('marks the active tab with aria-selected and active class', () => {
      render(<SidebarTabs {...createProps({ activeTab: 'notes' })} />);

      const notesTab = screen.getByRole('tab', { name: 'Notes' });
      expect(notesTab).toHaveAttribute('aria-selected', 'true');
      expect(notesTab.className).toContain('lockin-tab-active');

      const chatTab = screen.getByRole('tab', { name: 'Chat' });
      expect(chatTab).toHaveAttribute('aria-selected', 'false');
    });

    it('calls onTabChange with the correct tab id on click', () => {
      const onTabChange = vi.fn();
      render(<SidebarTabs {...createProps({ onTabChange })} />);

      fireEvent.click(screen.getByRole('tab', { name: 'Notes' }));
      expect(onTabChange).toHaveBeenCalledWith('notes');
    });
  });

  describe('tool tab — absent when no active tool', () => {
    it('does not render a tool tab when activeToolId is null', () => {
      render(<SidebarTabs {...createProps({ activeToolId: null })} />);
      expect(screen.queryByRole('tab', { name: /Transcript/i })).not.toBeInTheDocument();
    });
  });

  describe('tool tab — present when tool is active', () => {
    const toolProps = createProps({
      activeToolId: 'transcript',
      activeToolTitle: 'Transcript',
    });

    it('renders the tool tab with the tool title', () => {
      render(<SidebarTabs {...toolProps} />);
      expect(screen.getByText('Transcript')).toBeInTheDocument();
    });

    it('does NOT contain the legacy "A-" placeholder text', () => {
      const { container } = render(<SidebarTabs {...toolProps} />);
      expect(container.textContent).not.toContain('A-');
    });

    it('renders a close button with accessible label', () => {
      render(<SidebarTabs {...toolProps} />);
      const closeBtn = screen.getByRole('button', { name: 'Close Transcript' });
      expect(closeBtn).toBeInTheDocument();
    });

    it('clicking close calls onCloseTool and navigates to chat', () => {
      const onCloseTool = vi.fn();
      const onTabChange = vi.fn();
      render(
        <SidebarTabs
          {...toolProps}
          activeTab="tool"
          onCloseTool={onCloseTool}
          onTabChange={onTabChange}
        />,
      );

      fireEvent.click(screen.getByRole('button', { name: 'Close Transcript' }));

      expect(onCloseTool).toHaveBeenCalledTimes(1);
      expect(onTabChange).toHaveBeenCalledWith('chat');
    });

    it('clicking close does NOT navigate away when tool tab is not active', () => {
      const onCloseTool = vi.fn();
      const onTabChange = vi.fn();
      render(
        <SidebarTabs
          {...toolProps}
          activeTab="chat"
          onCloseTool={onCloseTool}
          onTabChange={onTabChange}
        />,
      );

      fireEvent.click(screen.getByRole('button', { name: 'Close Transcript' }));

      expect(onCloseTool).toHaveBeenCalledTimes(1);
      // Tab was already on 'chat', so no navigation needed
      expect(onTabChange).not.toHaveBeenCalled();
    });

    it('clicking the tool tab label navigates to the tool tab', () => {
      const onTabChange = vi.fn();
      render(<SidebarTabs {...toolProps} onTabChange={onTabChange} />);

      // Click the tab container (not the close button)
      const toolTab = screen.getByRole('tab', { name: /Transcript/i });
      fireEvent.click(toolTab);

      expect(onTabChange).toHaveBeenCalledWith('tool');
    });

    it('falls back to "Tool" when title is null', () => {
      render(<SidebarTabs {...createProps({ activeToolId: 'any', activeToolTitle: null })} />);
      expect(screen.getByText('Tool')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Close Tool' })).toBeInTheDocument();
    });
  });
});
