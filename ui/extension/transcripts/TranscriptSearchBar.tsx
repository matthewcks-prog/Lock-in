/**
 * Compact search bar with match navigation for transcript paragraphs.
 * Presentation-only: all state lives in the parent.
 */

import { Search, X, ChevronUp, ChevronDown } from 'lucide-react';

export interface TranscriptSearchBarProps {
  query: string;
  onQueryChange: (q: string) => void;
  matchCount: number;
  activeMatchIndex: number;
  onPrev: () => void;
  onNext: () => void;
}

function MatchBadge({
  label,
  hasResults,
}: {
  label: string;
  hasResults: boolean;
}): JSX.Element | null {
  if (label.length === 0) return null;
  const cls = `lockin-transcript-search-bar-count${!hasResults ? ' lockin-transcript-search-bar-count--none' : ''}`;
  return (
    <span aria-live="polite" className={cls}>
      {label}
    </span>
  );
}

function SearchControls({
  query,
  hasResults,
  onClear,
  onPrev,
  onNext,
}: {
  query: string;
  hasResults: boolean;
  onClear: () => void;
  onPrev: () => void;
  onNext: () => void;
}): JSX.Element {
  const btnCls = 'lockin-transcript-search-bar-btn';
  return (
    <>
      {query.length > 0 && (
        <button aria-label="Clear search" className={btnCls} onClick={onClear} type="button">
          <X size={12} strokeWidth={2.5} />
        </button>
      )}
      {hasResults && (
        <>
          <button aria-label="Previous match" className={btnCls} onClick={onPrev} type="button">
            <ChevronUp size={13} strokeWidth={2.5} />
          </button>
          <button aria-label="Next match" className={btnCls} onClick={onNext} type="button">
            <ChevronDown size={13} strokeWidth={2.5} />
          </button>
        </>
      )}
    </>
  );
}

export function TranscriptSearchBar({
  query,
  onQueryChange,
  matchCount,
  activeMatchIndex,
  onPrev,
  onNext,
}: TranscriptSearchBarProps): JSX.Element {
  const hasResults = matchCount > 0;
  const matchLabel = hasResults
    ? `${activeMatchIndex + 1}/${matchCount}`
    : query.trim().length > 0
      ? '0'
      : '';

  return (
    <div className="lockin-transcript-search-bar">
      <span aria-hidden="true" className="lockin-transcript-search-bar-icon">
        <Search size={13} strokeWidth={2.2} />
      </span>
      <input
        aria-label="Search transcript"
        className="lockin-transcript-search-bar-input"
        onChange={(event) => {
          onQueryChange(event.target.value);
        }}
        placeholder="Search transcript..."
        type="search"
        value={query}
      />
      <MatchBadge hasResults={hasResults} label={matchLabel} />
      <SearchControls
        hasResults={hasResults}
        onClear={() => {
          onQueryChange('');
        }}
        onNext={onNext}
        onPrev={onPrev}
        query={query}
      />
    </div>
  );
}
