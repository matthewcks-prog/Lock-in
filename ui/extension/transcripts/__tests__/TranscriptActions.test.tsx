import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TranscriptActions } from '../TranscriptActions';

const generateSummary = vi.fn();

vi.mock('../useGenerateSummary', () => ({
  useGenerateSummary: () => ({
    generateSummary,
    isLoading: false,
  }),
}));

describe('TranscriptActions', () => {
  beforeEach(() => {
    generateSummary.mockReset();
  });

  it('renders primary and secondary actions', () => {
    render(<TranscriptActions onDownloadTxt={vi.fn()} onDownloadVtt={vi.fn()} onSave={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Generate summary' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save note/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /more/i })).toBeInTheDocument();
  });

  it('wires callbacks for generate, save, and downloads', () => {
    const onDownloadTxt = vi.fn();
    const onDownloadVtt = vi.fn();
    const onSave = vi.fn();
    render(
      <TranscriptActions
        onDownloadTxt={onDownloadTxt}
        onDownloadVtt={onDownloadVtt}
        onSave={onSave}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Generate summary' }));
    fireEvent.click(screen.getByRole('button', { name: /save note/i }));
    fireEvent.click(screen.getByRole('button', { name: /more/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Download .txt' }));
    fireEvent.click(screen.getByRole('button', { name: /more/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Download .vtt' }));

    expect(generateSummary).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onDownloadTxt).toHaveBeenCalledTimes(1);
    expect(onDownloadVtt).toHaveBeenCalledTimes(1);
  });
});
