import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SidebarLayout } from '../SidebarLayout';

function renderLayout({ isOpen = true }: { isOpen?: boolean } = {}): ReturnType<typeof render> {
  return render(
    <SidebarLayout
      isOpen={isOpen}
      onToggle={vi.fn()}
      onResizeStart={vi.fn()}
      headerLeft={<div>Tabs</div>}
      headerRight={<div>Actions</div>}
    >
      <section data-testid="sidebar-content">Body</section>
    </SidebarLayout>,
  );
}

describe('SidebarLayout', () => {
  it('wraps tab content in the sidebar body region', () => {
    const { container } = renderLayout();

    const body = container.querySelector('.lockin-sidebar-body');
    const content = screen.getByTestId('sidebar-content');

    expect(body).not.toBeNull();
    expect(body?.contains(content)).toBe(true);
  });
});
