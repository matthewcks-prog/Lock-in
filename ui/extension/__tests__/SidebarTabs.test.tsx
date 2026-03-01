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
    ...overrides,
  };
}

describe('SidebarTabs', () => {
  it('renders Chat, Notes, and Study tabs', () => {
    render(<SidebarTabs {...createProps()} />);
    expect(screen.getByRole('tab', { name: 'Chat' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Notes' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Study' })).toBeInTheDocument();
  });

  it('marks the active tab with aria-selected and active class', () => {
    render(<SidebarTabs {...createProps({ activeTab: 'study' })} />);

    const studyTab = screen.getByRole('tab', { name: 'Study' });
    expect(studyTab).toHaveAttribute('aria-selected', 'true');
    expect(studyTab.className).toContain('lockin-tab-active');

    const chatTab = screen.getByRole('tab', { name: 'Chat' });
    expect(chatTab).toHaveAttribute('aria-selected', 'false');
  });

  it('calls onTabChange with study when Study tab is clicked', () => {
    const onTabChange = vi.fn();
    render(<SidebarTabs {...createProps({ onTabChange })} />);

    fireEvent.click(screen.getByRole('tab', { name: 'Study' }));
    expect(onTabChange).toHaveBeenCalledWith('study');
  });
});
