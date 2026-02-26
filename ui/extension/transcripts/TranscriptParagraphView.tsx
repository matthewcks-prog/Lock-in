import { useRef, useEffect, useMemo } from 'react';
import type { TranscriptSegment } from '@core/transcripts/types';
import type { TranscriptParagraph } from './transcriptParagraphs';
import { buildTranscriptParagraphs } from './transcriptParagraphs';
import { useTranscriptFilter } from './useTranscriptFilter';
import type { UseTranscriptFilterResult } from './useTranscriptFilter';
import { useTranscriptTimestampsPreference } from './useTranscriptTimestampsPreference';
import { TranscriptSearchBar } from './TranscriptSearchBar';
import { TranscriptTimestampsToggle } from './TranscriptTimestampsToggle';
import { TranscriptParagraphBlock } from './TranscriptParagraphBlock';

export interface TranscriptParagraphViewProps {
  segments: TranscriptSegment[];
}

interface ParagraphListProps {
  visible: TranscriptParagraph[];
  matchIndices: number[];
  activeMatchIndex: number;
  searchQuery: string;
  showTimestamps: boolean;
}

function ParagraphList({
  visible,
  matchIndices,
  activeMatchIndex,
  searchQuery,
  showTimestamps,
}: ParagraphListProps): JSX.Element {
  const blockRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  useEffect(() => {
    const targetIdx = matchIndices[activeMatchIndex];
    if (targetIdx === undefined) return;
    blockRefs.current.get(targetIdx)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [matchIndices, activeMatchIndex]);

  if (visible.length === 0) {
    return <p className="lockin-transcript-para-empty">No paragraphs match the current filter.</p>;
  }

  return (
    <div aria-label="Transcript" className="lockin-transcript-para-list" role="region">
      {visible.map((para, i) => (
        <div
          key={para.startMs}
          ref={(el) => {
            if (el !== null) blockRefs.current.set(i, el);
            else blockRefs.current.delete(i);
          }}
        >
          <TranscriptParagraphBlock
            isActive={matchIndices.length > 0 && matchIndices[activeMatchIndex] === i}
            paragraph={para}
            searchQuery={searchQuery}
            showTimestamp={showTimestamps}
          />
        </div>
      ))}
    </div>
  );
}

function useParaViewState(paragraphs: TranscriptParagraph[]): UseTranscriptFilterResult {
  return useTranscriptFilter(paragraphs);
}

export function TranscriptParagraphView({ segments }: TranscriptParagraphViewProps): JSX.Element {
  const paragraphs = useMemo(() => buildTranscriptParagraphs(segments), [segments]);
  const filter = useParaViewState(paragraphs);
  const [showTimestamps, setShowTimestamps] = useTranscriptTimestampsPreference();
  const { query, visible, matchIndices, activeMatchIndex } = filter;
  return (
    <div className="lockin-transcript-para-view">
      <div className="lockin-transcript-para-toolbar">
        <TranscriptSearchBar
          activeMatchIndex={activeMatchIndex}
          matchCount={matchIndices.length}
          onNext={filter.goNext}
          onPrev={filter.goPrev}
          onQueryChange={filter.setQuery}
          query={query}
        />
        <TranscriptTimestampsToggle checked={showTimestamps} onCheckedChange={setShowTimestamps} />
      </div>
      <ParagraphList
        activeMatchIndex={activeMatchIndex}
        matchIndices={matchIndices}
        searchQuery={query}
        showTimestamps={showTimestamps}
        visible={visible}
      />
    </div>
  );
}
