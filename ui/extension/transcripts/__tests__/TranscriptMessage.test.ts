import { describe, expect, it } from 'vitest';
import {
  resolveTranscriptHeaderTitle,
  shouldRenderTranscriptHeaderTitle,
} from '../TranscriptMessage';

describe('resolveTranscriptHeaderTitle', () => {
  it('uses the video title by default', () => {
    const title = resolveTranscriptHeaderTitle({
      videoTitle: 'Panopto video 3',
    });

    expect(title).toBe('Transcript: Panopto video 3');
  });

  it('uses the explicit header title override when provided', () => {
    const title = resolveTranscriptHeaderTitle({
      videoTitle: 'Panopto video 3',
      headerTitle: 'Transcript',
    });

    expect(title).toBe('Transcript');
  });

  it('ignores blank header title overrides', () => {
    const title = resolveTranscriptHeaderTitle({
      videoTitle: 'Panopto video 3',
      headerTitle: '   ',
    });

    expect(title).toBe('Transcript: Panopto video 3');
  });
});

describe('shouldRenderTranscriptHeaderTitle', () => {
  it('renders title by default', () => {
    expect(shouldRenderTranscriptHeaderTitle()).toBe(true);
  });

  it('renders title when explicitly enabled', () => {
    expect(shouldRenderTranscriptHeaderTitle(true)).toBe(true);
  });

  it('hides title when explicitly disabled', () => {
    expect(shouldRenderTranscriptHeaderTitle(false)).toBe(false);
  });
});
