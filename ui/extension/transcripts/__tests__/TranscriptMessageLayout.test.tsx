import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { DetectedVideo, TranscriptResult } from '@core/transcripts/types';
import { TranscriptMessage } from '../TranscriptMessage';

vi.mock('../../contexts/TranscriptCacheContext', () => ({
  useTranscriptCacheContext: () => ({
    cacheTranscript: vi.fn().mockResolvedValue(null),
    status: 'idle',
    error: null,
    lastFingerprint: null,
  }),
}));

vi.mock('../TranscriptParagraphView', () => ({
  TranscriptParagraphView: () => <div data-testid="transcript-paragraph-view" />,
}));

vi.mock('../TranscriptActions', () => ({
  TranscriptActions: () => <div data-testid="transcript-actions" />,
}));

const TEST_TRANSCRIPT: TranscriptResult = {
  plainText: 'Welcome back everyone.',
  segments: [
    {
      startMs: 0,
      endMs: 1500,
      text: 'Welcome back everyone.',
    },
  ],
  durationMs: 1500,
};

const TEST_VIDEO: DetectedVideo = {
  id: 'video-1',
  provider: 'panopto',
  title: 'Panopto video 1',
  embedUrl: 'https://example.edu/panopto/video-1',
};

describe('TranscriptMessage layout contract', () => {
  it('renders transcript content in a dedicated body shell separate from footer actions', () => {
    const { container } = render(
      <TranscriptMessage
        transcript={TEST_TRANSCRIPT}
        video={TEST_VIDEO}
        videoTitle={TEST_VIDEO.title}
        saveNote={vi.fn().mockResolvedValue(null)}
      />,
    );

    const messageRoot = container.querySelector('.lockin-transcript-message');
    const bodyShell = container.querySelector('.lockin-transcript-body');
    const paragraphView = screen.getByTestId('transcript-paragraph-view');
    const actions = screen.getByTestId('transcript-actions');

    expect(messageRoot).not.toBeNull();
    expect(bodyShell).not.toBeNull();
    expect(bodyShell?.contains(paragraphView)).toBe(true);
    expect(bodyShell?.contains(actions)).toBe(false);
    expect(messageRoot?.lastElementChild).toBe(actions);
  });
});
