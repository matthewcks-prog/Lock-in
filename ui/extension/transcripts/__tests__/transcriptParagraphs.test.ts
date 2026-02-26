import { describe, it, expect } from 'vitest';
import type { TranscriptSegment } from '@core/transcripts/types';
import { buildTranscriptParagraphs } from '../transcriptParagraphs';
import { splitHighlight, findMatchingIndices } from '../transcriptSearchUtils';

// ─── buildTranscriptParagraphs ────────────────────────────────────────────────

function seg(startMs: number, endMs: number, text: string, speaker?: string): TranscriptSegment {
  return { startMs, endMs, text, ...(speaker !== undefined ? { speaker } : {}) };
}

describe('buildTranscriptParagraphs', () => {
  it('returns empty array for empty input', () => {
    expect(buildTranscriptParagraphs([])).toEqual([]);
  });

  it('returns a single paragraph for a single segment', () => {
    const result = buildTranscriptParagraphs([seg(0, 2000, 'Hello.')]);
    expect(result).toHaveLength(1);
    expect(result[0]!.text).toBe('Hello.');
    expect(result[0]!.startMs).toBe(0);
  });

  it('keeps close segments in the same paragraph', () => {
    const segments = [seg(0, 1000, 'Hello'), seg(1200, 2200, 'world.')];
    const result = buildTranscriptParagraphs(segments);
    expect(result).toHaveLength(1);
    expect(result[0]!.text).toBe('Hello world.');
  });

  it('breaks on a >2.5s gap when sentence is complete', () => {
    const segments = [seg(0, 1000, 'First sentence.'), seg(4000, 5000, 'Second sentence.')];
    const result = buildTranscriptParagraphs(segments);
    expect(result).toHaveLength(2);
    expect(result[0]!.text).toBe('First sentence.');
    expect(result[1]!.text).toBe('Second sentence.');
  });

  it('does NOT break on a soft gap when sentence is incomplete', () => {
    const segments = [
      seg(0, 1000, 'The quick brown fox'),
      seg(4000, 5000, 'jumps over the lazy dog.'),
    ];
    const result = buildTranscriptParagraphs(segments);
    // Soft gap (3 s) but prev text has no sentence-end → stays together
    expect(result).toHaveLength(1);
    expect(result[0]!.text).toBe('The quick brown fox jumps over the lazy dog.');
  });

  it('always breaks on a hard gap (>=5s) regardless of punctuation', () => {
    const segments = [seg(0, 1000, 'The quick brown fox'), seg(6500, 7500, 'new paragraph.')];
    const result = buildTranscriptParagraphs(segments);
    expect(result).toHaveLength(2);
  });

  it('breaks on speaker change', () => {
    const segments = [
      seg(0, 1000, 'I agree.', 'Speaker A'),
      seg(1200, 2200, 'I disagree.', 'Speaker B'),
    ];
    const result = buildTranscriptParagraphs(segments);
    expect(result).toHaveLength(2);
    expect(result[0]!.speaker).toBe('Speaker A');
    expect(result[1]!.speaker).toBe('Speaker B');
  });

  it('does NOT break when the same speaker continues', () => {
    const segments = [seg(0, 1000, 'Hello.', 'Speaker A'), seg(1200, 2200, 'World.', 'Speaker A')];
    const result = buildTranscriptParagraphs(segments);
    expect(result).toHaveLength(1);
  });

  it('provides correct segment arrays in each paragraph', () => {
    const s1 = seg(0, 1000, 'One.');
    const s2 = seg(5001, 6000, 'Two.');
    const result = buildTranscriptParagraphs([s1, s2]);
    expect(result[0]!.segments).toContain(s1);
    expect(result[1]!.segments).toContain(s2);
  });
});

// ─── splitHighlight ───────────────────────────────────────────────────────────

describe('splitHighlight', () => {
  it('returns the full text as non-match when query is empty', () => {
    const result = splitHighlight('Hello world', '');
    expect(result).toEqual([{ match: false, part: 'Hello world' }]);
  });

  it('marks matching parts', () => {
    const result = splitHighlight('Hello world', 'world');
    const matched = result.filter((p) => p.match);
    expect(matched).toHaveLength(1);
    expect(matched[0]!.part).toBe('world');
  });

  it('is case-insensitive', () => {
    const result = splitHighlight('Hello World', 'hello');
    const matched = result.filter((p) => p.match);
    expect(matched).toHaveLength(1);
    expect(matched[0]!.part).toBe('Hello');
  });

  it('handles multiple occurrences', () => {
    const result = splitHighlight('a b a b a', 'a');
    expect(result.filter((p) => p.match)).toHaveLength(3);
  });
});

// ─── findMatchingIndices ──────────────────────────────────────────────────────

describe('findMatchingIndices', () => {
  it('returns empty when query is blank', () => {
    expect(findMatchingIndices(['foo', 'bar'], '')).toEqual([]);
  });

  it('returns indices of matching texts', () => {
    const texts = ['Hello world', 'Goodbye', 'Hello again'];
    expect(findMatchingIndices(texts, 'hello')).toEqual([0, 2]);
  });
});
