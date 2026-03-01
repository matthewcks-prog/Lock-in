/**
 * useTranscriptFilter
 *
 * Manages paragraph search state, returning derived filtered paragraphs
 * + match navigation. Speaker and time-range filters have been removed
 * in favour of a simpler, cleaner UX.
 */

import { useState, useMemo, useCallback } from 'react';
import type { TranscriptParagraph } from './transcriptParagraphs';
import { findMatchingIndices } from './transcriptSearchUtils';

function useMatchNavigation(matchCount: number): [number, () => void, () => void, () => void] {
  const [activeMatchIndex, setActiveMatchIndex] = useState(0);
  const goNext = useCallback(
    () => setActiveMatchIndex((i) => (matchCount === 0 ? 0 : (i + 1) % matchCount)),
    [matchCount],
  );
  const goPrev = useCallback(
    () => setActiveMatchIndex((i) => (matchCount === 0 ? 0 : (i - 1 + matchCount) % matchCount)),
    [matchCount],
  );
  const reset = useCallback(() => setActiveMatchIndex(0), []);
  return [activeMatchIndex, goNext, goPrev, reset];
}

export interface UseTranscriptFilterResult {
  query: string;
  setQuery: (q: string) => void;
  visible: TranscriptParagraph[];
  matchIndices: number[];
  activeMatchIndex: number;
  goNext: () => void;
  goPrev: () => void;
}

export function useTranscriptFilter(paragraphs: TranscriptParagraph[]): UseTranscriptFilterResult {
  const [query, setQuery] = useState('');

  // All paragraphs are visible – filtering is search-only.
  const visible = paragraphs;

  const matchIndices = useMemo(
    () =>
      findMatchingIndices(
        visible.map((p) => p.text),
        query,
      ),
    [visible, query],
  );

  const [activeIdx, goNext, goPrev, resetMatchIndex] = useMatchNavigation(matchIndices.length);
  const safeIndex = matchIndices.length > 0 ? activeIdx % matchIndices.length : 0;

  const handleSetQuery = useCallback(
    (q: string) => {
      resetMatchIndex();
      setQuery(q);
    },
    [resetMatchIndex],
  );

  return {
    query,
    setQuery: handleSetQuery,
    visible,
    matchIndices,
    activeMatchIndex: safeIndex,
    goNext,
    goPrev,
  };
}
