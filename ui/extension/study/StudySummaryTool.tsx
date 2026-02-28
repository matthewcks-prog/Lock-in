import { useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import type { StudySummaryDepth } from '@api/client';
import { MarkdownRenderer } from '../chat/components/MarkdownRenderer';
import { useStudySummary } from './StudySummaryContext';
import { useStudyWorkspace } from './StudyWorkspaceContext';

const SUMMARY_DEPTH_OPTIONS: Array<{ id: StudySummaryDepth; label: string }> = [
  { id: 'brief', label: 'Brief' },
  { id: 'standard', label: 'Standard' },
  { id: 'detailed', label: 'Detailed' },
];

function StudySummaryControls(): JSX.Element {
  const { depth, setDepth, summaryState, generateSummary } = useStudySummary();
  return (
    <div className="lockin-study-summary-controls">
      <div className="lockin-study-summary-depth" role="group" aria-label="Summary depth">
        {SUMMARY_DEPTH_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            className={`lockin-study-summary-depth-btn${depth === option.id ? ' is-active' : ''}`}
            onClick={() => setDepth(option.id)}
            disabled={summaryState.status === 'loading'}
          >
            {option.label}
          </button>
        ))}
      </div>
      <button
        type="button"
        className="lockin-study-summary-regen-btn"
        aria-label={
          summaryState.status === 'loading' ? 'Generating summary…' : 'Regenerate summary'
        }
        title={summaryState.status === 'loading' ? 'Generating…' : 'Regenerate'}
        onClick={() => {
          void generateSummary({ force: true });
        }}
        disabled={summaryState.status === 'loading'}
      >
        <RefreshCw
          size={14}
          strokeWidth={2}
          className={summaryState.status === 'loading' ? 'lockin-spin' : undefined}
          aria-hidden="true"
        />
      </button>
    </div>
  );
}

function StudySummaryStatus(): JSX.Element {
  const { summaryState } = useStudySummary();

  if (summaryState.status === 'loading') {
    return <p className="lockin-study-summary-copy">Generating summary...</p>;
  }
  if (summaryState.status === 'error') {
    return <p className="lockin-study-summary-error">{summaryState.error}</p>;
  }
  if (summaryState.status === 'idle') {
    return <p className="lockin-study-summary-copy">Summary will appear here.</p>;
  }
  return (
    <div className="lockin-study-summary-meta">
      <span>Summary ready</span>
      {summaryState.chunked && (
        <span>Compiled from {summaryState.chunkCount} transcript chunks</span>
      )}
    </div>
  );
}

export function StudySummaryTool(): JSX.Element {
  const { selectedVideo } = useStudyWorkspace();
  const { summaryState, hasTranscriptForSelectedVideo, generateSummary } = useStudySummary();

  useEffect(() => {
    if (selectedVideo === null) return;
    if (!hasTranscriptForSelectedVideo) return;
    if (summaryState.status !== 'idle') return;
    void generateSummary();
  }, [generateSummary, hasTranscriptForSelectedVideo, selectedVideo, summaryState.status]);

  if (selectedVideo === null) {
    return <div className="lockin-study-tool-empty">Select a video to generate a summary.</div>;
  }
  if (!hasTranscriptForSelectedVideo) {
    return (
      <div className="lockin-study-summary-placeholder">
        <h3 className="lockin-study-summary-title">Summary</h3>
        <p className="lockin-study-summary-copy">
          Open Transcript and extract a transcript before generating a summary.
        </p>
      </div>
    );
  }

  return (
    <div className="lockin-study-summary-shell">
      <div className="lockin-study-summary-placeholder">
        <StudySummaryControls />
        <StudySummaryStatus />
      </div>
      {summaryState.status === 'success' && summaryState.markdown.length > 0 && (
        <div className="lockin-study-summary-content">
          <MarkdownRenderer content={summaryState.markdown} />
        </div>
      )}
    </div>
  );
}
