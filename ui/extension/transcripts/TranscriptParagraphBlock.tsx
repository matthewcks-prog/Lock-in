/**
 * TranscriptParagraphBlock
 *
 * Renders a single paragraph block: plain timestamp + highlighted body text.
 */

import type { TranscriptParagraph } from './transcriptParagraphs';
import { formatTime } from './transcriptFormatting';
import { splitHighlight } from './transcriptSearchUtils';

interface HighlightedTextProps {
  text: string;
  query: string;
}

function HighlightedText({ text, query }: HighlightedTextProps): JSX.Element {
  const parts = splitHighlight(text, query);
  return (
    <>
      {parts.map((p, i) =>
        p.match ? (
          // key: split index is stable for a given (text, query) pair
          <mark className="lockin-transcript-highlight" key={String(i)}>
            {p.part}
          </mark>
        ) : (
          <span key={String(i)}>{p.part}</span>
        ),
      )}
    </>
  );
}

export interface TranscriptParagraphBlockProps {
  paragraph: TranscriptParagraph;
  searchQuery: string;
  isActive: boolean;
  showTimestamp: boolean;
}

export function TranscriptParagraphBlock({
  paragraph,
  searchQuery,
  isActive,
  showTimestamp,
}: TranscriptParagraphBlockProps): JSX.Element {
  const timestamp = formatTime(paragraph.startMs);
  const hasSpeaker = paragraph.speaker !== undefined && paragraph.speaker.length > 0;
  const showMeta = showTimestamp || hasSpeaker;

  return (
    <div
      className={`lockin-transcript-para${isActive ? ' lockin-transcript-para--active' : ''}`}
      data-startms={paragraph.startMs}
    >
      {showMeta && (
        <div className="lockin-transcript-para-meta">
          {showTimestamp && <span className="lockin-transcript-timestamp">{timestamp}</span>}
          {hasSpeaker && <span className="lockin-transcript-speaker">{paragraph.speaker}</span>}
        </div>
      )}
      <p className="lockin-transcript-para-text">
        <HighlightedText query={searchQuery} text={paragraph.text} />
      </p>
    </div>
  );
}
