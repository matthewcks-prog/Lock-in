import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { SidebarLayout } from '../SidebarLayout';

function renderLayout({
  isOpen = true,
  footer = null,
}: {
  isOpen?: boolean;
  footer?: ReactNode;
} = {}): ReturnType<typeof render> {
  return render(
    <SidebarLayout
      isOpen={isOpen}
      onToggle={vi.fn()}
      onResizeStart={vi.fn()}
      headerLeft={<div>Tabs</div>}
      headerRight={<div>Actions</div>}
      footer={footer}
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

  it('renders footer content in a dedicated footer region', () => {
    const { container } = renderLayout({
      footer: <div data-testid="sidebar-footer-content">Footer</div>,
    });

    const footer = container.querySelector('.lockin-sidebar-footer');
    const footerContent = screen.getByTestId('sidebar-footer-content');

    expect(footer).not.toBeNull();
    expect(footer?.contains(footerContent)).toBe(true);
  });
});
