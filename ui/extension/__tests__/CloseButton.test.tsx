/**
 * CloseButton — unit tests
 *
 * Verifies the reusable close button renders correctly and fires callbacks.
 */

import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { CloseButton } from '../components/CloseButton';

describe('CloseButton', () => {
  it('renders a button with the provided aria-label', () => {
    render(<CloseButton onClick={vi.fn()} label="Close sidebar" />);
    expect(screen.getByRole('button', { name: 'Close sidebar' })).toBeInTheDocument();
  });

  it('fires the onClick handler when clicked', () => {
    const onClick = vi.fn();
    render(<CloseButton onClick={onClick} label="Close sidebar" />);
    fireEvent.click(screen.getByRole('button', { name: 'Close sidebar' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('applies the default lockin-close-btn class', () => {
    render(<CloseButton onClick={vi.fn()} label="Close sidebar" />);
    expect(screen.getByRole('button', { name: 'Close sidebar' })).toHaveClass('lockin-close-btn');
  });

  it('applies a custom class when className is provided', () => {
    render(<CloseButton onClick={vi.fn()} label="Close tab" className="lockin-tab-close" />);
    expect(screen.getByRole('button', { name: 'Close tab' })).toHaveClass('lockin-tab-close');
  });

  it('is disabled when disabled prop is true', () => {
    render(<CloseButton onClick={vi.fn()} label="Close sidebar" disabled />);
    expect(screen.getByRole('button', { name: 'Close sidebar' })).toBeDisabled();
  });

  it('does not fire onClick when disabled', () => {
    const onClick = vi.fn();
    render(<CloseButton onClick={onClick} label="Close sidebar" disabled />);
    fireEvent.click(screen.getByRole('button', { name: 'Close sidebar' }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('renders an SVG icon (not text-content)', () => {
    const { container } = render(<CloseButton onClick={vi.fn()} label="Close sidebar" />);
    const button = screen.getByRole('button', { name: 'Close sidebar' });
    // Icon renders as SVG, not raw text
    expect(button.textContent).toBe('');
    expect(container.querySelector('svg')).toBeInTheDocument();
  });
});
