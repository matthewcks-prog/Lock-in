/**
 * TranscriptParagraphBlock – unit tests.
 * Verifies timestamp visibility and speaker rendering.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TranscriptParagraphBlock } from '../TranscriptParagraphBlock';
import type { TranscriptParagraph } from '../transcriptParagraphs';

function makeParagraph(overrides: Partial<TranscriptParagraph> = {}): TranscriptParagraph {
  return {
    startMs: 127_000,
    text: 'Good morning everyone.',
    speaker: undefined,
    segments: [],
    ...overrides,
  };
}

describe('TranscriptParagraphBlock', () => {
  it('renders timestamp text when showTimestamp is true', () => {
    const para = makeParagraph();
    render(
      <TranscriptParagraphBlock
        paragraph={para}
        searchQuery=""
        isActive={false}
        showTimestamp={true}
      />,
    );
    expect(screen.getByText('02:07')).toBeInTheDocument();
  });

  it('does not render timestamp when showTimestamp is false', () => {
    const para = makeParagraph();
    render(
      <TranscriptParagraphBlock
        paragraph={para}
        searchQuery=""
        isActive={false}
        showTimestamp={false}
      />,
    );
    expect(screen.queryByText('02:07')).not.toBeInTheDocument();
    expect(screen.getByText('Good morning everyone.')).toBeInTheDocument();
  });

  it('renders speaker when present and showTimestamp is false', () => {
    const para = makeParagraph({ speaker: 'Professor' });
    render(
      <TranscriptParagraphBlock
        paragraph={para}
        searchQuery=""
        isActive={false}
        showTimestamp={false}
      />,
    );
    expect(screen.getByText('Professor')).toBeInTheDocument();
    expect(screen.queryByText('02:07')).not.toBeInTheDocument();
  });
});
